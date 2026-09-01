import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createOrder } = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock('./checkout.service', () => ({ createOrder }));

import { withTenantContext } from '../tenancy/context';
import { executeAgentAction, parseAgentResponse } from './agent-action.service';
import { Conversation } from '../models/Conversation';

describe('agent action confirmation safety', () => {
    const businessId = '507f1f77bcf86cd799439011';
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Conversation, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ _id: 'conversation-1' }) }),
        } as never);
    });

    it('never exposes malformed provider JSON as customer chat text', () => {
        const response = parseAgentResponse('{"language":"en","message_text":"hello"');
        expect(response.message_text).not.toContain('{');
        expect(response.message_text).not.toContain('message_text');
    });

    it('extracts customer text from valid, fenced, and double-encoded provider JSON', () => {
        expect(parseAgentResponse('{"message_text":"hello","action":"none"}').message_text).toBe('hello');
        expect(parseAgentResponse('```json\n{"message_text":"welcome"}\n```').message_text).toBe('welcome');
        expect(parseAgentResponse(JSON.stringify(JSON.stringify({ message_text: 'nested' }))).message_text).toBe('nested');
    });

    it('normalizes provider content arrays without exposing their structure', () => {
        const response = parseAgentResponse([{ type: 'text', text: '{"message_text":"array hello"}' }]);
        expect(response.message_text).toBe('array hello');
        expect(response.message_text).not.toContain('message_text');
    });

    it('never represents a failed order action as successful', async () => {
        createOrder.mockResolvedValue({ success: false, error: 'Insufficient stock' });
        const response = { message_text: 'I will place that order.', action: 'create_order' };
        await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            executeAgentAction({
                businessId,
                conversationId: 'conversation-1',
                psid: 'customer-1',
                eventIdentifier: 'event-1',
                response,
            })
        );
        expect(response).toMatchObject({ action_result: { confirmed: false } });
        expect(response.message_text).not.toContain('created successfully');
        expect(response.message_text).toContain('could not confirm');
    });

    it('moves an AI-requested handoff to human control while preserving the conversation', async () => {
        const update = vi.spyOn(Conversation, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
        const response = { message_text: 'Connecting you.', action: 'handoff', action_payload: { reason: 'Customer requested a person' } };
        await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () => executeAgentAction({ businessId, conversationId: 'conversation-1', psid: 'customer-1', eventIdentifier: 'event-2', response }));
        expect(update).toHaveBeenCalledWith({ conversationId: 'conversation-1' }, expect.objectContaining({ controlMode: 'HUMAN_ACTIVE', needsHumanHandoff: true }));
        expect(response.message_text).toContain('human agent');
    });
});
