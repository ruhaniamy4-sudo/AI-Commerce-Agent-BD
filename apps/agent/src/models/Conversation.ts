import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type ConversationIntent =
    | 'product_inquiry'
    | 'order'
    | 'status_check'
    | 'return_warranty'
    | 'handoff'
    | 'general'
    | 'unknown';
export type ConversationControlMode = 'AI_ACTIVE' | 'HUMAN_ACTIVE';

export interface IConversation extends Document {
    businessId: mongoose.Types.ObjectId;
    conversationId: string; // Unique conversation ID
    customerId?: mongoose.Types.ObjectId; // Reference to Customer
    psid?: string; // Facebook PSID

    // Platform Tracking
    platform: 'facebook' | 'whatsapp' | 'web-widget' | 'telegram' | 'instagram' | 'manual';
    platformConversationId?: string; // Platform-specific ID
    platformPageId?: string;

    // AI Agent Control
    aiEnabled: boolean; // AI on/off toggle per conversation
    needsHumanHandoff: boolean; // Escalation flag
    handoffReason?: string; // Why escalated
    controlMode: ConversationControlMode;
    summary?: string;
    summarizedMessageCount: number;
    summaryUpdatedAt?: Date;

    // State Management
    status: 'active' | 'archived' | 'resolved' | 'spam';
    assignedTo?: string; // Current handler/rep

    // Intent and Context
    currentIntent?: ConversationIntent;
    metadata: Record<string, any>; // For storing cart, preferences, etc.

    // Denormalized Metrics (for performance)
    messageCount: number;
    lastMessageAt?: Date;
    lastMessagePreview?: string; // First 200 chars

    // Visual Product Search Context
    imageContext?: {
        url: string;
        timestamp: Date;
        aiDescription: string;
        category?: string;
        features?: string[];
        matchedProducts?: string[];
        expiresAt: Date;
        media?: {
            provider: 'cloudinary'; providerAssetId: string; secureUrl: string; resourceType: 'image';
            mimeType?: string; size?: number; width?: number; height?: number; source: string;
            originalUrl?: string; createdAt: Date; retention: 'persistent'|'temporary'; expiresAt?: Date; retentionStatus: 'active'|'deleted';
        };
    };

    createdAt: Date;
    updatedAt: Date;
}

const ConversationSchema = new Schema(
    {
        conversationId: { type: String, required: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
        psid: { type: String },

        platform: {
            type: String,
            default: 'facebook',
            enum: ['facebook', 'whatsapp', 'web-widget', 'telegram', 'instagram', 'manual'],
        },
        platformConversationId: { type: String },
        platformPageId: { type: String, index: true },

        aiEnabled: { type: Boolean, default: true, index: true },
        needsHumanHandoff: { type: Boolean, default: false, index: true },
        handoffReason: { type: String },
        controlMode: {
            type: String,
            enum: ['AI_ACTIVE', 'HUMAN_ACTIVE'],
            default: 'AI_ACTIVE',
            required: true,
            index: true,
        },
        summary: { type: String, maxlength: 2000 },
        summarizedMessageCount: { type: Number, default: 0, min: 0 },
        summaryUpdatedAt: { type: Date },

        status: {
            type: String,
            default: 'active',
            enum: ['active', 'archived', 'resolved', 'spam'],
            index: true,
        },
        assignedTo: { type: String },

        currentIntent: {
            type: String,
            enum: [
                'product_inquiry',
                'order',
                'status_check',
                'return_warranty',
                'handoff',
                'general',
                'unknown',
            ],
        },
        metadata: { type: Schema.Types.Mixed, default: {} },

        messageCount: { type: Number, default: 0 },
        lastMessageAt: { type: Date },
        lastMessagePreview: { type: String, maxlength: 200 },

        // Visual Product Search Context
        imageContext: {
            type: {
                url: String,
                timestamp: Date,
                aiDescription: String,
                category: String,
                features: [String],
                matchedProducts: [String],
                expiresAt: Date,
                media: {
                    provider: { type: String, enum: ['cloudinary'] }, providerAssetId: String, secureUrl: String,
                    resourceType: { type: String, enum: ['image'] }, mimeType: String, size: Number, width: Number, height: Number,
                    source: String, originalUrl: String, createdAt: Date, retention: { type: String, enum: ['persistent', 'temporary'] },
                    expiresAt: Date, retentionStatus: { type: String, enum: ['active', 'deleted'] },
                },
            },
            required: false,
        },
    },
    { timestamps: true }
);

ConversationSchema.plugin(tenantPlugin);

// Compound Indexes for common query patterns
ConversationSchema.index({ businessId: 1, conversationId: 1 }, { unique: true });
ConversationSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
ConversationSchema.index({ businessId: 1, status: 1, lastMessageAt: -1 });
ConversationSchema.index({ businessId: 1, platform: 1, status: 1 });
ConversationSchema.index({ businessId: 1, assignedTo: 1, status: 1 });
ConversationSchema.index({ businessId: 1, needsHumanHandoff: 1, status: 1 });
ConversationSchema.index({ businessId: 1, controlMode: 1, lastMessageAt: -1 });
ConversationSchema.index({ businessId: 1, psid: 1 });
ConversationSchema.index({ businessId: 1, platformPageId: 1, psid: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
