import crypto from 'node:crypto';
import { Router } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { AIUsage } from '../models/AIUsage';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { processChatTurn } from '../services/chat-turn.service';
import { tenantDocument } from '../tenancy/context';

const router = Router();

async function findOwnedConversation(req: AuthenticatedRequest, conversationId?: string) {
    const query: Record<string, unknown> = { platform: 'manual', 'metadata.testMode': true, 'metadata.ownerUserId': req.auth!.userId };
    if (conversationId) query.conversationId = conversationId;
    return Conversation.findOne(query).sort({ updatedAt: -1 });
}

async function conversationPayload(req: AuthenticatedRequest, conversation: InstanceType<typeof Conversation> | null) {
    if (!conversation) return { conversation: null, messages: [], usage: { aiReplies: 0, totalTokens: 0, estimatedCost: 0 } };
    const [messages, usageRows] = await Promise.all([
        Message.find({ conversationId: conversation.conversationId }).sort({ createdAt: 1 }).limit(200).lean(),
        AIUsage.find({ conversationId: conversation.conversationId }).lean(),
    ]);
    return {
        conversation: { id: conversation.conversationId, controlMode: conversation.controlMode, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt },
        messages: messages.map((message: any) => ({ id: message._id, role: message.role, content: message.content, createdAt: message.createdAt })),
        usage: {
            aiReplies: usageRows.length,
            totalTokens: usageRows.reduce((sum, row) => sum + (row.totalTokens || 0), 0),
            estimatedCost: usageRows.reduce((sum, row) => sum + (row.estimatedCost || 0), 0),
        },
    };
}

router.get('/', async (req: AuthenticatedRequest, res) => {
    res.json(await conversationPayload(req, await findOwnedConversation(req)));
});

router.post('/conversations', async (req: AuthenticatedRequest, res) => {
    await Conversation.updateMany({ platform: 'manual', 'metadata.testMode': true, 'metadata.ownerUserId': req.auth!.userId, status: 'active' }, { $set: { status: 'archived' } });
    const conversationId = `test_${req.auth!.businessId}_${req.auth!.userId}_${crypto.randomUUID()}`;
    const conversation = await Conversation.create(tenantDocument({
        conversationId, psid: `test:${req.auth!.userId}`, platform: 'manual', status: 'active',
        metadata: { testMode: true, ownerUserId: req.auth!.userId, source: 'merchant-sandbox' },
    }));
    res.status(201).json(await conversationPayload(req, conversation));
});

router.post('/messages', async (req: AuthenticatedRequest, res) => {
    const message = String(req.body?.message || '').trim();
    if (!message || message.length > 2000) return res.status(400).json({ error: 'Enter a message up to 2000 characters' });
    let conversation = await findOwnedConversation(req, req.body?.conversationId);
    if (!conversation && !req.body?.conversationId) {
        const conversationId = `test_${req.auth!.businessId}_${req.auth!.userId}_${crypto.randomUUID()}`;
        conversation = await Conversation.create(tenantDocument({ conversationId, psid: `test:${req.auth!.userId}`, platform: 'manual', status: 'active', metadata: { testMode: true, ownerUserId: req.auth!.userId, source: 'merchant-sandbox' } }));
    }
    if (!conversation) return res.status(404).json({ error: 'Test conversation not found' });
    const result = await processChatTurn({
        businessId: req.auth!.businessId, conversationId: conversation.conversationId, message,
        eventIdentifier: String(req.headers['idempotency-key'] || crypto.randomUUID()), source: 'test',
    });
    await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'onboarding.aiTested': true } });
    res.status(result.status).json({ ...result.body, ...(await conversationPayload(req, conversation)) });
});

export default router;
