import mongoose, { Schema } from 'mongoose';

const SystemPromptSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        content: { type: String, required: true },
        description: { type: String, required: false, trim: true },
        isActive: { type: Boolean, default: false, index: true },
    },
    { timestamps: true }
);

// Index for fast lookup of active prompt
SystemPromptSchema.index({ isActive: 1, updatedAt: -1 });

// Pre-save middleware to ensure only one prompt is active
// @ts-ignore - Mongoose middleware typing issue
SystemPromptSchema.pre('save', async function () {
    if (this.isActive && this.isModified('isActive')) {
        // Deactivate all other prompts
        await mongoose
            .model('SystemPrompt')
            .updateMany(
                { _id: { $ne: this._id }, isActive: true },
                { isActive: false }
            );
    }
});

export const SystemPrompt = mongoose.model('SystemPrompt', SystemPromptSchema);
