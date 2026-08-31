import mongoose, { Document, Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type AwarenessType = 'CAMPAIGN'|'OFFER'|'ANNOUNCEMENT'|'NEW_ARRIVAL'|'CATEGORY_FOCUS'|'COLLECTION_FOCUS'|'EVENT'|'LIVE'|'SEASONAL_CONTEXT'|'DELIVERY_ANNOUNCEMENT'|'BUSINESS_UPDATE'|'PRODUCT_POSITIONING'|'SERVICE_HIGHLIGHT'|'FAQ_SIGNAL';
export type AwarenessStatus = 'UPCOMING'|'ACTIVE'|'EXPIRED'|'SUPERSEDED'|'NEEDS_REVIEW';

export interface IBusinessAwareness extends Document {
    businessId: mongoose.Types.ObjectId;
    type: AwarenessType; title: string; summary: string;
    targetType: 'ALL_PRODUCTS'|'CATEGORY'|'COLLECTION'|'PRODUCT'|'CUSTOM_SEGMENT'|'SERVICE';
    targetReference?: string; claimType?: 'PERCENT'|'UP_TO_PERCENT'|'PRICE_DROP'|'TEXT'; claimValue?: number|string;
    sourceType: 'facebook'|'website'|'merchant'; sourceId?: string; sourceUrl?: string;
    publishedAt?: Date; startsAt?: Date; endsAt?: Date; status: AwarenessStatus;
    confidence: number; fingerprint: string; lastSeenAt: Date; validation: 'VERIFIED'|'MISMATCH'|'UNVERIFIED'; validationNote?: string;
}

const BusinessAwarenessSchema = new Schema<IBusinessAwareness>({
    type: { type: String, required: true, index: true }, title: { type: String, required: true, maxlength: 240 }, summary: { type: String, required: true, maxlength: 2000 },
    targetType: { type: String, enum: ['ALL_PRODUCTS','CATEGORY','COLLECTION','PRODUCT','CUSTOM_SEGMENT','SERVICE'], required: true }, targetReference: String,
    claimType: { type: String, enum: ['PERCENT','UP_TO_PERCENT','PRICE_DROP','TEXT'] }, claimValue: Schema.Types.Mixed,
    sourceType: { type: String, enum: ['facebook','website','merchant'], required: true }, sourceId: String, sourceUrl: String,
    publishedAt: Date, startsAt: Date, endsAt: Date,
    status: { type: String, enum: ['UPCOMING','ACTIVE','EXPIRED','SUPERSEDED','NEEDS_REVIEW'], required: true, index: true },
    confidence: { type: Number, min: 0, max: 1, default: .5 }, fingerprint: { type: String, required: true }, lastSeenAt: { type: Date, default: Date.now },
    validation: { type: String, enum: ['VERIFIED','MISMATCH','UNVERIFIED'], default: 'UNVERIFIED' }, validationNote: String,
}, { timestamps: true });

BusinessAwarenessSchema.plugin(tenantPlugin);
BusinessAwarenessSchema.index({ businessId: 1, fingerprint: 1 }, { unique: true });
BusinessAwarenessSchema.index({ businessId: 1, status: 1, endsAt: 1, publishedAt: -1 });
BusinessAwarenessSchema.index({ businessId: 1, targetType: 1, targetReference: 1, status: 1 });

export const BusinessAwareness = (mongoose.models.BusinessAwareness as mongoose.Model<IBusinessAwareness> | undefined)
    || mongoose.model<IBusinessAwareness>('BusinessAwareness', BusinessAwarenessSchema);
