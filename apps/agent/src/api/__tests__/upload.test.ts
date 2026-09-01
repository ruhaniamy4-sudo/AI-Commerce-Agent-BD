import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate, requireAdministrator } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { User } from '../../models/User'; import { Business } from '../../models/Business'; import { MerchantActivity } from '../../models/MerchantActivity';

const { storeUploadedImage } = vi.hoisted(() => ({ storeUploadedImage: vi.fn() }));
vi.mock('../../services/media-storage.service', () => {
    class MediaStorageError extends Error { constructor(message: string, public code: string) { super(message); } }
    return { MAX_IMAGE_BYTES: 8_000_000, SUPPORTED_IMAGE_TYPES: new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif']), MediaStorageError, storeUploadedImage };
});

import { MediaStorageError } from '../../services/media-storage.service';
import uploadRoutes from '../upload.routes';

const app = express().use('/api', authenticate, requireAdministrator, uploadRoutes);
const businessId = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId(); const membershipId = new mongoose.Types.ObjectId();
const token = () => signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('tenant-scoped managed image upload', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
        vi.clearAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as any);
        vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as any);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as any);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({} as any);vi.spyOn(User,'updateOne').mockResolvedValue({} as any);
        storeUploadedImage.mockResolvedValue({ provider: 'cloudinary', providerAssetId: `sellpilot/${businessId}/products/asset`, secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/asset.png', resourceType: 'image', mimeType: 'image/png', source: 'PRODUCT_UPLOAD', retention: 'persistent', retentionStatus: 'active', createdAt: new Date() });
    });

    it('accepts a validated Product image through the backend without exposing Cloudinary credentials', async () => {
        const response = await request(app).post('/api/upload/image').set('authorization', `Bearer ${token()}`).field('purpose', 'products').attach('file', png, { filename: '../unsafe name.png', contentType: 'image/png' }).expect(201);
        expect(storeUploadedImage).toHaveBeenCalledWith(expect.objectContaining({ businessId: businessId.toString(), mimeType: 'image/png', filename: 'unsafe name.png', source: 'PRODUCT_UPLOAD' }));
        expect(response.body.url).toMatch(/^https:\/\//);
        expect(JSON.stringify(response.body)).not.toMatch(/apiSecret|api_key|signature/i);
    });

    it('rejects unsupported content types before storage', async () => {
        await request(app).post('/api/upload/image').set('authorization', `Bearer ${token()}`).field('purpose', 'products').attach('file', Buffer.from('MZ executable'), { filename: 'bad.exe', contentType: 'application/octet-stream' }).expect(400);
        expect(storeUploadedImage).not.toHaveBeenCalled();
    });

    it('returns a clear service error when Cloudinary is missing', async () => {
        storeUploadedImage.mockRejectedValueOnce(new MediaStorageError('Image storage is not configured', 'NOT_CONFIGURED'));
        const response = await request(app).post('/api/upload/image').set('authorization', `Bearer ${token()}`).field('purpose', 'test-ai').attach('file', png, { filename: 'photo.png', contentType: 'image/png' }).expect(503);
        expect(response.body.error).toBe('Image storage is not configured');
    });
});
