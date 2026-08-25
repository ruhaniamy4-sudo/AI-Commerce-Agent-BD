import { Router } from 'express';
import { logError } from '../services/error.service';
import { processChatTurn } from '../services/chat-turn.service';
import { requireTenantContext } from '../tenancy/context';

const router = Router();

router.post('/', async (req, res) => {
    const { businessId } = requireTenantContext();
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : undefined;
    if (!message && !imageUrl) return res.status(400).json({ error: 'Message or imageUrl is required' });
    if (message.length > 4000) return res.status(400).json({ error: 'Message is too long' });
    const eventIdentifier = String(req.headers['idempotency-key'] || req.body?.messageId || '');
    try {
        const result = await processChatTurn({ businessId, message, conversationId: req.body?.conversationId, imageUrl, eventIdentifier: eventIdentifier || undefined, source: 'web' });
        return res.status(result.status).json(result.body);
    } catch (error) {
        await logError('CHAT_API_ERROR', error, { conversationId: req.body?.conversationId, hasMessage: Boolean(message), hasImage: Boolean(imageUrl) });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
