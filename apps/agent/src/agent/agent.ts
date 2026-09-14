import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { loadEnv } from '../config/env';
// Tools import removed
import { SYSTEM_PROMPT } from './prompts';
import { retrieveContext, formatContextPack, enforceContextBudget } from '../services/rag.service';
import { assertTenantBusinessId } from '../tenancy/context';
import { getAIHistoryCharBudget, getAIHistoryMessageCharCap, getAIMaxOutputTokens, getAIModel, getAIRecentMessageLimit, getTurnOutputTokenLimit, ResponseComplexity } from '../services/ai-config';
import { recordAIUsage } from '../services/ai-usage.service';
import { getAIConfiguration } from '../config/runtime';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { buildConversationInstructions, guardResponseText, resolveConversationLanguage, type ConversationLanguage } from '../services/conversation-intelligence.service';
import { classifyLightweightIntent, extractLightweightMemory } from '../services/turn-routing.service';
import { extractTurnMemory, memoryPromptLine, mergeMemory } from '../services/conversation-memory.service';
import { computeSalesSignals, buildSalesContextSnippet } from '../services/sales-intelligence.service';
import { normalizeAssistantResponse } from '../services/assistant-response.service';


loadEnv();

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

/**
 * One earlier turn, shortened to what it contributes to the thread.
 *
 * A five-product catalog listing is roughly nine hundred characters, and re-sent
 * in full it crowded out every other turn in the window. The opening of a reply
 * carries what it was about; the codes and prices live in the live context pack
 * and the entity memory, so nothing factual is lost by cutting the tail.
 * Multimodal turns are left alone — an image part is not text to truncate.
 */
function truncateHistoryMessage(message: BaseMessage): BaseMessage {
    const cap = getAIHistoryMessageCharCap();
    if (typeof message.content !== 'string' || message.content.length <= cap) return message;
    const shortened = `${message.content.slice(0, cap).trimEnd()}…`;
    return message.getType() === 'ai' ? new AIMessage(shortened) : new HumanMessage(shortened);
}

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
    const needsRetrieval = ['PRODUCT_PRICE','PRODUCT_STOCK','PRODUCT_VARIANT','PRODUCT_SEARCH','PRODUCT_COMPARE','CATALOG_BROWSE','KNOWLEDGE','BUSINESS_FACT'].includes(routedIntent);
    if (lastMessage instanceof HumanMessage && needsRetrieval) {
        const context = await retrieveContext(businessId, psid, userQuery, state.messages);
        contextStr = enforceContextBudget(formatContextPack(context), routedIntent === 'KNOWLEDGE' ? 650 : routedIntent === 'CATALOG_BROWSE' ? 700 : 500);
        if (context.catalogHits.length || context.offeringHits?.length || context.knowledgeEntries.length || context.awarenessEntries?.length || context.lastOrders.length) {
            operationType = 'rag-assisted-chat';
        }
    }

    // 3. Construct the tenant-specific prompt without creating a separate agent.
    const [business, conversation] = await Promise.all([
        Business.findById(businessId).select('name businessType businessSubType customBusinessType preferredLanguage brandVoice salesPlaybook').lean(),
        Conversation.findOne({ businessId, conversationId: state.conversationId }).select('platform metadata salesStage').lean(),
    ]);
    // The language the conversation has settled into, not just the one this
    // message happens to look like. Without it a one-word "ok" inside a Bangla
    // thread re-detected as English and flipped every later reply — the zero-LLM
    // path has always carried this, which is why Banglish felt stable and Bangla
    // and English did not.
    const rememberedLanguage = conversation?.metadata?.entityState?.preferredLanguage as ConversationLanguage | undefined;
    const intelligence = buildConversationInstructions({ business: business || {}, customerText: userQuery, history: state.messages, channel: conversation?.platform, preferredLanguage: rememberedLanguage });
    const turnLanguage = resolveConversationLanguage(userQuery, rememberedLanguage);
    const entityMemory = { ...extractLightweightMemory(userQuery), ...extractTurnMemory(userQuery), preferredLanguage: turnLanguage };
    // One short line carries what the recent-message window dropped.
    const carriedMemory = mergeMemory(conversation?.metadata?.entityState, entityMemory);

    // Compute sales signals — pure synchronous, zero LLM call, zero DB call
    const currentSalesStage = conversation?.salesStage;
    const hasActiveProduct = Boolean(conversation?.metadata?.entityState?.activeProductId);
    const salesSignals = computeSalesSignals(userQuery, routedIntent, currentSalesStage, hasActiveProduct);
    const salesSnippet = buildSalesContextSnippet(salesSignals, business?.salesPlaybook ?? undefined);

    // Persist conversationIntelligence + salesStage in a single combined updateOne (no extra DB round-trip)
    await Conversation.updateOne({ businessId, conversationId: state.conversationId }, {
        $set: {
            'metadata.conversationIntelligence': {
                stage: intelligence.stage,
                language: intelligence.language,
                rememberedPreferences: intelligence.memory,
                leadFields: intelligence.leadFields,
                updatedAt: new Date(),
            },
            salesStage: salesSignals.salesStage,
            'metadata.salesIntelligence': {
                intentScore: salesSignals.intentScore,
                nextBestAction: salesSignals.nextBestAction,
                updatedAt: new Date(),
            },
            ...Object.fromEntries(Object.entries(entityMemory).map(([key, value]) => [`metadata.entityState.${key}`, value])),
        },
    });
    const memoryLine = memoryPromptLine(carriedMemory);
    const fullSystemPrompt = `${SYSTEM_PROMPT}${intelligence.prompt}\n${salesSnippet}${memoryLine ? `\n${memoryLine}` : ''}${contextStr !== '{}' ? `\nCONTEXT:\n${contextStr}` : ''}`;


    // 4. Call Model
    // We send the full history, but with the updated system prompt at the start
    // Note: LangGraph state messages usually don't include SystemPrompt, we prepend it here
    //
    // The window used to be four messages — two exchanges — no matter what
    // AI_RECENT_MESSAGE_LIMIT said, and one long catalog listing could eat the
    // whole character budget on its own. Capping each message instead lets the
    // same budget carry several more turns, which is what the customer notices
    // as the assistant remembering the conversation.
    const candidates = state.messages.filter((message) => message.getType() !== 'system').slice(-getAIRecentMessageLimit());
    const recentMessages: BaseMessage[] = [];
    let recentCharacters = 0;
    for (const message of [...candidates].reverse()) {
        const trimmed = truncateHistoryMessage(message);
        const size = typeof trimmed.content === 'string' ? trimmed.content.length : JSON.stringify(trimmed.content).length;
        // Stop at the budget rather than skipping past it: keeping older messages
        // while dropping a newer one leaves a hole in the middle of the thread.
        if (recentMessages.length && recentCharacters + size > getAIHistoryCharBudget()) break;
        recentMessages.unshift(trimmed);
        recentCharacters += size;
    }
    const summary = state.messages.find((message) => message.getType() === 'system');
    const messages = [new SystemMessage(fullSystemPrompt), ...(summary ? [summary] : []), ...recentMessages];

    const complexity: ResponseComplexity = routedIntent === 'PRODUCT_COMPARE' || routedIntent === 'PRODUCT_SEARCH' || routedIntent === 'CATALOG_BROWSE' ? 'recommendation' : routedIntent === 'KNOWLEDGE' && /eligibility|medical|legal|visa|refund dispute/i.test(userQuery) ? 'complex' : routedIntent === 'GENERAL_CONVERSATION' ? 'simple' : 'normal';
    const turnLlm = new ChatOpenAI({ model: getAIModel(), maxTokens: getTurnOutputTokenLimit(complexity), temperature: 0, maxRetries: 0, apiKey: aiConfig.apiKey, configuration: aiConfig.baseURL ? { baseURL: aiConfig.baseURL } : undefined, modelKwargs: { reasoning_effort: 'low' } });
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
    const normalized = normalizeAssistantResponse(response.content, turnLanguage);
    normalized.message_text = guardResponseText(normalized.message_text, contextStr);
    const guardedResponse = new AIMessage({
        content: JSON.stringify(normalized),
        response_metadata: response.response_metadata,
        usage_metadata: response.usage_metadata,
    });
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
