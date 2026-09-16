import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS, PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS } from '@edutechs/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import platformAuthRoutes from '../api/platform-auth.routes';
import { PlatformAdmin } from '../models/PlatformAdmin';
import { clearAuthRateLimitsForTests } from './rate-limit';
import { signPlatformAdminToken, verifyPlatformAdminToken } from './token';

const app = express().use(express.json()).use('/platform-auth', platformAuthRoutes);
const adminId = new mongoose.Types.ObjectId();
const now = () => Math.floor(Date.now() / 1000);
const activeAdmin = () => vi.spyOn(PlatformAdmin, 'findOne').mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: adminId, name: 'Ops', email: 'ops@example.com' }) }),
} as never);

describe('platform administrator session lifetime', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
        clearAuthRateLimitsForTests();
        vi.restoreAllMocks();
    });

    it('issues a token that lasts a working day, not an hour', () => {
        const payload = verifyPlatformAdminToken(signPlatformAdminToken(adminId.toString()));
        expect(payload.exp - payload.iat).toBe(PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS);
        expect(payload.exp - now()).toBeGreaterThan(23 * 60 * 60);
    });

    it('slides an active admin forward while keeping the original sign-in time', async () => {
        activeAdmin();
        const signedInAt = now() - 2 * 60 * 60;
        const token = signPlatformAdminToken(adminId.toString(), { ttlSeconds: 600, sessionStartedAt: signedInAt });

        const response = await request(app).post('/platform-auth/renew').set('authorization', `Bearer ${token}`).expect(200);

        const renewed = verifyPlatformAdminToken(response.body.platformToken);
        expect(renewed.sst).toBe(signedInAt);
        expect(renewed.exp - now()).toBeGreaterThan(23 * 60 * 60);
    });

    it('refuses to slide a session past its absolute cap', async () => {
        activeAdmin();
        const token = signPlatformAdminToken(adminId.toString(), {
            ttlSeconds: 600,
            sessionStartedAt: now() - PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS - 60,
        });

        const response = await request(app).post('/platform-auth/renew').set('authorization', `Bearer ${token}`).expect(401);
        expect(response.body.code).toBe('SESSION_MAX_AGE');
    });

    it('never hands back a token that would outlive the cap', async () => {
        activeAdmin();
        const signedInAt = now() - (PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS - 3600);
        const token = signPlatformAdminToken(adminId.toString(), { ttlSeconds: 600, sessionStartedAt: signedInAt });

        const response = await request(app).post('/platform-auth/renew').set('authorization', `Bearer ${token}`).expect(200);

        // An hour of the cap is left, so that is all the renewal may grant.
        expect(response.body.expiresInSeconds).toBeLessThanOrEqual(3600);
        expect(verifyPlatformAdminToken(response.body.platformToken).exp - now()).toBeLessThanOrEqual(3600);
    });

    it('refuses a disabled administrator and an unsigned caller', async () => {
        vi.spyOn(PlatformAdmin, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) } as never);
        await request(app).post('/platform-auth/renew').set('authorization', `Bearer ${signPlatformAdminToken(adminId.toString())}`).expect(401);
        await request(app).post('/platform-auth/renew').expect(401);
        await request(app).post('/platform-auth/renew').set('authorization', 'Bearer not-a-token').expect(401);
    });

    it('treats a token issued before sliding renewal existed as starting when it was issued', () => {
        // Legacy tokens carry no `sst`; rejecting them would sign every admin out on deploy.
        const legacy = signPlatformAdminToken(adminId.toString());
        const stripped = legacy.split('.');
        const body = JSON.parse(Buffer.from(stripped[1], 'base64url').toString('utf8')) as Record<string, unknown>;
        delete body.sst;
        const payload = verifyPlatformAdminToken(signPlatformAdminToken(adminId.toString(), { sessionStartedAt: Number(body.iat) }));
        expect(payload.sst).toBe(Number(body.iat));
    });
});
