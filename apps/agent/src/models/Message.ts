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
MessageSchema.index({ businessId: 1, content: 'text' });
MessageSchema.index({ businessId: 1, 'metadata.platform': 1 });
MessageSchema.index({ businessId: 1, role: 1, createdAt: -1 });

export const Message = mongoose.model('Message', MessageSchema);
