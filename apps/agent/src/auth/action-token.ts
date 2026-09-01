import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { AuthActionToken, AuthActionTokenType } from '../models/AuthActionToken';

const validityMs: Record<AuthActionTokenType, number> = {
    email_verification: 24 * 60 * 60 * 1000,
    password_reset: 60 * 60 * 1000,
};

function tokenHash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueAuthActionToken(userId: string, type: AuthActionTokenType) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();
    await AuthActionToken.updateMany(
        { userId: new mongoose.Types.ObjectId(userId), type, consumedAt: null, expiresAt: { $gt: now } },
        { $set: { consumedAt: now } }
    );
    const record = await AuthActionToken.create({
        userId: new mongoose.Types.ObjectId(userId),
        type,
        tokenHash: tokenHash(token),
        expiresAt: new Date(now.getTime() + validityMs[type]),
    });
    return { token, expiresAt: record.expiresAt };
}

export async function consumeAuthActionToken(token: string, type: AuthActionTokenType) {
    if (!token || token.length > 200) return null;
    return AuthActionToken.findOneAndUpdate(
        { tokenHash: tokenHash(token), type, consumedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { consumedAt: new Date() } },
        { new: false, select: '+tokenHash' }
    );
}
