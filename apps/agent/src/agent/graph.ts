import { BaseMessage } from '@langchain/core/messages';
import { Annotation, START, StateGraph } from '@langchain/langgraph';
import { aiAgent } from './agent';
import { AgentState } from './state';

// Define the state schema using Annotation.Root to ensure runtime validation and correct reducer application
const GraphState = Annotation.Root({
    conversationId: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => 'default_id',
    }),
    agentStatus: Annotation<AgentState['agentStatus']>({
        reducer: (x, y) => y ?? x,
        default: () => 'active',
    }),
    lastHumanActivity: Annotation<number>({
        reducer: (x, y) => y ?? x,
        default: () => Date.now(),
    }),
    messages: Annotation<AgentState['messages']>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    psid: Annotation<string | undefined>({
        reducer: (x, y) => y ?? x,
        default: () => undefined,
    }),
});

const graph = new StateGraph(GraphState)
    .addNode('chat', async (state) => {
        if (state.agentStatus !== 'active') {
            return { messages: [] };
        }

        const response = await aiAgent.invoke(
            {
                messages: state.messages as BaseMessage[],
                conversationId: state.conversationId as string,
                psid: state.psid,
            },
            { configurable: { conversationId: state.conversationId } }
        );

        // The createAgent internal loop has finished.
        // We want to return only the NEW messages produced in this turn.
        const newMessages = (response.messages as BaseMessage[]).slice(
            state.messages.length
        );

        return {
            messages: newMessages,
        };
    })
    .addEdge(START, 'chat');

export const agentGraph = graph.compile();
