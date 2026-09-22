import mongoose, { Document, Schema } from 'mongoose';

export interface IFeatureFlag extends Document {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
    /** 0–100. Applied by hashing the tenant id, so a tenant stays on the same side of the split. */
    rolloutPercent: number;
    planSlugs: string[];
    businessIds: mongoose.Types.ObjectId[];
    /** Overrides everything else, for turning a misbehaving feature off in one action. */
    killSwitch: boolean;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>({
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9_.-]{2,80}$/ },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 300 },
    enabled: { type: Boolean, default: false, index: true },
    rolloutPercent: { type: Number, default: 100, min: 0, max: 100 },
    planSlugs: { type: [String], default: [] },
    businessIds: { type: [Schema.Types.ObjectId], ref: 'Business', default: [] },
    killSwitch: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin' },
}, { timestamps: true });

export const FeatureFlag = mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);

/** Seeded so the console opens with the flags the product actually gates on. */
export const DEFAULT_FEATURE_FLAGS = [
    { key: 'channel.whatsapp', label: 'WhatsApp channel', description: 'Expose WhatsApp connection to eligible workspaces.', enabled: false, rolloutPercent: 100 },
    { key: 'channel.instagram', label: 'Instagram channel', description: 'Expose Instagram connection to eligible workspaces.', enabled: false, rolloutPercent: 100 },
    { key: 'intelligence.customer_scoring', label: 'Customer intelligence scoring', description: 'Show predictive customer scores in the merchant dashboard.', enabled: true, rolloutPercent: 100 },
    { key: 'commerce.store_builder', label: 'Store builder', description: 'Allow merchants to publish a hosted storefront.', enabled: true, rolloutPercent: 100 },
    { key: 'agent.auto_training', label: 'Automatic training', description: 'Let the agent learn from merchant corrections without review.', enabled: false, rolloutPercent: 25 },
    { key: 'billing.self_serve_checkout', label: 'Self-serve checkout', description: 'Merchants can upgrade without an operator.', enabled: false, rolloutPercent: 100 },
] as const;
