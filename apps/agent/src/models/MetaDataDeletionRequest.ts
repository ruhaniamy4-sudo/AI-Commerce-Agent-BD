import mongoose, { Schema } from 'mongoose';

const MetaDataDeletionRequestSchema = new Schema({
    providerUserHash: { type: String, required: true, index: true },
    confirmationHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['RECEIVED', 'COMPLETED', 'NEEDS_OPERATOR_REVIEW'], default: 'RECEIVED', index: true },
    completedAt: Date,
}, { timestamps: true });

export const MetaDataDeletionRequest = mongoose.model('MetaDataDeletionRequest', MetaDataDeletionRequestSchema);
