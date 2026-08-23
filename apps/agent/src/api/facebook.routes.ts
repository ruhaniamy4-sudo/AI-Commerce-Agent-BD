import dotenv from 'dotenv';
import express, { Router } from 'express';
import crypto from 'crypto';
import { WebhookEvent } from '../models/WebhookEvent';
import { webhookQueue } from '../services/queue.service';
import { logError } from '../services/error.service';
import { BusinessChannel } from '../models/BusinessChannel';
import { withTenantContext } from '../tenancy/context';
import { registerInboundEvent } from '../services/inbound-idempotency.service';

dotenv.config();

const router = Router();
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const APP_SECRET = process.env.FB_APP_SECRET;

type RawBodyRequest = express.Request & { rawBody?: Buffer };

// Middleware to verify signature
const verifySignature = (req: RawBodyRequest, res: express.Response, next: express.NextFunction) => {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature || !APP_SECRET) {
        console.warn('Missing signature or app secret');
        // For development/testing, we might skip if secret isn't set,
        // but for production this is critical.
        if (process.env.NODE_ENV === 'production') {
            return res.sendStatus(403);
        }
        return next();
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

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
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
                    status: 'active',
                }).lean();
                if (!channel) {
                    console.warn(`No active business channel for Facebook page ${pageId}`);
                    continue;
                }

                // Process messaging events
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        await withTenantContext({
                            businessId: channel.businessId.toString(),
                            userId: 'facebook-system',
                            membershipId: 'facebook-system',
                            role: 'Staff',
                        }, async () => {
                            const senderPsid = event.sender.id;
                            const eventId = event.message?.mid || `evt_${Date.now()}_${Math.random()}`;

                            const isNew = await registerInboundEvent({
                                eventId,
                                source: 'facebook',
                                psid: senderPsid,
                                payload: event,
                            });
                            if (!isNew) {
                                console.log(`Duplicate event ${eventId} ignored`);
                                return;
                            }

                            await webhookQueue.add('process-facebook-event', {
                                businessId: channel.businessId.toString(),
                                eventId,
                                psid: senderPsid,
                                message: event.message?.text,
                                attachments: event.message?.attachments || [],
                                payload: event,
                                source: 'facebook',
                                pageId,
                            });

                            console.log(`Event ${eventId} queued for PSID ${senderPsid}`);
                        });
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        await logError('FACEBOOK_WEBHOOK_ERROR', error, { body: req.body });
        console.error('Error in Facebook webhook:', error);
        res.sendStatus(500);
    }
});

export default router;
