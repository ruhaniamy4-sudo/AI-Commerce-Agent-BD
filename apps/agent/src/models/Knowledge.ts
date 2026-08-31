import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';
import { buildKnowledgeSearchProfile, SearchProfile } from '../services/knowledge-intelligence.service';

export type KnowledgeType = 'FAQ' | 'POLICY' | 'GUIDE' | 'TROUBLESHOOT' | 'COMPATIBILITY';

export interface IKnowledgeVersion {
    content: string;
    updatedBy: string;
    updatedAt: Date;
}

export interface IKnowledge extends Document {
    businessId: mongoose.Types.ObjectId;
    title: string;
    content: string; // Rich text or markdown
    type: KnowledgeType;
    language: 'en' | 'bn' | 'hi';
    tags: string[]; // For retrieval matching
    status: 'active' | 'inactive';
    sourcePriority: 'high' | 'normal' | 'low'; // For retrieval ranking

    // Versioning
    versionHistory: IKnowledgeVersion[];

    // AI retrieval
    embedding?: number[]; // Vector embedding for semantic search (optional)

    // Metadata
    createdBy: string;
    updatedBy: string;
    isPinned: boolean; // Critical policy flag
    normalizedFact?: string;
    fingerprint?: string;
    provenance?: Array<{ sourceType: string; sourceUrl?: string; sourceExternalId?: string; fingerprint: string; lastSeenAt: Date; lastSyncedAt: Date }>;
    merchantConfirmed: boolean;
    intelligence?: SearchProfile;
    businessType?: string;
    knowledgeDomain?: string;

    createdAt: Date;
    updatedAt: Date;
}

const KnowledgeVersionSchema = new Schema({
    content: { type: String, required: true },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
});

const KnowledgeIntelligenceSchema = new Schema({
    profileVersion: { type: Number, default: 1 },
    searchableText: String,
    terms: [{ type: String }],
    colors: [{ type: String }],
    sizes: [{ type: String }],
    materials: [{ type: String }],
    categories: [{ type: String }],
    useCases: [{ type: String }],
    facts: [{ subject: String, predicate: String, value: Schema.Types.Mixed, unit: String, confidence: { type: String, enum: ['confirmed', 'supported'] } }],
    riskLevel: { type: String, enum: ['normal', 'high'], default: 'normal' },
    sourceHash: String,
}, { _id: false });

const KnowledgeSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        content: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: ['FAQ', 'POLICY', 'GUIDE', 'TROUBLESHOOT', 'COMPATIBILITY'],
            index: true,
        },
        language: {
            type: String,
            required: true,
            enum: ['en', 'bn', 'hi'],
            default: 'en',
            index: true,
        },
        tags: [{ type: String, index: true }],
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
        sourcePriority: {
            type: String,
            enum: ['high', 'normal', 'low'],
            default: 'normal',
        },

        versionHistory: [KnowledgeVersionSchema],

        embedding: { type: [Number] }, // For vector search

        createdBy: { type: String, required: true },
        updatedBy: { type: String, required: true },
        isPinned: { type: Boolean, default: false, index: true },
        normalizedFact: { type: String },
        fingerprint: { type: String },
        provenance: [{
            sourceType: { type: String, required: true }, sourceUrl: String, sourceExternalId: String,
            fingerprint: { type: String, required: true }, lastSeenAt: { type: Date, default: Date.now }, lastSyncedAt: { type: Date, default: Date.now },
        }],
        merchantConfirmed: { type: Boolean, default: true },
        businessType: { type: String, index: true },
        knowledgeDomain: { type: String, trim: true, uppercase: true, index: true },
        intelligence: { type: KnowledgeIntelligenceSchema, select: false },
    },
    { timestamps: true }
);

KnowledgeSchema.plugin(tenantPlugin);

// Indexes for retrieval
KnowledgeSchema.index(
    { businessId: 1, title: 'text', content: 'text' },
    {
        name: 'businessId_1_title_text_content_text',
        default_language: 'none',
        // MongoDB otherwise defaults this to the application's `language` field.
        language_override: '_mongoTextLanguage',
    }
);
KnowledgeSchema.index({ businessId: 1, type: 1, language: 1, status: 1 });
KnowledgeSchema.index({ businessId: 1, tags: 1, status: 1 });
KnowledgeSchema.index({ businessId: 1, isPinned: 1, sourcePriority: 1 });
KnowledgeSchema.index({ businessId: 1, fingerprint: 1 }, { sparse: true });
KnowledgeSchema.index({ businessId: 1, 'intelligence.terms': 1, status: 1 });

KnowledgeSchema.pre('validate', function (this: IKnowledge) {
    if (this.isNew || ['title', 'content', 'tags', 'type'].some((path) => this.isModified(path))) {
        this.intelligence = buildKnowledgeSearchProfile(this.toObject({ depopulate: true }));
    }
});

// Pre-save middleware to add to version history
KnowledgeSchema.pre('save', async function (this: IKnowledge) {
    if (this.isModified('content') && !this.isNew) {
        this.versionHistory.push({
            content: this.content,
            updatedBy: this.updatedBy,
            updatedAt: new Date(),
        });

        // Keep only last 10 versions
        if (this.versionHistory.length > 10) {
            this.versionHistory = this.versionHistory.slice(-10);
        }
    }
});

export const Knowledge = mongoose.model<IKnowledge>('Knowledge', KnowledgeSchema);
