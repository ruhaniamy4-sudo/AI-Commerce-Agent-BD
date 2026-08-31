import dotenv from 'dotenv';
import express, { Router } from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '../models/WebhookEvent';
import { webhookQueue } from '../services/queue.service';
import { logError } from '../services/error.service';
import { BusinessChannel } from '../models/BusinessChannel';
import { withTenantContext } from '../tenancy/context';
import { registerInboundEvent } from '../services/inbound-idempotency.service';
import { getMetaConfig } from '../services/meta-config.service';

dotenv.config();

const router = Router();
type RawBodyRequest = express.Request & { rawBody?: Buffer };

// Middleware to verify signature
export const verifySignature = (req: RawBodyRequest, res: express.Response, next: express.NextFunction) => {
    const APP_SECRET = getMetaConfig().appSecret;
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || !APP_SECRET) {
        return res.sendStatus(403);
    }

    if (typeof signature !== 'string') return res.sendStatus(403);
    const [algorithm, signatureHash] = signature.split('=');
    if (algorithm !== 'sha256' || !signatureHash || !req.rawBody) {
        return res.sendStatus(403);
    }
    const expectedHash = crypto
        .createHmac('sha256', APP_SECRET)
        .update(req.rawBody)
        .digest('hex');

    const supplied = Buffer.from(signatureHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        console.warn('Invalid signature');
        return res.sendStatus(403);
    }
    next();
};

// Webhook verification (GET)
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = getMetaConfig().verifyToken;
    if (mode && token && challenge && VERIFY_TOKEN) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else res.sendStatus(403);
});

// Handling messages (POST)
router.post('/', verifySignature, async (req, res) => {
    const body = req.body;

    try {
        if (body.object === 'page') {
            // Process each entry
            for (const entry of body.entry) {
                const pageId = entry.id;
                const channel = await BusinessChannel.findOne({
                    platform: 'facebook',
                    externalId: pageId,
                    connectionStatus: 'CONNECTED',
                }).lean();
                if (!channel) {
                    continue;
                }
                await BusinessChannel.updateOne({ _id: channel._id }, { $set: { lastEventAt: new Date() } });

                // Process messaging events
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        if (event.message?.is_echo || event.delivery || event.read || (!event.message && !event.postback)) continue;
                        await withTenantContext({
                            businessId: channel.businessId.toString(),
                            userId: 'facebook-system',
                            membershipId: 'facebook-system',
                            role: 'Staff',
                        }, async () => {
                            const senderPsid = String(event.sender?.id || '');
                            if (!senderPsid) return;
                            const eventId = event.message?.mid || event.postback?.mid || `fb_${crypto.createHash('sha256').update(`${pageId}:${JSON.stringify(event)}`).digest('hex')}`;

                            const isNew = await registerInboundEvent({
                                eventId,
                                source: 'facebook',
                                psid: senderPsid,
                                payload: event,
                            });
                            if (!isNew) {
                                const existing = await WebhookEvent.findOne({ eventId }).select('processed').lean();
                                if (existing?.processed) {
                                    console.log(`Duplicate completed event ${eventId} ignored`);
                                    return;
                                }
                                console.log(`Pending event ${eventId} will be queued again`);
                            }

                            await webhookQueue.add('process-facebook-event', {
                                businessId: channel.businessId.toString(),
                                eventId,
                                psid: senderPsid,
                                message: event.message?.text || event.postback?.title || event.postback?.payload,
                                attachments: event.message?.attachments || [],
                                payload: event,
                                source: 'facebook',
                                pageId,
                                channelAIEnabled: channel.status === 'active',
                            });

                        });
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        await logError('FACEBOOK_WEBHOOK_ERROR', error, { object: req.body?.object, entryCount: Array.isArray(req.body?.entry) ? req.body.entry.length : 0 });
        console.error('Error in Facebook webhook:', error);
        const unavailable = error instanceof Error && error.message.startsWith('Redis is not configured');
        res.status(unavailable ? 503 : 500).json({ error: unavailable ? 'Facebook queue is unavailable because Redis is not configured' : 'Facebook webhook processing failed' });
    }
});

export default router;
