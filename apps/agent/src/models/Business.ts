import mongoose, { Document, Schema } from 'mongoose';

export interface IBusiness extends Document {
    name: string;
    slug: string;
    status: 'active' | 'suspended';
    businessType?: string;
    phone?: string;
    website?: string;
    preferredLanguage: 'bn' | 'en';
    currency: 'BDT';
    onboarding: {
        productAdded: boolean;
        knowledgeAdded: boolean;
        channelConfigured: boolean;
        aiTested: boolean;
        completedAt?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    businessType: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    preferredLanguage: { type: String, enum: ['bn', 'en'], default: 'bn' },
    currency: { type: String, enum: ['BDT'], default: 'BDT' },
    onboarding: {
        productAdded: { type: Boolean, default: false },
        knowledgeAdded: { type: Boolean, default: false },
        channelConfigured: { type: Boolean, default: false },
        aiTested: { type: Boolean, default: false },
        completedAt: { type: Date },
    },
}, { timestamps: true });

export const Business = mongoose.model<IBusiness>('Business', BusinessSchema);
