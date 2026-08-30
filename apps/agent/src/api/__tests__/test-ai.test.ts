import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_AI_API } from '@edutechs/shared';
import { authenticate } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { Conversation } from '../../models/Conversation';
import { Message } from '../../models/Message';
import { AIUsage } from '../../models/AIUsage';
import { Business } from '../../models/Business';
import testAiRoutes from '../test-ai.routes';
import { processChatTurn } from '../../services/chat-turn.service';
import { User } from '../../models/User'; import { MerchantActivity } from '../../models/MerchantActivity';

vi.mock('../../services/chat-turn.service', () => ({ processChatTurn: vi.fn() }));
vi.mock('../../services/ingestion/url-security', () => ({ validatePublicUrl: vi.fn(async (value: string) => new URL(value)) }));

const app = express().use(express.json()).use(TEST_AI_API.base, authenticate, testAiRoutes);
const endpoint = (path: string) => `${TEST_AI_API.base}${path}`;
const businessId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const membershipId = new mongoose.Types.ObjectId();
const conversation = { conversationId: 'test-conversation', controlMode: 'AI_ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('canonical tenant-safe Test AI routes', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
        vi.restoreAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as any);
        vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as any);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as any);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({} as any);vi.spyOn(User,'updateOne').mockResolvedValue({} as any);
        vi.spyOn(Message, 'find').mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) } as any);
        vi.spyOn(AIUsage, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as any);
        vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({} as any);
    });

    const token = () => signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });
    const authenticated = (requestBuilder: request.Test) => requestBuilder.set('authorization', `Bearer ${token()}`);

    it('gets the current persisted conversation using tenant context and owner identity', async () => {
        const find = vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(conversation) } as any);
        const response = await authenticated(request(app).get(endpoint(TEST_AI_API.currentConversation))).expect(200);

        expect(find).toHaveBeenCalledWith(expect.objectContaining({ platform: 'manual', status: 'active', 'metadata.testMode': true, 'metadata.ownerUserId': userId.toString() }));
        expect(response.body.conversation.id).toBe('test-conversation');
    });

    it('loads current message history through the canonical history endpoint', async () => {
        vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(conversation) } as any);
        const response = await authenticated(request(app).get(endpoint(TEST_AI_API.currentMessages))).expect(200);

        expect(response.body).toMatchObject({ conversation: { id: 'test-conversation' }, messages: [] });
    });

    it('uses the exact dashboard POST endpoint and invokes the real pipeline boundary', async () => {
        const find = vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(conversation) } as any);
        vi.mocked(processChatTurn).mockResolvedValue({ status: 200, body: { conversationId: conversation.conversationId, reply: 'Hello!' } } as any);
        expect(endpoint(TEST_AI_API.currentMessages)).toBe('/api/test-ai/conversations/current/messages');

        const response = await authenticated(request(app).post(endpoint(TEST_AI_API.currentMessages)))
            .send({ message: 'Hi', conversationId: 'obsolete-client-id' })
            .expect(200);

        expect(find).toHaveBeenCalledWith(expect.not.objectContaining({ conversationId: 'obsolete-client-id' }));
        expect(processChatTurn).toHaveBeenCalledWith(expect.objectContaining({ businessId: businessId.toString(), conversationId: conversation.conversationId, message: 'Hi', source: 'test' }));
        expect(response.body.reply).toBe('Hello!');
    });

    it('passes image-only input into the same authenticated tenant chat pipeline', async () => {
        vi.spyOn(Conversation, 'findOne').mockReturnValue({ sort: vi.fn().mockResolvedValue(conversation) } as any);
        vi.mocked(processChatTurn).mockResolvedValue({ status: 200, body: { conversationId: conversation.conversationId, reply: 'No confident match.' } } as any);
        await authenticated(request(app).post(endpoint(TEST_AI_API.currentMessages)))
            .send({ imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' })
            .expect(200);
        expect(processChatTurn).toHaveBeenCalledWith(expect.objectContaining({
            businessId: businessId.toString(), conversationId: conversation.conversationId,
            imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', message: '', source: 'test',
        }));
    });

    it('starts a new owned conversation and archives only the current owner test conversation', async () => {
        const updateMany = vi.spyOn(Conversation, 'updateMany').mockResolvedValue({ acknowledged: true } as any);
        vi.spyOn(Conversation, 'create').mockResolvedValue(conversation as any);

        const response = await authenticated(request(app).post(endpoint(TEST_AI_API.conversations))).expect(201);

        expect(updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ platform: 'manual', status: 'active', 'metadata.ownerUserId': userId.toString() }),
            { $set: { status: 'archived' } }
        );
        expect(response.body.conversation.id).toBe('test-conversation');
    });

    it('removes the obsolete message route', async () => {
        await authenticated(request(app).post(`${TEST_AI_API.base}/messages`)).send({ message: 'Hi' }).expect(404);
    });
});
