import mongoose, { Document, Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';
import { OfferingType } from '../services/adaptive-training.service';

export interface IOffering extends Document {
    businessId: mongoose.Types.ObjectId;
    offeringType: OfferingType;
    name: string;
    description?: string;
    category?: string;
    price?: number;
    salePrice?: number;
    currency: string;
    availability?: string;
    attributes: Record<string, unknown>;
    images: string[];
    canonicalUrl?: string;
    status: 'active' | 'inactive';
    merchantConfirmed: boolean;
    fingerprint?: string;
    provenance: Array<{ sourceType: string; sourceUrl?: string; sourceExternalId?: string; fingerprint: string; lastSeenAt: Date; lastSyncedAt: Date }>;
    createdBy: string;
    updatedBy: string;
}

const OfferingSchema = new Schema<IOffering>({
    offeringType: { type: String, enum: ['PRODUCT', 'SERVICE', 'COURSE', 'PROGRAM', 'PROPERTY', 'PACKAGE', 'MENU_ITEM', 'OTHER_OFFERING'], required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, trim: true, index: true },
    price: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    currency: { type: String, default: 'BDT' },
    availability: String,
    attributes: { type: Schema.Types.Mixed, default: {} },
    images: [{ type: String }],
    canonicalUrl: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    merchantConfirmed: { type: Boolean, default: true },
    fingerprint: String,
    provenance: [{ sourceType: { type: String, required: true }, sourceUrl: String, sourceExternalId: String, fingerprint: { type: String, required: true }, lastSeenAt: Date, lastSyncedAt: Date }],
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
}, { timestamps: true });

OfferingSchema.plugin(tenantPlugin);
OfferingSchema.index({ businessId: 1, status: 1, offeringType: 1, name: 1 });
OfferingSchema.index({ businessId: 1, fingerprint: 1 }, { sparse: true });
OfferingSchema.index({ businessId: 1, canonicalUrl: 1 }, { sparse: true });

export const Offering = mongoose.model<IOffering>('Offering', OfferingSchema);
