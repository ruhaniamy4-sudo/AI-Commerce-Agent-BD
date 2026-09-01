import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

const MessageSchema = new Schema(
    {
        conversationId: { type: String, required: true, index: true },

        // Content
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        contentType: {
            type: String,
            default: 'text',
            enum: ['text', 'image', 'file', 'audio', 'video'],
        },

        // Attachments (new field)
        attachments: [
            {
                url: { type: String },
                type: { type: String }, // 'image/jpeg', 'application/pdf', etc.
                filename: { type: String },
                size: { type: Number }, // bytes
                provider: { type: String, enum: ['cloudinary'] },
                providerAssetId: { type: String },
                resourceType: { type: String, enum: ['image'] },
                width: { type: Number },
                height: { type: Number },
                source: { type: String },
                originalUrl: { type: String },
                conversationId: { type: String },
                messageId: { type: String },
                retention: { type: String, enum: ['persistent', 'temporary'] },
                expiresAt: { type: Date },
                retentionStatus: { type: String, enum: ['active', 'deleted'], default: 'active' },
                mediaCreatedAt: { type: Date },
            },
        ],

        // Platform Metadata (new field - flexible for platform-specific data)
        metadata: {
            platform: { type: String },
            messageId: { type: String }, // Platform-specific message ID
            replyTo: { type: String }, // ID of message being replied to
            isDeleted: { type: Boolean, default: false },
            isEdited: { type: Boolean, default: false },
            isForwarded: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

MessageSchema.plugin(tenantPlugin);

// Indexes
MessageSchema.index({ businessId: 1, conversationId: 1, createdAt: 1 });
MessageSchema.index(
    { businessId: 1, conversationId: 1, 'metadata.messageId': 1 },
    { unique: true, partialFilterExpression: { 'metadata.messageId': { $type: 'string' } } }
);
MessageSchema.index(
    { businessId: 1, content: 'text' },
    {
        name: 'businessId_1_content_text',
        default_language: 'none',
        language_override: '_mongoTextLanguage',
    }
);
MessageSchema.index({ businessId: 1, 'metadata.platform': 1 });
MessageSchema.index({ businessId: 1, role: 1, createdAt: -1 });
MessageSchema.index({ businessId: 1, 'attachments.expiresAt': 1, 'attachments.retentionStatus': 1 });

export const Message = mongoose.model('Message', MessageSchema);
