import mongoose, { Document, Schema } from 'mongoose';
import { BUSINESS_ROLES, BusinessRole } from '../tenancy/context';

export interface IBusinessMember extends Document {
    businessId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    role: BusinessRole;
    status: 'active' | 'invited' | 'disabled';
}

const BusinessMemberSchema = new Schema<IBusinessMember>({
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: BUSINESS_ROLES, required: true },
    status: { type: String, enum: ['active', 'invited', 'disabled'], default: 'active' },
}, { timestamps: true });

BusinessMemberSchema.index({ businessId: 1, userId: 1 }, { unique: true });
BusinessMemberSchema.index({ userId: 1, status: 1 });

export const BusinessMember = mongoose.model<IBusinessMember>('BusinessMember', BusinessMemberSchema);
