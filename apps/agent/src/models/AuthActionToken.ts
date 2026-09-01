import mongoose, { Document, Schema } from 'mongoose';

export type AuthActionTokenType = 'email_verification' | 'password_reset';

export interface IAuthActionToken extends Document {
    userId: mongoose.Types.ObjectId;
    type: AuthActionTokenType;
    tokenHash: string;
    expiresAt: Date;
    consumedAt?: Date;
    createdAt: Date;
}

const AuthActionTokenSchema = new Schema<IAuthActionToken>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['email_verification', 'password_reset'], required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } });

AuthActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthActionTokenSchema.index({ userId: 1, type: 1, consumedAt: 1, createdAt: -1 });

export const AuthActionToken = mongoose.model<IAuthActionToken>('AuthActionToken', AuthActionTokenSchema);
