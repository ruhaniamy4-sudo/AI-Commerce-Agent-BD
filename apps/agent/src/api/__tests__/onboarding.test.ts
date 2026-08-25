import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { Business } from '../../models/Business';
import { Category } from '../../models/Category';
import { Product } from '../../models/Product';
import { Knowledge } from '../../models/Knowledge';
import onboardingRoutes from '../onboarding.routes';

const app = express().use(express.json()).use('/onboarding', authenticate, onboardingRoutes);
const businessId = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId(); const membershipId = new mongoose.Types.ObjectId(); const categoryId = new mongoose.Types.ObjectId();
function token(role: 'Owner' | 'Admin' | 'Staff' = 'Owner') { return signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role }); }

describe('onboarding tenant writes', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'; vi.restoreAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as any);
        vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({} as any);
    });
    it('preserves role authorization and denies Staff setup writes', async () => {
        await request(app).post('/onboarding/product').set('authorization', `Bearer ${token('Staff')}`).send({ name: 'Black T-Shirt', description: 'Cotton shirt', price: 1490, stock: 10 }).expect(403);
    });
    it('creates the onboarding product in the authenticated business', async () => {
        vi.spyOn(Category, 'findOne').mockResolvedValue({ _id: categoryId } as any);
        const create = vi.spyOn(Product, 'create').mockImplementation(async (data: any) => data as any);
        await request(app).post('/onboarding/product').set('authorization', `Bearer ${token()}`).send({ name: 'Black T-Shirt', description: 'Cotton shirt in M, L, XL', price: 1490, stock: 10 }).expect(201);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ businessId: businessId.toString(), name: 'Black T-Shirt', basePrice: 1490, stock: 10 }));
    });
    it('creates active RAG knowledge in the authenticated business', async () => {
        const create = vi.spyOn(Knowledge, 'create').mockImplementation(async (data: any) => data as any);
        await request(app).post('/onboarding/knowledge').set('authorization', `Bearer ${token()}`).send({ title: 'Delivery policy', content: 'Delivery takes three business days.', type: 'POLICY', language: 'en' }).expect(201);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ businessId: businessId.toString(), status: 'active', title: 'Delivery policy', createdBy: userId.toString() }));
    });
});
