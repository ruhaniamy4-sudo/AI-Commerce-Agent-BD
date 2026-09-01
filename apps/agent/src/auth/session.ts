import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MERCHANT_SESSION_MAX_AGE_SECONDS } from '@edutechs/shared';
import { AuthSession, AuthSessionType } from '../models/AuthSession';
import { BusinessRole } from '../tenancy/context';

const REFRESH_TOKEN_BYTES = 48;

export interface SessionIdentity {
    userId: string;
    type: AuthSessionType;
    businessId?: string;
    membershipId?: string;
    role?: BusinessRole;
    familyId?: string;
}

export interface SessionMetadata {
    userAgent?: string;
    ip?: string;
}

export function hashRefreshToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function hashIp(ip?: string) {
    return ip ? crypto.createHash('sha256').update(ip).digest('hex') : undefined;
}

function opaqueRefreshToken() {
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export async function createAuthSession(identity: SessionIdentity, metadata: SessionMetadata = {}) {
    const refreshToken = opaqueRefreshToken();
    const expiresAt = new Date(Date.now() + MERCHANT_SESSION_MAX_AGE_SECONDS * 1000);
    const session = await AuthSession.create({
        userId: new mongoose.Types.ObjectId(identity.userId),
        type: identity.type,
        refreshTokenHash: hashRefreshToken(refreshToken),
        familyId: identity.familyId ? new mongoose.Types.ObjectId(identity.familyId) : new mongoose.Types.ObjectId(),
        businessId: identity.businessId ? new mongoose.Types.ObjectId(identity.businessId) : undefined,
        membershipId: identity.membershipId ? new mongoose.Types.ObjectId(identity.membershipId) : undefined,
        role: identity.role,
        expiresAt,
        userAgent: metadata.userAgent?.slice(0, 300),
        ipHash: hashIp(metadata.ip),
    });
    return { session, refreshToken, expiresAt };
}

export async function rotateAuthSession(refreshToken: string, metadata: SessionMetadata = {}) {
    const now = new Date();
    const previous = await AuthSession.findOneAndUpdate(
        { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null, expiresAt: { $gt: now } },
        { $set: { revokedAt: now, revokeReason: 'rotated', lastUsedAt: now } },
        { new: false, select: '+refreshTokenHash' }
    );
    if (!previous) {
        const replayed = await AuthSession.findOne({ refreshTokenHash: hashRefreshToken(refreshToken), revokeReason: 'rotated' })
            .select('+refreshTokenHash familyId')
            .lean();
        if (replayed?.familyId) {
            await AuthSession.updateMany(
                { familyId: replayed.familyId, revokedAt: null },
                { $set: { revokedAt: now, revokeReason: 'refresh_token_replay' } }
            );
        }
        return null;
    }
    const next = await createAuthSession({
        userId: previous.userId.toString(),
        type: previous.type,
        businessId: previous.businessId?.toString(),
        membershipId: previous.membershipId?.toString(),
        role: previous.role,
        familyId: previous.familyId?.toString(),
    }, metadata);
    await AuthSession.updateOne({ _id: previous._id }, { $set: { rotatedToSessionId: next.session._id } });
    return { previous, ...next };
}

export async function revokeRefreshToken(refreshToken: string, reason = 'logout') {
    if (!refreshToken) return false;
    const result = await AuthSession.updateOne(
        { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: reason } }
    );
    return result.modifiedCount > 0;
}

export async function revokeAllUserSessions(userId: string, reason: string) {
    return AuthSession.updateMany(
        { userId: new mongoose.Types.ObjectId(userId), revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: reason.slice(0, 120) } }
    );
}

export async function isSessionActive(sessionId: string, identity: SessionIdentity) {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return false;
    const query: Record<string, unknown> = {
        _id: sessionId,
        userId: identity.userId,
        type: identity.type,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    };
    if (identity.businessId) query.businessId = identity.businessId;
    if (identity.membershipId) query.membershipId = identity.membershipId;
    if (identity.role) query.role = identity.role;
    return Boolean(await AuthSession.exists(query));
}
