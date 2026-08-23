import mongoose, { Schema } from 'mongoose';

const NoteSchema = new Schema(
    {
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },

        // Note Content
        content: { type: String, required: true },
        contentType: {
            type: String,
            default: 'text',
            enum: ['text', 'markdown'],
        },

        // Organization
        isPinned: { type: Boolean, default: false },
        tags: [{ type: String }],

        // Authorship
        createdBy: { type: String, required: true }, // User ID
        createdByName: { type: String }, // Human-readable name
        updatedBy: { type: String },
        updatedByName: { type: String },

        // Soft Delete
        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        deletedBy: { type: String },
    },
    { timestamps: true }
);

// Indexes
NoteSchema.index({ customerId: 1, createdAt: -1 }); // Customer notes chronologically
NoteSchema.index({ customerId: 1, isPinned: -1, createdAt: -1 }); // Pinned notes first
NoteSchema.index({ createdBy: 1, createdAt: -1 }); // User's notes
NoteSchema.index({ isDeleted: 1 }); // Filter deleted notes

export const Note = mongoose.model('Note', NoteSchema);
