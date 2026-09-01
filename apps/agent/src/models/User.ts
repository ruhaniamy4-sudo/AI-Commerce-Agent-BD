import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    passwordHash?: string;
    emailVerified: boolean;
    emailVerifiedAt?: Date;
    emailVerificationMethod?: 'email_link' | 'oauth' | 'bootstrap' | 'legacy';
    verificationEmailLastSentAt?: Date;
    passwordResetEmailLastSentAt?: Date;
    providerAccounts: Array<{ provider: 'google' | 'facebook'; accountId: string }>;
    status: 'active' | 'disabled';
    lastSeenAt?: Date;
    passwordChangedAt?: Date;
    failedLoginAttempts: number;
    lockedUntil?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    emailVerificationMethod: { type: String, enum: ['email_link', 'oauth', 'bootstrap', 'legacy'] },
    verificationEmailLastSentAt: Date,
    passwordResetEmailLastSentAt: Date,
    providerAccounts: [{
        provider: { type: String, enum: ['google', 'facebook'], required: true },
        accountId: { type: String, required: true },
    }],
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    lastSeenAt: { type: Date, index: true },
    passwordChangedAt: Date,
    failedLoginAttempts: { type: Number, default: 0, min: 0, select: false },
    lockedUntil: { type: Date, select: false },
}, { timestamps: true });

UserSchema.index(
    { 'providerAccounts.provider': 1, 'providerAccounts.accountId': 1 },
    { unique: true, partialFilterExpression: { 'providerAccounts.accountId': { $type: 'string' } } }
);
UserSchema.index({ status: 1, lastSeenAt: -1 });
UserSchema.index({ emailVerified: 1, status: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
