import mongoose, { Document, Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type CourierProviderName = 'steadfast';

export interface ICourierIntegration extends Document {
    businessId: mongoose.Types.ObjectId;
    provider: CourierProviderName;
    status: 'connected' | 'disabled' | 'error';
    credentialsEncrypted: string;
    settings: { deliveryType: 0 | 1 };
    lastTestedAt?: Date;
    lastErrorCode?: string;
    createdAt: Date;
    updatedAt: Date;
}

const CourierIntegrationSchema = new Schema<ICourierIntegration>({
    provider: { type: String, enum: ['steadfast'], required: true },
    status: { type: String, enum: ['connected', 'disabled', 'error'], default: 'connected', index: true },
    credentialsEncrypted: { type: String, required: true, select: false },
    settings: {
        deliveryType: { type: Number, enum: [0, 1], default: 0 },
    },
    lastTestedAt: { type: Date },
    lastErrorCode: { type: String },
}, { timestamps: true });

CourierIntegrationSchema.plugin(tenantPlugin);
CourierIntegrationSchema.index({ businessId: 1, provider: 1 }, { unique: true });
CourierIntegrationSchema.index({ businessId: 1, status: 1, updatedAt: -1 });

export const CourierIntegration = mongoose.model<ICourierIntegration>('CourierIntegration', CourierIntegrationSchema);
