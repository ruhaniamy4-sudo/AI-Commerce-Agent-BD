import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { withTenantContext } from '../tenancy/context';
import { retrieveContext } from '../services/rag.service';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';

// Mock RAG Service
vi.mock('../services/rag.service', () => ({
    retrieveContext: vi.fn().mockResolvedValue({ catalogHits: [], knowledgeEntries: [], lastOrders: [] }),
    formatContextPack: vi.fn().mockReturnValue('{}'),
    enforceContextBudget: vi.fn((pack: string) => pack),
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

describe('the window the model actually sees', () => {
    const businessId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ name: 'Test Shop', businessType: 'Fashion', brandVoice: { language: 'auto' } }) }) } as never);
        vi.spyOn(Conversation, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ platform: 'facebook', metadata: {} }) }) } as never);
        vi.spyOn(Conversation, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
        mockInvoke.mockResolvedValue({ content: JSON.stringify({ language: 'en', message_text: 'ok', action: 'none' }), id: 'm', additional_kwargs: {} });
    });

    afterEach(() => {
        delete process.env.AI_RECENT_MESSAGE_LIMIT;
        delete process.env.AI_HISTORY_MESSAGE_CHAR_CAP;
    });

    const run = (messages: any[]) => withTenantContext(
        { businessId, userId: 'u', membershipId: 'm', role: 'Staff' },
        () => aiAgent.invoke({ businessId, eventIdentifier: 'event-window', messages, conversationId: 'fb_1', psid: '1', agentStatus: 'active' as const, lastHumanActivity: Date.now() }),
    );

    it('honours AI_RECENT_MESSAGE_LIMIT instead of a hard-coded two exchanges', async () => {
        // The limit was configurable, loaded from the database, and then thrown
        // away by a literal slice(-4): the assistant forgot anything older than
        // two exchanges no matter how the merchant had configured it.
        process.env.AI_RECENT_MESSAGE_LIMIT = '10';
        const transcript = Array.from({ length: 10 }, (_, index) =>
            index % 2 === 0 ? new HumanMessage(`customer ${index}`) : new AIMessage(`assistant ${index}`));
        await run(transcript);

        const sent = mockInvoke.mock.calls[0][0];
        // One system prompt plus the ten remembered turns.
        expect(sent).toHaveLength(11);
        expect(String(sent[1].content)).toContain('customer 0');
    });

    it('trims a long reply instead of letting it crowd out every other turn', async () => {
        process.env.AI_RECENT_MESSAGE_LIMIT = '6';
        process.env.AI_HISTORY_MESSAGE_CHAR_CAP = '120';
        const listing = new AIMessage('1. Ceramic Mug, CER-9F2A, 999 taka\n'.repeat(40));
        await run([
            new HumanMessage('ki ki mug ache?'), listing,
            new HumanMessage('CER-9F2A tar dam koto?'), new AIMessage('CER-9F2A, 999 taka.'),
            new HumanMessage('2 ta nibo'),
        ]);

        const sent = mockInvoke.mock.calls[0][0];
        // Nothing is dropped: the oversized listing is shortened, not evicted.
        expect(sent).toHaveLength(6);
        expect(String(sent[2].content).length).toBeLessThanOrEqual(121);
        expect(String(sent[5].content)).toBe('2 ta nibo');
    });
});
