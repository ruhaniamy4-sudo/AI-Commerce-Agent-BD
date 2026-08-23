import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessMember } from '../models/BusinessMember';
import { authenticate, authorize, AuthenticatedRequest } from './middleware';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken } from './token';

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

    it('returns 401 without a bearer token', async () => {
        const app = express().get('/protected', authenticate, (_req, res) => res.sendStatus(204));
        await request(app).get('/protected').expect(401);
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
