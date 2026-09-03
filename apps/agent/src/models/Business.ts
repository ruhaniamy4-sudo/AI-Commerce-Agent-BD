import mongoose, { Document, Schema } from 'mongoose';
import { BUSINESS_TYPES, BusinessType } from '../services/adaptive-training.service';

/** Compact per-tenant sales style profile. All fields optional; no migration needed. */
export interface ISalesPlaybook {
    replyLengthPreference?: 'short' | 'balanced' | 'detailed';
    languageStyle?: 'formal' | 'casual' | 'mixed';
    addressingStyle?: 'apu' | 'bhai' | 'neutral';
    greetingStyle?: 'warm' | 'brief' | 'none';
    ctaStyle?: 'soft' | 'direct' | 'none';
    persistenceLevel?: 'low' | 'medium' | 'high';
    crossSellTendency?: 'low' | 'medium' | 'high';
    commonObjectionResponses?: string[]; // max 3, ≤150 chars each
    preferredClosingPattern?: string;   // max 200 chars
}

export interface IBusiness extends Document {

    name: string;
    slug: string;
    status: 'active' | 'suspended';
    businessType?: BusinessType;
    businessSubType?: string;
    customBusinessType?: string;
    secondaryBusinessTypes: BusinessType[];
    businessTypeStatus: 'unconfirmed' | 'inferred' | 'confirmed';
    businessTypeInference?: { value: BusinessType; confidence: number; evidence: string[]; sourceId?: mongoose.Types.ObjectId; inferredAt: Date };
    businessReferences: Array<{ url: string; label?: string; sourceId?: mongoose.Types.ObjectId; createdAt: Date }>;
    description?: string;
    phone?: string;
    website?: string;
    preferredLanguage: 'bn' | 'en';
    currency: 'BDT';
    aiAccess: {
        status: 'ENABLED' | 'SUSPENDED_BY_PLATFORM' | 'SUSPENDED_BY_SUBSCRIPTION' | 'DISABLED_BY_MERCHANT';
        reason?: string;
        changedAt?: Date;
        changedBy?: string;
        monthlyRequestLimit?: number;
        monthlyTokenLimit?: number;
        warningThresholdPercent?: number;
    };
    brandVoice: {
        tone: 'friendly' | 'professional' | 'casual' | 'premium' | 'custom';
        replyLength: 'short' | 'balanced' | 'detailed';
        language: 'auto' | 'bn' | 'en' | 'banglish';
        salesBehavior: 'helpful' | 'balanced' | 'sales_focused';
        emoji: 'none' | 'light' | 'normal';
        customTone?: string;
        examples: string[];
    };
    onboarding: {
        productAdded: boolean;
        knowledgeAdded: boolean;
        channelConfigured: boolean;
        aiTested: boolean;
        completedAt?: Date;
    };
    training: {
        status: 'not_started' | 'learning' | 'needs_review' | 'ready' | 'syncing' | 'error';
        lastSyncedAt?: Date;
        productsImported: number;
        knowledgeImported: number;
        needsReview: number;
        importPreference: 'in_stock_only' | 'all' | 'ask_during_review';
    };
    /** Compact tenant-scoped sales profile. Optional; stored on the Business document. */
    salesPlaybook?: ISalesPlaybook;
    createdAt: Date;
    updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    businessType: { type: String, enum: BUSINESS_TYPES, trim: true, index: true },
    businessSubType: { type: String, trim: true, maxlength: 120 },
    customBusinessType: { type: String, trim: true, maxlength: 160 },
    secondaryBusinessTypes: [{ type: String, enum: BUSINESS_TYPES }],
    businessTypeStatus: { type: String, enum: ['unconfirmed', 'inferred', 'confirmed'], default: 'unconfirmed', index: true },
    businessTypeInference: {
        value: { type: String, enum: BUSINESS_TYPES }, confidence: { type: Number, min: 0, max: 1 },
        evidence: [{ type: String }], sourceId: Schema.Types.ObjectId, inferredAt: Date,
    },
    businessReferences: [{ url: { type: String, required: true }, label: String, sourceId: Schema.Types.ObjectId, createdAt: { type: Date, default: Date.now } }],
    description: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    preferredLanguage: { type: String, enum: ['bn', 'en'], default: 'bn' },
    currency: { type: String, enum: ['BDT'], default: 'BDT' },
    aiAccess: {
        status: { type: String, enum: ['ENABLED', 'SUSPENDED_BY_PLATFORM', 'SUSPENDED_BY_SUBSCRIPTION', 'DISABLED_BY_MERCHANT'], default: 'ENABLED', index: true },
        reason: { type: String, maxlength: 500 },
        changedAt: Date,
        changedBy: String,
        monthlyRequestLimit: { type: Number, min: 1 },
        monthlyTokenLimit: { type: Number, min: 1 },
        warningThresholdPercent: { type: Number, min: 1, max: 100, default: 80 },
    },
    brandVoice: {
        tone: { type: String, enum: ['friendly', 'professional', 'casual', 'premium', 'custom'], default: 'friendly' },
        replyLength: { type: String, enum: ['short', 'balanced', 'detailed'], default: 'balanced' },
        language: { type: String, enum: ['auto', 'bn', 'en', 'banglish'], default: 'auto' },
        salesBehavior: { type: String, enum: ['helpful', 'balanced', 'sales_focused'], default: 'balanced' },
        emoji: { type: String, enum: ['none', 'light', 'normal'], default: 'light' },
        customTone: { type: String, maxlength: 300 },
        examples: [{ type: String, maxlength: 1000 }],
    },
    onboarding: {
        productAdded: { type: Boolean, default: false },
        knowledgeAdded: { type: Boolean, default: false },
        channelConfigured: { type: Boolean, default: false },
        aiTested: { type: Boolean, default: false },
        completedAt: { type: Date },
    },
    training: {
        status: { type: String, enum: ['not_started', 'learning', 'needs_review', 'ready', 'syncing', 'error'], default: 'not_started' },
        lastSyncedAt: Date,
        productsImported: { type: Number, default: 0 },
        knowledgeImported: { type: Number, default: 0 },
        needsReview: { type: Number, default: 0 },
        importPreference: { type: String, enum: ['in_stock_only', 'all', 'ask_during_review'], default: 'ask_during_review' },
    },
    // Compact tenant-scoped sales playbook — all fields optional, no migration needed
    salesPlaybook: {
        replyLengthPreference: { type: String, enum: ['short', 'balanced', 'detailed'] },
        languageStyle: { type: String, enum: ['formal', 'casual', 'mixed'] },
        addressingStyle: { type: String, enum: ['apu', 'bhai', 'neutral'] },
        greetingStyle: { type: String, enum: ['warm', 'brief', 'none'] },
        ctaStyle: { type: String, enum: ['soft', 'direct', 'none'] },
        persistenceLevel: { type: String, enum: ['low', 'medium', 'high'] },
        crossSellTendency: { type: String, enum: ['low', 'medium', 'high'] },
        commonObjectionResponses: [{ type: String, maxlength: 150 }],
        preferredClosingPattern: { type: String, maxlength: 200 },
    },
}, { timestamps: true });

BusinessSchema.index({ status: 1, createdAt: -1 });
BusinessSchema.index({ 'aiAccess.status': 1, createdAt: -1 });

export const Business = mongoose.model<IBusiness>('Business', BusinessSchema);

