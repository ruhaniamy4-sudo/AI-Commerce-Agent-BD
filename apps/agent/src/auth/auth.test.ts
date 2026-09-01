import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessMember } from '../models/BusinessMember';
import { Business } from '../models/Business';
import { User } from '../models/User';
import { MerchantActivity } from '../models/MerchantActivity';
import { authenticate, authenticateAccount, authorize, AuthenticatedRequest } from './middleware';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, signAccountToken } from './token';
import { MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS, PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { AuthSession } from '../models/AuthSession';

describe('authentication and role authorization', () => {
    const businessId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    const membershipId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
        vi.restoreAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({ _id: membershipId }),
        } as never);
        vi.spyOn(User, 'findOne').mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: userId }) }) } as never);
        vi.spyOn(Business, 'findOne').mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: businessId }) }) } as never);
        vi.spyOn(MerchantActivity, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
        vi.spyOn(User, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
    });

    function token(role: 'Owner' | 'Admin' | 'Staff') {
        return signAccessToken({ sub: userId, businessId, membershipId, role });
    }

    it('hashes passwords with a salt and verifies without storing plaintext', async () => {
        const encoded = await hashPassword('a-secure-password');
        expect(encoded).not.toContain('a-secure-password');
        await expect(verifyPassword('a-secure-password', encoded)).resolves.toBe(true);
        await expect(verifyPassword('wrong-password', encoded)).resolves.toBe(false);
    });

    it('accepts the minimum password length and rejects shorter passwords', async () => {
        const password = 'S3curePass!';
        const encoded = await hashPassword(password);
        await expect(verifyPassword(password, encoded)).resolves.toBe(true);
        await expect(hashPassword('Short1!')).rejects.toThrow(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    });

    it('returns 401 without a bearer token', async () => {
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));
        await request(app).get('/protected').expect(401);
    });

    it('issues merchant tokens for the full dashboard session lifetime and rejects expired ones', async () => {
        const activeToken = token('Owner');
        const payload = JSON.parse(Buffer.from(activeToken.split('.')[1], 'base64url').toString('utf8'));
        expect(payload.purpose).toBe('merchant');
        expect(payload.exp - payload.iat).toBe(MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS);

        const expiredToken = signAccessToken({ sub: userId, businessId, membershipId, role: 'Owner' }, -1);
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));
        await request(app).get('/protected').set('authorization', `Bearer ${expiredToken}`).expect(401);
    });

    it('keeps user suspension separate from business suspension', async () => {
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));
        vi.mocked(User.findOne).mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) } as never);
        await request(app).get('/protected').set('authorization', `Bearer ${token('Owner')}`).expect(401);
        vi.mocked(User.findOne).mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: userId }) }) } as never);
        vi.mocked(Business.findOne).mockReturnValueOnce({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) } as never);
        await request(app).get('/protected').set('authorization', `Bearer ${token('Owner')}`).expect(403);
    });

    it('requires the backing refresh session for newly issued session-bound access tokens', async () => {
        const sessionId = new mongoose.Types.ObjectId().toString();
        const sessionToken = signAccessToken({ sub: userId, businessId, membershipId, role: 'Owner', sid: sessionId });
        const active = vi.spyOn(AuthSession, 'exists').mockResolvedValue({ _id: sessionId } as any);
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));
        await request(app).get('/protected').set('authorization', `Bearer ${sessionToken}`).expect(204);
        active.mockResolvedValueOnce(null);
        await request(app).get('/protected').set('authorization', `Bearer ${sessionToken}`).expect(401, { error: 'Session is no longer active' });
    });

    it('accepts a short-lived account token only on pre-business routes', async () => {
        const accountToken = signAccountToken(userId);
        const accountApp = express().get('/account', authenticateAccount, (req, res) => res.json((req as any).account));
        const response = await request(accountApp).get('/account').set('authorization', `Bearer ${accountToken}`).expect(200);
        expect(response.body.userId).toBe(userId);
        const tenantApp = express().get('/tenant', authenticate, (_req, res) => res.sendStatus(204));
        await request(tenantApp).get('/tenant').set('authorization', `Bearer ${accountToken}`).expect(401);
    });

    it('allows Owner and Admin but denies Staff on administrator routes', async () => {
        const app = express().get('/admin-only', authenticate, authorize('Owner', 'Admin'), (_req, res) => res.sendStatus(204));
        await request(app).get('/admin-only').set('authorization', `Bearer ${token('Owner')}`).expect(204);
        await request(app).get('/admin-only').set('authorization', `Bearer ${token('Admin')}`).expect(204);
        await request(app).get('/admin-only').set('authorization', `Bearer ${token('Staff')}`).expect(403);
    });

    it('binds the request to the business in the validated membership', async () => {
        const app = express().get('/whoami', authenticate, (req: AuthenticatedRequest, res) => res.json(req.auth));
        const response = await request(app)
            .get('/whoami')
            .set('authorization', `Bearer ${token('Staff')}`)
            .set('x-business-id', new mongoose.Types.ObjectId().toString())
            .expect(200);
        expect(response.body.businessId).toBe(businessId);
    });

    it('does not turn activity tracking failures into authentication failures', async () => {
        vi.mocked(MerchantActivity.updateOne).mockRejectedValueOnce(new Error('activity store unavailable'));
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));

        await request(app)
            .get('/protected')
            .set('authorization', `Bearer ${token('Owner')}`)
            .expect(204);
    });

    it('passes infrastructure failures to the error handler instead of reporting an invalid token', async () => {
        vi.mocked(BusinessMember.findOne).mockImplementationOnce(() => {
            throw new Error('membership store unavailable');
        });
        const app = express()
            .get('/protected', authenticate, (_req, res) => res.sendStatus(204))
            .use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
                res.status(503).json({ error: error.message });
            });

        await request(app)
            .get('/protected')
            .set('authorization', `Bearer ${token('Owner')}`)
            .expect(503, { error: 'membership store unavailable' });
    });
});
