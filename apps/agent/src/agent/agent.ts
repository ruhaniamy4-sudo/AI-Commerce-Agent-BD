import { BaseMessage, SystemMessage, HumanMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import * as dotenv from 'dotenv';
// Tools import removed
import { SYSTEM_PROMPT } from './prompts';
import { retrieveContext, formatContextPack } from '../services/rag.service';
import { assertTenantBusinessId } from '../tenancy/context';
import { getAIMaxOutputTokens, getAIModel } from '../services/ai-config';
import { recordAIUsage } from '../services/ai-usage.service';
import { getAIConfiguration } from '../config/runtime';

dotenv.config();

const aiConfig = getAIConfiguration();
const llm = new ChatOpenAI({
    model: getAIModel(),
    maxTokens: getAIMaxOutputTokens(),
    temperature: 0,
    apiKey: aiConfig.apiKey,
    configuration: aiConfig.baseURL ? { baseURL: aiConfig.baseURL } : undefined,
    modelKwargs: { response_format: { type: 'json_object' } } // Enforce JSON
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
    const userQuery = lastMessage.content.toString();

    // 2. Retrieve Context (RAG)
    // We need PSID, but if it's missing in state, we might extract from conversationId 'fb_PSID'
    const psid = state.psid || state.conversationId.replace('fb_', '');

    // Only perform RAG if it's a Human Message or we need context
    let contextStr = '{}';
    let operationType: 'chat' | 'rag-assisted-chat' = 'chat';
    if (lastMessage instanceof HumanMessage) {
        const context = await retrieveContext(businessId, psid, userQuery, state.messages);
        contextStr = formatContextPack(context);
        if (context.catalogHits.length || context.knowledgeEntries.length || context.lastOrders.length) {
            operationType = 'rag-assisted-chat';
        }
    }

    // 3. Construct System Prompt with Context
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nCONTEXT PACK:\n${contextStr}`;

    // 4. Call Model
    // We send the full history, but with the updated system prompt at the start
    // Note: LangGraph state messages usually don't include SystemPrompt, we prepend it here
    const messages = [new SystemMessage(fullSystemPrompt), ...state.messages];

    const response = await llm.invoke(messages);
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
    return { messages: [response] };
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
