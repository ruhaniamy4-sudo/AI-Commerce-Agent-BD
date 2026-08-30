import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatePlatformAdmin, authorize, authenticate } from './middleware';
import { signAccessToken, signPlatformAdminToken } from './token';
import { BusinessMember } from '../models/BusinessMember';
import { PlatformAdmin } from '../models/PlatformAdmin';
import platformAuthRoutes from '../api/platform-auth.routes';
import { hashPassword } from './password';
import { clearAuthRateLimitsForTests } from './rate-limit';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { MerchantActivity } from '../models/MerchantActivity';
import { PlatformAuditLog } from '../models/PlatformAuditLog';

describe('separate platform administrator authorization', () => {
    const adminId = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId(); const businessId = new mongoose.Types.ObjectId(); const membershipId = new mongoose.Types.ObjectId();
    beforeEach(() => { process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'; clearAuthRateLimitsForTests(); vi.restoreAllMocks(); vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as never);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as never);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({acknowledged:true} as never);vi.spyOn(User,'updateOne').mockResolvedValue({acknowledged:true} as never);vi.spyOn(PlatformAuditLog,'create').mockResolvedValue({} as never); });

    it('issues a platform-only token for correct dedicated credentials', async () => {
        const passwordHash = await hashPassword('platform password');
        const save = vi.fn().mockResolvedValue(undefined);
        vi.spyOn(PlatformAdmin, 'findOne').mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: adminId, name: 'Operator', email: 'operator@example.com', passwordHash, status: 'active', save }) } as never);
        const authApp = express().use(express.json()).use('/platform-auth', platformAuthRoutes);
        const response = await request(authApp).post('/platform-auth/login').send({ email: 'operator@example.com', password: 'platform password' }).expect(200);
        expect(response.body.platformToken).toBeTruthy(); expect(response.body.admin).not.toHaveProperty('passwordHash');
        await request(authApp).post('/platform-auth/login').send({ email: 'operator@example.com', password: 'wrong password' }).expect(401);
    });

    it('rejects merchant Owner and Admin tokens on platform APIs', async () => {
        const app = express().get('/platform', authenticatePlatformAdmin, (_req, res) => res.sendStatus(204));
        for (const role of ['Owner', 'Admin'] as const) {
            const token = signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role });
            await request(app).get('/platform').set('authorization', `Bearer ${token}`).expect(401);
        }
    });

    it('accepts only an active dedicated platform administrator', async () => {
        const membershipLookup = vi.spyOn(BusinessMember, 'findOne');
        vi.spyOn(PlatformAdmin, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: adminId, name: 'Operator', email: 'operator@example.com', status: 'active' }) } as never);
        const app = express().get('/platform', authenticatePlatformAdmin, (req, res) => res.json((req as any).platformAdmin));
        const response = await request(app).get('/platform').set('authorization', `Bearer ${signPlatformAdminToken(adminId.toString())}`).expect(200);
        expect(response.body.email).toBe('operator@example.com'); expect(membershipLookup).not.toHaveBeenCalled();
    });

    it('keeps Staff out of Owner-only merchant configuration', async () => {
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as never);
        const app = express().patch('/owner-settings', authenticate, authorize('Owner'), (_req, res) => res.sendStatus(204));
        const staff = signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Staff' });
        await request(app).patch('/owner-settings').set('authorization', `Bearer ${staff}`).expect(403);
    });
});
