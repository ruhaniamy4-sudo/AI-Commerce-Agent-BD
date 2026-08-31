import mongoose, { Document, Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type TrainingSourceType = 'website' | 'facebook' | 'file' | 'manual' | 'reference';
export type TrainingSourceStatus = 'connected' | 'learning' | 'ready' | 'needs_attention' | 'error';

export interface ITrainingSource extends Document {
    businessId: mongoose.Types.ObjectId;
    type: TrainingSourceType;
    name: string;
    url?: string;
    externalId?: string;
    status: TrainingSourceStatus;
    fingerprint: string;
    lastSeenAt?: Date;
    lastSyncedAt?: Date;
    errorCode?: string;
    errorMessage?: string;
    crawlPages?: Array<{ url: string; fingerprint?: string; pageType: string; status: string; error?: string; lastSeenAt: Date }>;
    importPreference: 'in_stock_only' | 'all' | 'ask_during_review';
    syncCheckpoint?: { lastFacebookSyncAt?: Date; lastProcessedPostId?: string; lastProcessedPostAt?: Date };
    referenceInsights?: { businessTypeHint?: string; sectionIdeas: string[]; questionIdeas: string[]; safety: string };
    stats: { pages: number; discovered: number; productUrls: number; remaining: number; failed: number; fetches: number; aiCalls: number; pagesWithoutAI: number; unchanged: number; changed: number; newPages: number; durationMs: number; products: number; knowledge: number; duplicates: number; conflicts: number; needsAttention: number };
}

const TrainingSourceSchema = new Schema<ITrainingSource>({
    type: { type: String, enum: ['website', 'facebook', 'file', 'manual', 'reference'], required: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    externalId: { type: String, trim: true },
    status: { type: String, enum: ['connected', 'learning', 'ready', 'needs_attention', 'error'], default: 'connected', index: true },
    fingerprint: { type: String, required: true },
    lastSeenAt: Date,
    lastSyncedAt: Date,
    errorCode: String,
    errorMessage: String,
    crawlPages: [{ url: { type: String, required: true }, fingerprint: String, pageType: String, status: String, error: String, lastSeenAt: { type: Date, default: Date.now } }],
    importPreference: { type: String, enum: ['in_stock_only', 'all', 'ask_during_review'], default: 'ask_during_review' },
    syncCheckpoint: { lastFacebookSyncAt: Date, lastProcessedPostId: String, lastProcessedPostAt: Date },
    referenceInsights: { businessTypeHint: String, sectionIdeas: [String], questionIdeas: [String], safety: String },
    stats: {
        pages: { type: Number, default: 0 }, products: { type: Number, default: 0 },
        knowledge: { type: Number, default: 0 }, discovered: { type: Number, default: 0 }, productUrls: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 }, failed: { type: Number, default: 0 }, fetches: { type: Number, default: 0 },
        aiCalls: { type: Number, default: 0 }, pagesWithoutAI: { type: Number, default: 0 },
        unchanged: { type: Number, default: 0 }, changed: { type: Number, default: 0 }, newPages: { type: Number, default: 0 }, durationMs: { type: Number, default: 0 },
        duplicates: { type: Number, default: 0 }, conflicts: { type: Number, default: 0 }, needsAttention: { type: Number, default: 0 },
    },
}, { timestamps: true });

TrainingSourceSchema.plugin(tenantPlugin);
TrainingSourceSchema.index({ businessId: 1, type: 1, fingerprint: 1 }, { unique: true });
TrainingSourceSchema.index({ businessId: 1, status: 1, updatedAt: -1 });

export const TrainingSource = mongoose.model<ITrainingSource>('TrainingSource', TrainingSourceSchema);
