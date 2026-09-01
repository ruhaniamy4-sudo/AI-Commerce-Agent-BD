import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import * as dotenv from 'dotenv';
// Tools import removed
import { SYSTEM_PROMPT } from './prompts';
import { retrieveContext, formatContextPack, enforceContextBudget } from '../services/rag.service';
import { assertTenantBusinessId } from '../tenancy/context';
import { getAIMaxOutputTokens, getAIModel, getTurnOutputTokenLimit, ResponseComplexity } from '../services/ai-config';
import { recordAIUsage } from '../services/ai-usage.service';
import { getAIConfiguration } from '../config/runtime';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { buildConversationInstructions, guardResponseText } from '../services/conversation-intelligence.service';
import { classifyLightweightIntent, extractLightweightMemory } from '../services/turn-routing.service';
import { normalizeAssistantResponse } from '../services/assistant-response.service';

dotenv.config();

const aiConfig = getAIConfiguration();
const llm = new ChatOpenAI({
    model: getAIModel(),
    maxTokens: getAIMaxOutputTokens(),
    temperature: 0,
    maxRetries: 0,
    apiKey: aiConfig.apiKey,
    configuration: aiConfig.baseURL ? { baseURL: aiConfig.baseURL } : undefined,
});

export { llm };

// We might not need tool binding if we rely purely on structured JSON output for actions
// But keeping it for now if we want to support existing tools as fallback
// const modelWithTools = llm.bindTools(tools);

import { AgentState } from './state';

async function callModel(state: AgentState) {
    const businessId = assertTenantBusinessId(state.businessId, 'agent-model');
    if (!state.eventIdentifier) throw new Error('AI event identifier is required');
    // 1. Get the last user message to extract query
    const lastMessage = state.messages[state.messages.length - 1];
    const userQuery = typeof lastMessage.content === 'string' ? lastMessage.content : (lastMessage.content as any[]).filter((part) => part?.type === 'text').map((part) => part.text).join(' ');

    // 2. Retrieve Context (RAG)
    // We need PSID, but if it's missing in state, we might extract from conversationId 'fb_PSID'
    const psid = state.psid || state.conversationId.replace('fb_', '');

    // Only perform RAG if it's a Human Message or we need context
    let contextStr = '{}';
    let operationType: 'chat' | 'rag-assisted-chat' = 'chat';
    const routedIntent = classifyLightweightIntent(userQuery);
    const needsRetrieval = ['PRODUCT_PRICE','PRODUCT_STOCK','PRODUCT_VARIANT','PRODUCT_SEARCH','PRODUCT_COMPARE','KNOWLEDGE','BUSINESS_FACT'].includes(routedIntent);
    if (lastMessage instanceof HumanMessage && needsRetrieval) {
        const context = await retrieveContext(businessId, psid, userQuery, state.messages);
        contextStr = enforceContextBudget(formatContextPack(context), routedIntent === 'KNOWLEDGE' ? 800 : 550);
        if (context.catalogHits.length || context.offeringHits?.length || context.knowledgeEntries.length || context.awarenessEntries?.length || context.lastOrders.length) {
            operationType = 'rag-assisted-chat';
        }
    }

    // 3. Construct the tenant-specific prompt without creating a separate agent.
    const [business, conversation] = await Promise.all([
        Business.findById(businessId).select('name businessType businessSubType customBusinessType preferredLanguage brandVoice').lean(),
        Conversation.findOne({ businessId, conversationId: state.conversationId }).select('platform metadata').lean(),
    ]);
    const intelligence = buildConversationInstructions({ business: business || {}, customerText: userQuery, history: state.messages, channel: conversation?.platform, preferredLanguage: conversation?.metadata?.entityState?.preferredLanguage });
    const entityMemory = extractLightweightMemory(userQuery);
    entityMemory.preferredLanguage = intelligence.language;
    await Conversation.updateOne({ businessId, conversationId: state.conversationId }, { $set: { 'metadata.conversationIntelligence': { stage: intelligence.stage, language: intelligence.language, rememberedPreferences: intelligence.memory, leadFields: intelligence.leadFields, updatedAt: new Date() }, ...Object.fromEntries(Object.entries(entityMemory).map(([key, value]) => [`metadata.entityState.${key}`, value])) } });
    const fullSystemPrompt = `${SYSTEM_PROMPT}${intelligence.prompt}${contextStr !== '{}' ? `\nCONTEXT:\n${contextStr}` : ''}\nNever make a catalog-wide negative claim from limited context. Ask for the product or model name when canonical lookup is inconclusive.`;

    // 4. Call Model
    // We send the full history, but with the updated system prompt at the start
    // Note: LangGraph state messages usually don't include SystemPrompt, we prepend it here
    const candidates = state.messages.filter((message) => message.getType() !== 'system').slice(-4);
    const recentMessages: BaseMessage[] = [];
    let recentCharacters = 0;
    for (const message of [...candidates].reverse()) {
        const size = typeof message.content === 'string' ? message.content.length : JSON.stringify(message.content).length;
        if (recentMessages.length && recentCharacters + size > 2400) continue;
        recentMessages.unshift(message);
        recentCharacters += size;
    }
    const summary = state.messages.find((message) => message.getType() === 'system');
    const messages = [new SystemMessage(fullSystemPrompt), ...(summary ? [summary] : []), ...recentMessages];

    const complexity: ResponseComplexity = routedIntent === 'PRODUCT_COMPARE' || routedIntent === 'PRODUCT_SEARCH' ? 'recommendation' : routedIntent === 'KNOWLEDGE' && /eligibility|medical|legal|visa|refund dispute/i.test(userQuery) ? 'complex' : routedIntent === 'GENERAL_CONVERSATION' ? 'simple' : 'normal';
    const turnLlm = new ChatOpenAI({ model: getAIModel(), maxTokens: getTurnOutputTokenLimit(complexity), temperature: 0, maxRetries: 0, apiKey: aiConfig.apiKey, configuration: aiConfig.baseURL ? { baseURL: aiConfig.baseURL } : undefined });
    const response = await turnLlm.invoke(messages);
    try {
        await recordAIUsage({
            conversationId: state.conversationId,
            eventIdentifier: state.eventIdentifier,
            operationType,
            response,
        });
    } catch (error) {
        // Usage accounting must not discard a successful provider response and trigger a costly retry.
        console.error('Failed to record AI usage:', error);
    }
    const parsed = normalizeAssistantResponse(response.content);
    parsed.message_text = guardResponseText(parsed.message_text, contextStr);
    const guardedResponse: BaseMessage = new AIMessage({ content: JSON.stringify(parsed), response_metadata: response.response_metadata, usage_metadata: response.usage_metadata });
    return { messages: [guardedResponse] };
}

import { Annotation } from '@langchain/langgraph';

// Define the state schema using Annotation.Root
const AgentStateAnnotation = Annotation.Root({
    businessId: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => '',
    }),
    eventIdentifier: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => '',
    }),
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    conversationId: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => '',
    }),
    psid: Annotation<string | undefined>({
        reducer: (x, y) => y ?? x,
        default: () => undefined,
    }),
    agentStatus: Annotation<AgentState['agentStatus']>({
        reducer: (x, y) => y ?? x,
        default: () => 'active',
    }),
    lastHumanActivity: Annotation<number>({
        reducer: (x, y) => y ?? x,
        default: () => Date.now(),
    }),
});

// Define the graph
const workflow = new StateGraph(AgentStateAnnotation)
    .addNode('agent', callModel)
    .addEdge(START, 'agent')
    .addEdge('agent', END); // Direct end for now as we use JSON output, not tool loops

export const aiAgent = workflow.compile();
