import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
    eventId: string; // Unique ID from Facebook or generated
    source: 'facebook' | 'instagram'; // Platform source
    eventType: string; // 'message', 'postback', 'delivery', etc.
    psid: string; // Sender PSID
    payload: any; // Full webhook payload
    processed: boolean;
    processedAt?: Date;
    error?: string;
    createdAt: Date;
}

const WebhookEventSchema = new Schema(
    {
        eventId: { type: String, required: true, unique: true },
        source: {
            type: String,
            required: true,
            enum: ['facebook', 'instagram'],
            default: 'facebook',
        },
        eventType: { type: String, required: true },
        psid: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, required: true },
        processed: { type: Boolean, default: false },
        processedAt: { type: Date },
        error: { type: String },
    },
    { timestamps: true }
);

// Indexes for deduplication and processing queue
WebhookEventSchema.index({ eventType: 1 });
WebhookEventSchema.index({ processed: 1, createdAt: 1 });
WebhookEventSchema.index({ psid: 1, createdAt: -1 });

// TTL index to auto-delete old events after 30 days
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

export const WebhookEvent = mongoose.model<IWebhookEvent>(
    'WebhookEvent',
    WebhookEventSchema
);
