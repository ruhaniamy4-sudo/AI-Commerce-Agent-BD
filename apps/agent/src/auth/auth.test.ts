import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessMember } from '../models/BusinessMember';
import { authenticate, authenticateAccount, authorize, AuthenticatedRequest } from './middleware';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, signAccountToken } from './token';

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

    it('accepts exactly eight characters and rejects seven-character passwords', async () => {
        const encoded = await hashPassword('12345678');
        await expect(verifyPassword('12345678', encoded)).resolves.toBe(true);
        await expect(hashPassword('1234567')).rejects.toThrow('Password must be at least 8 characters');
    });

    it('returns 401 without a bearer token', async () => {
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));
        await request(app).get('/protected').expect(401);
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
});
