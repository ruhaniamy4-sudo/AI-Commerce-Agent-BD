import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../models/AuthSession';
import { createAuthSession, hashRefreshToken, isSessionActive, revokeAllUserSessions, revokeRefreshToken, rotateAuthSession } from './session';

describe('refresh session lifecycle', () => {
    const userId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => vi.restoreAllMocks());

    it('stores only a hash of the opaque refresh token', async () => {
        const create = vi.spyOn(AuthSession, 'create').mockImplementation(async (value: any) => ({ _id: new mongoose.Types.ObjectId(), ...value }) as any);
        const issued = await createAuthSession({ userId, type: 'account' }, { ip: '127.0.0.1', userAgent: 'test' });
        expect(issued.refreshToken.length).toBeGreaterThan(40);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: hashRefreshToken(issued.refreshToken) }));
        expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(issued.refreshToken);
    });

    it('atomically revokes the old token and links a rotated session', async () => {
        const oldId = new mongoose.Types.ObjectId();
        vi.spyOn(AuthSession, 'findOneAndUpdate').mockResolvedValue({ _id: oldId, userId: new mongoose.Types.ObjectId(userId), type: 'account' } as any);
        vi.spyOn(AuthSession, 'create').mockImplementation(async (value: any) => ({ _id: new mongoose.Types.ObjectId(), ...value }) as any);
        const update = vi.spyOn(AuthSession, 'updateOne').mockResolvedValue({ acknowledged: true } as any);
        const rotated = await rotateAuthSession('old-refresh-token');
        expect(rotated?.refreshToken).toBeTruthy();
        expect(rotated?.refreshToken).not.toBe('old-refresh-token');
        expect(update).toHaveBeenCalledWith({ _id: oldId }, { $set: { rotatedToSessionId: rotated?.session._id } });
    });

    it('rejects unknown sessions and supports one/all-session revocation', async () => {
        vi.spyOn(AuthSession, 'exists').mockResolvedValue(null);
        await expect(isSessionActive(new mongoose.Types.ObjectId().toString(), { userId, type: 'account' })).resolves.toBe(false);
        const one = vi.spyOn(AuthSession, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);
        await expect(revokeRefreshToken('refresh-token')).resolves.toBe(true);
        expect(one).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: hashRefreshToken('refresh-token') }), expect.anything());
        const all = vi.spyOn(AuthSession, 'updateMany').mockResolvedValue({ modifiedCount: 3 } as any);
        await revokeAllUserSessions(userId, 'password_reset');
        expect(all).toHaveBeenCalledWith(expect.objectContaining({ userId: new mongoose.Types.ObjectId(userId), revokedAt: null }), expect.anything());
    });

    it('revokes a token family when a rotated refresh token is replayed', async () => {
        const familyId = new mongoose.Types.ObjectId();
        vi.spyOn(AuthSession, 'findOneAndUpdate').mockResolvedValue(null);
        vi.spyOn(AuthSession, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ familyId }) }) } as any);
        const revokeFamily = vi.spyOn(AuthSession, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any);
        await expect(rotateAuthSession('replayed-token')).resolves.toBeNull();
        expect(revokeFamily).toHaveBeenCalledWith({ familyId, revokedAt: null }, { $set: expect.objectContaining({ revokeReason: 'refresh_token_replay' }) });
    });
});
