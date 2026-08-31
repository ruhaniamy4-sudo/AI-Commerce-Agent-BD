import mongoose, { Document, Schema } from 'mongoose';

export interface IBusinessChannel extends Document {
    businessId: mongoose.Types.ObjectId;
    platform: 'facebook' | 'web';
    externalId: string;
    name: string;
    status: 'active' | 'disabled';
    pagePicture?: string;
    pageCategory?: string;
    encryptedAccessToken?: string;
    connectionStatus: 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED' | 'NEEDS_ATTENTION' | 'REAUTHORIZATION_REQUIRED' | 'DISCONNECTED' | 'ERROR';
    permissions: string[];
    capabilities?: Record<string, boolean>;
    connectedAt?: Date;
    lastVerifiedAt?: Date;
    lastEventAt?: Date;
    lastInboundAt?: Date;
    lastOutboundAt?: Date;
    reauthorizationRequired: boolean;
    subscription?: { subscribed: boolean; fields: string[]; verifiedAt?: Date; lastErrorCode?: string };
    authorizedByMetaUserId?: string;
    lastErrorCode?: string;
}

const BusinessChannelSchema = new Schema<IBusinessChannel>({
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    platform: { type: String, enum: ['facebook', 'web'], required: true },
    externalId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    pagePicture: String,
    pageCategory: String,
    encryptedAccessToken: { type: String, select: false },
    connectionStatus: { type: String, enum: ['NOT_CONNECTED','CONNECTING','CONNECTED','NEEDS_ATTENTION','REAUTHORIZATION_REQUIRED','DISCONNECTED','ERROR'], default: 'NOT_CONNECTED', index: true },
    permissions: [{ type: String }],
    capabilities: { type: Schema.Types.Mixed, default: {} },
    connectedAt: Date,
    lastVerifiedAt: Date,
    lastEventAt: Date,
    lastInboundAt: Date,
    lastOutboundAt: Date,
    reauthorizationRequired: { type: Boolean, default: false, index: true },
    subscription: { subscribed: { type: Boolean, default: false }, fields: [{ type: String }], verifiedAt: Date, lastErrorCode: String },
    authorizedByMetaUserId: { type: String, select: false },
    lastErrorCode: String,
}, { timestamps: true });

BusinessChannelSchema.index({ platform: 1, externalId: 1 }, { unique: true });
BusinessChannelSchema.index({ businessId: 1, status: 1 });
BusinessChannelSchema.index({ businessId: 1, platform: 1, connectionStatus: 1 });

export const BusinessChannel = mongoose.model<IBusinessChannel>('BusinessChannel', BusinessChannelSchema);
