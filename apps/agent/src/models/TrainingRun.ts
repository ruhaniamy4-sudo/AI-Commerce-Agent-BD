import mongoose, { Document, Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type TrainingRunStatus = 'queued' | 'learning' | 'needs_review' | 'ready' | 'partial' | 'error';

export interface ITrainingRun extends Document {
    businessId: mongoose.Types.ObjectId;
    sourceId: mongoose.Types.ObjectId;
    status: TrainingRunStatus;
    stage: string;
    progress: number;
    stats: { pages: number; discovered: number; productUrls: number; remaining: number; failed: number; fetches: number; aiCalls: number; pagesWithoutAI: number; unchanged: number; changed: number; newPages: number; durationMs: number; products: number; knowledge: number; duplicates: number; conflicts: number; needsAttention: number };
    errorCode?: string;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
}

const TrainingRunSchema = new Schema<ITrainingRun>({
    sourceId: { type: Schema.Types.ObjectId, ref: 'TrainingSource', required: true, index: true },
    status: { type: String, enum: ['queued', 'learning', 'needs_review', 'ready', 'partial', 'error'], default: 'queued', index: true },
    stage: { type: String, default: 'Preparing your SellPilot...' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    stats: {
        pages: { type: Number, default: 0 }, products: { type: Number, default: 0 }, knowledge: { type: Number, default: 0 },
        discovered: { type: Number, default: 0 }, productUrls: { type: Number, default: 0 }, remaining: { type: Number, default: 0 }, failed: { type: Number, default: 0 },
        fetches: { type: Number, default: 0 }, aiCalls: { type: Number, default: 0 }, pagesWithoutAI: { type: Number, default: 0 },
        unchanged: { type: Number, default: 0 }, changed: { type: Number, default: 0 }, newPages: { type: Number, default: 0 }, durationMs: { type: Number, default: 0 },
        duplicates: { type: Number, default: 0 }, conflicts: { type: Number, default: 0 }, needsAttention: { type: Number, default: 0 },
    },
    errorCode: String,
    errorMessage: String,
    startedAt: Date,
    completedAt: Date,
}, { timestamps: true });

TrainingRunSchema.plugin(tenantPlugin);
TrainingRunSchema.index({ businessId: 1, createdAt: -1 });

export const TrainingRun = mongoose.model<ITrainingRun>('TrainingRun', TrainingRunSchema);
