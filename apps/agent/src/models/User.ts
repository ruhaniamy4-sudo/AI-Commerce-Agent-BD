import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    passwordHash?: string;
    emailVerified: boolean;
    providerAccounts: Array<{ provider: 'google' | 'facebook'; accountId: string }>;
    status: 'active' | 'disabled';
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    providerAccounts: [{
        provider: { type: String, enum: ['google', 'facebook'], required: true },
        accountId: { type: String, required: true },
    }],
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
}, { timestamps: true });

UserSchema.index(
    { 'providerAccounts.provider': 1, 'providerAccounts.accountId': 1 },
    { unique: true, partialFilterExpression: { 'providerAccounts.accountId': { $type: 'string' } } }
);

export const User = mongoose.model<IUser>('User', UserSchema);
