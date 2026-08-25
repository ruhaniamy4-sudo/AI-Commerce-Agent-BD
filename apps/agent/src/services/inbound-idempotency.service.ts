import crypto from 'node:crypto';
import { WebhookEvent } from '../models/WebhookEvent';

const leaseMilliseconds = 5 * 60 * 1000;

export async function registerInboundEvent(params: {
    eventId: string;
    source: 'facebook' | 'web' | 'test';
    psid: string;
    payload: unknown;
}) {
    try {
        await WebhookEvent.create({
            ...params,
            eventType: 'message',
            processed: false,
        });
        return true;
    } catch (error: any) {
        if (error?.code === 11000) return false;
        throw error;
    }
}

export async function claimInboundEvent(eventId: string) {
    const processingToken = crypto.randomUUID();
    const staleBefore = new Date(Date.now() - leaseMilliseconds);
    const event = await WebhookEvent.findOneAndUpdate(
        {
            eventId,
            processed: false,
            $or: [
                { processingAt: { $exists: false } },
                { processingAt: { $lt: staleBefore } },
            ],
        },
        { $set: { processingAt: new Date(), processingToken }, $unset: { error: 1 } },
        { new: true }
    );
    return event ? { claimed: true as const, processingToken, event } : {
        claimed: false as const,
        event: await WebhookEvent.findOne({ eventId }).lean(),
    };
}

export async function completeInboundEvent(eventId: string, processingToken: string, response?: unknown) {
    await WebhookEvent.updateOne(
        { eventId, processingToken, processed: false },
        {
            $set: { processed: true, processedAt: new Date(), response },
            $unset: { processingAt: 1, processingToken: 1, error: 1 },
        }
    );
}

export async function checkpointInboundEvent(eventId: string, processingToken: string, response: unknown) {
    await WebhookEvent.updateOne(
        { eventId, processingToken, processed: false },
        { $set: { response } }
    );
}

export async function releaseInboundEvent(eventId: string, processingToken: string, error: string) {
    await WebhookEvent.updateOne(
        { eventId, processingToken, processed: false },
        { $set: { error }, $unset: { processingAt: 1, processingToken: 1 } }
    );
}
