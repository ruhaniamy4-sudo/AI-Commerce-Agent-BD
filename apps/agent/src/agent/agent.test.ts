import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';

// Mock RAG Service
vi.mock('../services/rag.service', () => ({
    retrieveContext: vi.fn().mockResolvedValue({}),
    formatContextPack: vi.fn().mockReturnValue('{}'),
}));

// Hoist mock function
const { mockInvoke } = vi.hoisted(() => {
    return { mockInvoke: vi.fn() };
});

// Mock OpenAI
vi.mock('@langchain/openai', () => {
    class MockChatOpenAI {
        constructor() { }
        invoke = mockInvoke;
        bindTools = vi.fn().mockReturnThis();
    }
    return {
        ChatOpenAI: MockChatOpenAI,
    };
});

// Import Agent (will use mocks)
import { aiAgent } from './agent';

describe('AI Agent Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should process a human message and return a JSON response', async () => {
        // Mock LLM response
        const mockJson = JSON.stringify({
            type: 'reply',
            content: 'Hello! I am ready to help.',
            actions: []
        });

        mockInvoke.mockResolvedValue({
            content: mockJson,
            // standard message fields
            id: 'msg_123',
            additional_kwargs: {}
        });

        // Run Agent
        const initialState = {
            messages: [new HumanMessage('Hi there')],
            conversationId: 'fb_12345',
            psid: '12345',
            agentStatus: 'active' as const,
            lastHumanActivity: Date.now()
        };

        const result = await aiAgent.invoke(initialState);

        // Assertions
        expect(mockInvoke).toHaveBeenCalledTimes(1);

        // Result messages should contain the response
        const messages = result.messages;
        const lastMsg = messages[messages.length - 1];

        expect(lastMsg.content).toBe(mockJson);
    });
});
