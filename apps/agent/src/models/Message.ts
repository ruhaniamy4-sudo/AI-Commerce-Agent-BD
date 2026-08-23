import mongoose, { Schema } from 'mongoose';

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

// Indexes
MessageSchema.index({ conversationId: 1, createdAt: 1 }); // Chronological messages
MessageSchema.index({ content: 'text' }); // Full-text search
MessageSchema.index({ 'metadata.platform': 1 });
MessageSchema.index({ role: 1, createdAt: -1 }); // Filter by role

export const Message = mongoose.model('Message', MessageSchema);
