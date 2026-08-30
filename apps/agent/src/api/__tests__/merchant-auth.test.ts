import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../auth.routes';
import { clearAuthRateLimitsForTests } from '../../auth/rate-limit';
import { hashPassword } from '../../auth/password';
import { User } from '../../models/User';
import { Business } from '../../models/Business';
import { BusinessMember } from '../../models/BusinessMember';
import { signAccessToken, signAccountToken } from '../../auth/token';
import { MerchantActivity } from '../../models/MerchantActivity';

const app = express().use(express.json()).use('/auth', authRoutes);
const userId = new mongoose.Types.ObjectId();
const businessId = new mongoose.Types.ObjectId();
const membershipId = new mongoose.Types.ObjectId();

describe('merchant account and business onboarding', () => {
    beforeEach(() => { process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'; clearAuthRateLimitsForTests(); vi.restoreAllMocks(); });

    it('normalizes signup email, hashes the password, and never returns the hash', async () => {
        const create = vi.spyOn(User, 'create').mockImplementation(async (data: any) => ({ _id: userId, ...data }) as any);
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: ' OWNER@Example.COM ', password: '12345678' }).expect(201);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: 'owner@example.com' }));
        const saved = create.mock.calls[0][0] as any;
        expect(saved.passwordHash).not.toContain('12345678');
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body.needsOnboarding).toBe(true);
    });

    it('rejects merchant signup passwords shorter than eight characters', async () => {
        const create = vi.spyOn(User, 'create');
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: 'owner@example.com', password: '1234567' }).expect(400);
        expect(response.body.error).toContain('at least 8 characters');
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects duplicate email without exposing account data', async () => {
        vi.spyOn(User, 'create').mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: 'owner@example.com', password: '12345678' }).expect(409);
        expect(response.body).toEqual({ error: 'An account with this email already exists' });
    });

    it('logs in with the correct password and rejects the wrong password', async () => {
        const passwordHash = await hashPassword('correct password');
        const user = { _id: userId, name: 'Merchant', email: 'owner@example.com', passwordHash, status: 'active' };
        vi.spyOn(User, 'findOne').mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as any);
        vi.spyOn(BusinessMember, 'find').mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as any);
        const success = await request(app).post('/auth/login').send({ email: 'OWNER@example.com', password: 'correct password' }).expect(200);
        expect(success.body.accountToken).toBeTruthy(); expect(success.body.needsOnboarding).toBe(true);
        await request(app).post('/auth/login').send({ email: 'owner@example.com', password: 'wrong password' }).expect(401);
    });

    it('creates the business and Owner membership using the account identity', async () => {
        const user = { _id: userId, name: 'Merchant', email: 'owner@example.com', status: 'active' };
        vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);
        const createBusiness = vi.spyOn(Business, 'create').mockImplementation(async (data: any) => ({ _id: businessId, ...data }) as any);
        const createMembership = vi.spyOn(BusinessMember, 'create').mockResolvedValue({ _id: membershipId } as any);
        const response = await request(app).post('/auth/business').set('authorization', `Bearer ${signAccountToken(userId.toString())}`).send({ name: 'My Shop', businessType: 'Fashion', phone: '01700000000', preferredLanguage: 'bn' }).expect(201);
        expect(createBusiness).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Shop', currency: 'BDT' }));
        expect(createMembership).toHaveBeenCalledWith(expect.objectContaining({ businessId, userId, role: 'Owner' }));
        expect(response.body.accessToken).toBeTruthy(); expect(response.body.role).toBe('Owner');
    });

    it('updates only the authenticated tenant brand voice with validated controls', async () => {
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId, status: 'active' }) } as any);
        vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as any);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as any);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({} as any);vi.spyOn(User,'updateOne').mockResolvedValue({} as any);
        const update = vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({ _id: businessId, brandVoice: { tone: 'casual' } } as any);
        const token = signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });
        await request(app).patch('/auth/business/brand-voice').set('authorization', `Bearer ${token}`).send({ tone: 'casual', language: 'banglish', examples: ['Ji, kon size lagbe?'] }).expect(200);
        expect(update).toHaveBeenCalledWith(businessId.toString(), { $set: expect.objectContaining({ 'brandVoice.tone': 'casual', 'brandVoice.language': 'banglish', 'brandVoice.examples': ['Ji, kon size lagbe?'] }) }, expect.objectContaining({ new: true }));
        await request(app).patch('/auth/business/brand-voice').set('authorization', `Bearer ${token}`).send({ tone: 'unsafe' }).expect(400);
    });
});
