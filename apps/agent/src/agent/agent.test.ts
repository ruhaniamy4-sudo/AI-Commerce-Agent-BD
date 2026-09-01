import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { withTenantContext } from '../tenancy/context';
import { retrieveContext } from '../services/rag.service';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';

// Mock RAG Service
vi.mock('../services/rag.service', () => ({
    retrieveContext: vi.fn().mockResolvedValue({ catalogHits: [], knowledgeEntries: [], lastOrders: [] }),
    formatContextPack: vi.fn().mockReturnValue('{}'),
}));

vi.mock('../services/ai-usage.service', () => ({
    recordAIUsage: vi.fn().mockResolvedValue(undefined),
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
        vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ name: 'Test Shop', businessType: 'Fashion', brandVoice: { language: 'auto' } }) }) } as never);
        vi.spyOn(Conversation, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ platform: 'facebook', metadata: {} }) }) } as never);
        vi.spyOn(Conversation, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
    });

    it('should process a human message and return a JSON response', async () => {
        const businessId = new mongoose.Types.ObjectId().toString();
        // Mock LLM response
        const mockJson = JSON.stringify({
            language: 'en', message_text: 'Hello! I am ready to help.', suggested_products: [], action: 'none', action_payload: {},
        });

        mockInvoke.mockResolvedValue({
            content: mockJson,
            // standard message fields
            id: 'msg_123',
            additional_kwargs: {}
        });

        // Run Agent
        const initialState = {
            businessId,
            eventIdentifier: 'event-agent-test',
            messages: [new HumanMessage('Hi there')],
            conversationId: 'fb_12345',
            psid: '12345',
            agentStatus: 'active' as const,
            lastHumanActivity: Date.now()
        };

        const result = await withTenantContext({
            businessId,
            userId: 'agent-test',
            membershipId: 'agent-test',
            role: 'Staff',
        }, () => aiAgent.invoke(initialState));

        // Assertions
        expect(mockInvoke).toHaveBeenCalledTimes(1);
        expect(retrieveContext).not.toHaveBeenCalled();

        // Result messages should contain the response
        const messages = result.messages;
        const lastMsg = messages[messages.length - 1];

        expect(JSON.parse(String(lastMsg.content))).toEqual({
            language: 'en', message_text: 'Hello! I am ready to help.', suggested_products: [],
            action: 'none', action_payload: {}, quick_replies: [],
        });
    });
});
