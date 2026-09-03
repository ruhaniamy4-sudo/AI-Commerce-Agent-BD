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

/**
 * Sales pipeline stage for this conversation.
 * Derived deterministically from intent signals — no LLM call.
 */
export type SalesStage =
    | 'NEW'
    | 'DISCOVERY'
    | 'INTERESTED'
    | 'OBJECTION'
    | 'READY_TO_BUY'
    | 'ORDERED'
    | 'LOST';

/** Lightweight conversion outcome — populated only when the conversation converts or is lost. */
export interface IConversionOutcome {
    convertedAt?: Date;
    conversionType?: 'AI_ONLY' | 'AI_ASSISTED' | 'HUMAN';
    orderId?: string;
    lostReason?: string;
}

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

    // Sales Pipeline — deterministic, no LLM call
    salesStage?: SalesStage;
    conversionOutcome?: IConversionOutcome;

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

        // Sales Pipeline — deterministic, no LLM call required
        salesStage: {
            type: String,
            enum: ['NEW', 'DISCOVERY', 'INTERESTED', 'OBJECTION', 'READY_TO_BUY', 'ORDERED', 'LOST'],
            index: true,
        },
        conversionOutcome: {
            type: {
                convertedAt: Date,
                conversionType: { type: String, enum: ['AI_ONLY', 'AI_ASSISTED', 'HUMAN'] },
                orderId: String,
                lostReason: String,
            },
            required: false,
        },

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
// Sales pipeline analytics index
ConversationSchema.index({ businessId: 1, salesStage: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

