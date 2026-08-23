import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createOrder } = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock('./checkout.service', () => ({ createOrder }));

import { withTenantContext } from '../tenancy/context';
import { executeAgentAction } from './agent-action.service';
import { Conversation } from '../models/Conversation';

describe('agent action confirmation safety', () => {
    const businessId = '507f1f77bcf86cd799439011';
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Conversation, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ _id: 'conversation-1' }) }),
        } as never);
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
});
