import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../models/Conversation';
import { withTenantContext } from '../tenancy/context';
import { invokeIfAIActive, isAIActive, returnConversationToAI, takeOverConversation } from './conversation-control.service';

describe('authoritative conversation control', () => {
    afterEach(() => vi.restoreAllMocks());

    it('allows AI only for AI_ACTIVE conversations', () => {
        expect(isAIActive({ controlMode: 'AI_ACTIVE' } as never)).toBe(true);
        expect(isAIActive({ controlMode: 'HUMAN_ACTIVE' } as never)).toBe(false);
        expect(isAIActive(null)).toBe(false);
    });

    it('AI-active calls AI while human-active never calls AI', async () => {
        const invoke = vi.fn().mockResolvedValue('reply');
        vi.spyOn(Conversation, 'findOne')
            .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ _id: 'active' }) }) } as never)
            .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve(null) }) } as never);
        await expect(invokeIfAIActive('active-conversation', invoke)).resolves.toBe('reply');
        await expect(invokeIfAIActive('human-conversation', invoke)).resolves.toBeNull();
        expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('takeover and return-to-AI write one consistent state', async () => {
        const update = vi.spyOn(Conversation, 'findOneAndUpdate')
            .mockResolvedValueOnce({ controlMode: 'HUMAN_ACTIVE' } as never)
            .mockResolvedValueOnce({ controlMode: 'AI_ACTIVE' } as never);
        await takeOverConversation('conversation-1');
        await returnConversationToAI('conversation-1');
        expect(update.mock.calls[0][1]).toMatchObject({ $set: {
            controlMode: 'HUMAN_ACTIVE', aiEnabled: false, needsHumanHandoff: true,
        } });
        expect(update.mock.calls[1][1]).toMatchObject({ $set: {
            controlMode: 'AI_ACTIVE', aiEnabled: true, needsHumanHandoff: false,
        } });
    });

    it('a Business A takeover cannot match a Business B conversation', async () => {
        const businessA = new mongoose.Types.ObjectId();
        const businessBConversation = new mongoose.Types.ObjectId();
        const collectionUpdate = vi.spyOn(Conversation.collection, 'findOneAndUpdate').mockResolvedValue(null);
        await withTenantContext({ businessId: businessA.toString(), userId: 'u', membershipId: 'm', role: 'Staff' },
            () => takeOverConversation(businessBConversation.toString()));
        const filter = collectionUpdate.mock.calls[0][0] as any;
        expect(filter.businessId.toString()).toBe(businessA.toString());
    });
});
