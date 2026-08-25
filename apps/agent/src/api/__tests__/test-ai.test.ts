import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { Conversation } from '../../models/Conversation';
import { Message } from '../../models/Message';
import { AIUsage } from '../../models/AIUsage';
import { Business } from '../../models/Business';
import testAiRoutes from '../test-ai.routes';
import { processChatTurn } from '../../services/chat-turn.service';

vi.mock('../../services/chat-turn.service', () => ({ processChatTurn: vi.fn() }));

const app = express().use(express.json()).use('/api/test-ai', authenticate, testAiRoutes);
const businessId = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId(); const membershipId = new mongoose.Types.ObjectId();
const conversation = { conversationId: 'test-conversation', controlMode: 'AI_ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('tenant-safe Test AI routes', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'; vi.restoreAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as any);
        vi.spyOn(Message, 'find').mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) } as any);
        vi.spyOn(AIUsage, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as any);
        vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({} as any);
    });
    const token = () => signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });

    it('loads persisted history using both tenant context and owner identity', async () => {
        const find = vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(conversation) } as any);
        const response = await request(app).get('/api/test-ai').set('authorization', `Bearer ${token()}`).expect(200);
        expect(find).toHaveBeenCalledWith(expect.objectContaining({ platform: 'manual', 'metadata.testMode': true, 'metadata.ownerUserId': userId.toString() }));
        expect(response.body.conversation.id).toBe('test-conversation');
    });

    it('rejects access to a conversation not owned by the authenticated user', async () => {
        vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(null) } as any);
        await request(app).post('/api/test-ai/messages').set('authorization', `Bearer ${token()}`).send({ conversationId: 'another-merchants-chat', message: 'Hi' }).expect(404);
        expect(processChatTurn).not.toHaveBeenCalled();
    });

    it('calls the real pipeline boundary with authenticated business context and returns persisted history', async () => {
        vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(conversation) } as any);
        vi.mocked(processChatTurn).mockResolvedValue({ status: 200, body: { conversationId: conversation.conversationId, reply: 'Hello!' } } as any);
        const response = await request(app).post('/api/test-ai/messages').set('authorization', `Bearer ${token()}`).send({ conversationId: conversation.conversationId, message: 'Hi' }).expect(200);
        expect(processChatTurn).toHaveBeenCalledWith(expect.objectContaining({ businessId: businessId.toString(), conversationId: conversation.conversationId, message: 'Hi', source: 'test' }));
        expect(response.body.reply).toBe('Hello!');
    });
});
