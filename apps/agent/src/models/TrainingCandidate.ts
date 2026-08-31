import mongoose, { Document, Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type CandidateKind = 'product' | 'offering' | 'knowledge' | 'business';
export type CandidateStatus = 'ready' | 'possible_duplicate' | 'conflict' | 'needs_attention' | 'approving' | 'failed' | 'approved' | 'rejected' | 'imported';

export interface ITrainingCandidate extends Document {
    businessId: mongoose.Types.ObjectId;
    runId: mongoose.Types.ObjectId;
    sourceId: mongoose.Types.ObjectId;
    kind: CandidateKind;
    status: CandidateStatus;
    title: string;
    normalizedKey: string;
    fingerprint: string;
    confidence: number;
    payload: Record<string, any>;
    source: { type: string; url?: string; externalId?: string; lastSeenAt: Date };
    duplicateKind?: 'exact' | 'probable';
    matchedRecordId?: mongoose.Types.ObjectId;
    conflictFields: Array<{ field: string; currentValue: unknown; importedValue: unknown }>;
    reviewNote?: string;
    approvedBy?: string;
    approvedAt?: Date;
    lastError?: string;
    approvalAttempts: number;
}

const TrainingCandidateSchema = new Schema<ITrainingCandidate>({
    runId: { type: Schema.Types.ObjectId, ref: 'TrainingRun', required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'TrainingSource', required: true, index: true },
    kind: { type: String, enum: ['product', 'offering', 'knowledge', 'business'], required: true, index: true },
    status: { type: String, enum: ['ready', 'possible_duplicate', 'conflict', 'needs_attention', 'approving', 'failed', 'approved', 'rejected', 'imported'], required: true, index: true },
    title: { type: String, required: true, trim: true },
    normalizedKey: { type: String, required: true },
    fingerprint: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    payload: { type: Schema.Types.Mixed, required: true },
    source: {
        type: { type: String, required: true }, url: String, externalId: String,
        lastSeenAt: { type: Date, default: Date.now },
    },
    duplicateKind: { type: String, enum: ['exact', 'probable'] },
    matchedRecordId: Schema.Types.ObjectId,
    conflictFields: [{ field: String, currentValue: Schema.Types.Mixed, importedValue: Schema.Types.Mixed }],
    reviewNote: String,
    approvedBy: String,
    approvedAt: Date,
    lastError: String,
    approvalAttempts: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

TrainingCandidateSchema.plugin(tenantPlugin);
TrainingCandidateSchema.index({ businessId: 1, sourceId: 1, fingerprint: 1 }, { unique: true });
TrainingCandidateSchema.index({ businessId: 1, status: 1, kind: 1, createdAt: -1 });

export const TrainingCandidate = mongoose.model<ITrainingCandidate>('TrainingCandidate', TrainingCandidateSchema);
