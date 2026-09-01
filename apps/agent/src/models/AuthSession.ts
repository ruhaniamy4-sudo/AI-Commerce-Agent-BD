import mongoose, { Document, Schema } from 'mongoose';
import { BUSINESS_ROLES, BusinessRole } from '../tenancy/context';

export type AuthSessionType = 'account' | 'merchant';

export interface IAuthSession extends Document {
    userId: mongoose.Types.ObjectId;
    type: AuthSessionType;
    refreshTokenHash: string;
    familyId: mongoose.Types.ObjectId;
    businessId?: mongoose.Types.ObjectId;
    membershipId?: mongoose.Types.ObjectId;
    role?: BusinessRole;
    expiresAt: Date;
    lastUsedAt?: Date;
    revokedAt?: Date;
    revokeReason?: string;
    rotatedToSessionId?: mongoose.Types.ObjectId;
    userAgent?: string;
    ipHash?: string;
    createdAt: Date;
    updatedAt: Date;
}

const AuthSessionSchema = new Schema<IAuthSession>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['account', 'merchant'], required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true, select: false },
    familyId: { type: Schema.Types.ObjectId, required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'BusinessMember' },
    role: { type: String, enum: BUSINESS_ROLES },
    expiresAt: { type: Date, required: true },
    lastUsedAt: Date,
    revokedAt: { type: Date, index: true },
    revokeReason: { type: String, maxlength: 120 },
    rotatedToSessionId: { type: Schema.Types.ObjectId, ref: 'AuthSession' },
    userAgent: { type: String, maxlength: 300 },
    ipHash: { type: String, maxlength: 64 },
}, { timestamps: true });

AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1 });
AuthSessionSchema.index({ familyId: 1, revokedAt: 1 });
AuthSessionSchema.index({ businessId: 1, userId: 1, revokedAt: 1 });

export const AuthSession = mongoose.model<IAuthSession>('AuthSession', AuthSessionSchema);
