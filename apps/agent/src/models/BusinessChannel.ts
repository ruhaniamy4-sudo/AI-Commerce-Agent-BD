import mongoose, { Document, Schema } from 'mongoose';

export interface IBusinessChannel extends Document {
    businessId: mongoose.Types.ObjectId;
    platform: 'facebook' | 'web';
    externalId: string;
    name: string;
    status: 'active' | 'disabled';
}

const BusinessChannelSchema = new Schema<IBusinessChannel>({
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    platform: { type: String, enum: ['facebook', 'web'], required: true },
    externalId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
}, { timestamps: true });

BusinessChannelSchema.index({ platform: 1, externalId: 1 }, { unique: true });
BusinessChannelSchema.index({ businessId: 1, status: 1 });

export const BusinessChannel = mongoose.model<IBusinessChannel>('BusinessChannel', BusinessChannelSchema);
