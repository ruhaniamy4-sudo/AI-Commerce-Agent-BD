import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { withTenantContext } from '../tenancy/context';
import { loadConversationHistory } from './history.service';

describe('bounded conversation context', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.AI_RECENT_MESSAGE_LIMIT;
    });

    it('loads only the configured recent raw messages and prepends the summary', async () => {
        process.env.AI_RECENT_MESSAGE_LIMIT = '4';
        vi.spyOn(Conversation, 'findOne').mockReturnValue({
            select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ summary: 'Customer wants a blue laptop.' }) }),
        } as never);
        const limit = vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
                { role: 'user', content: 'four' }, { role: 'assistant', content: 'three' },
                { role: 'user', content: 'two' }, { role: 'assistant', content: 'one' },
            ]),
        });
        vi.spyOn(Message, 'find').mockReturnValue({
            sort: vi.fn().mockReturnValue({ limit }),
        } as never);
        const businessId = '507f1f77bcf86cd799439011';
        const history = await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' },
            () => loadConversationHistory(businessId, 'conversation-1'));
        expect(limit).toHaveBeenCalledWith(4);
        expect(history).toHaveLength(5);
        expect(history[0].content.toString()).toContain('blue laptop');
        expect(history.slice(1).map((item) => item.content.toString())).toEqual(['one', 'two', 'three', 'four']);
    });
});
