import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, requireAdministrator } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { generateSignature } from '../../services/cloudinary.service';
import uploadRoutes from '../upload.routes';
import { User } from '../../models/User'; import { Business } from '../../models/Business'; import { MerchantActivity } from '../../models/MerchantActivity';

vi.mock('../../services/cloudinary.service', () => ({
    generateSignature: vi.fn((folder: string) => ({ timestamp: 1, signature: 'signed', apiKey: 'public-key', cloudName: 'test-cloud', folder })),
}));

const app = express().use('/api', authenticate, requireAdministrator, uploadRoutes);
const businessId = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId(); const membershipId = new mongoose.Types.ObjectId();
const token = () => signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });

describe('managed image upload signature', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
        vi.clearAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as any);
        vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as any);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as any);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({} as any);vi.spyOn(User,'updateOne').mockResolvedValue({} as any);
    });

    it('signs a tenant-scoped managed-storage folder without exposing the secret', async () => {
        const response = await request(app).get('/api/upload/signature?folder=products').set('authorization', `Bearer ${token()}`).expect(200);
        const expectedFolder = `sellpilot/${businessId}/products`;
        expect(generateSignature).toHaveBeenCalledWith(expectedFolder);
        expect(response.body).toMatchObject({ folder: expectedFolder, signature: 'signed', apiKey: 'public-key' });
        expect(JSON.stringify(response.body)).not.toContain('apiSecret');
    });
});
