import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export interface IWebhookEvent extends Document {
    businessId: mongoose.Types.ObjectId;
    eventId: string; // Unique ID from Facebook or generated
    source: 'facebook' | 'web';
    eventType: string; // 'message', 'postback', 'delivery', etc.
    psid: string; // Sender PSID
    payload: any; // Full webhook payload
    processed: boolean;
    processedAt?: Date;
    processingAt?: Date;
    processingToken?: string;
    response?: unknown;
    error?: string;
    createdAt: Date;
}

const WebhookEventSchema = new Schema(
    {
        eventId: { type: String, required: true },
        source: {
            type: String,
            required: true,
            enum: ['facebook', 'web'],
            default: 'facebook',
        },
        eventType: { type: String, required: true },
        psid: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, required: true },
        processed: { type: Boolean, default: false },
        processedAt: { type: Date },
        processingAt: { type: Date },
        processingToken: { type: String },
        response: { type: Schema.Types.Mixed },
        error: { type: String },
    },
    { timestamps: true }
);

WebhookEventSchema.plugin(tenantPlugin);

// Indexes for deduplication and processing queue
WebhookEventSchema.index({ businessId: 1, eventId: 1 }, { unique: true });
WebhookEventSchema.index({ businessId: 1, eventType: 1 });
WebhookEventSchema.index({ businessId: 1, processed: 1, createdAt: 1 });
WebhookEventSchema.index({ businessId: 1, psid: 1, createdAt: -1 });

// TTL index to auto-delete old events after 30 days
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export const WebhookEvent = mongoose.model<IWebhookEvent>(
    'WebhookEvent',
    WebhookEventSchema
);
