import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenantContext } from '../tenancy/context';
import { Message } from '../models/Message';
import { Product } from '../models/Product';
import { Conversation } from '../models/Conversation';

const mocks = vi.hoisted(() => ({
    configured: vi.fn(), upload: vi.fn(), resource: vi.fn(), destroy: vi.fn(), list: vi.fn(), publicId: vi.fn(), fetch: vi.fn(),
}));
vi.mock('./cloudinary.service', () => ({
    isCloudinaryConfigured: mocks.configured, uploadImageBuffer: mocks.upload, getCloudinaryImage: mocks.resource,
    deleteCloudinaryImage: mocks.destroy, listCloudinaryImages: mocks.list, cloudinaryPublicIdFromUrl: mocks.publicId,
}));
vi.mock('./ingestion/external-image.service', () => ({ fetchPublicImage: mocks.fetch }));

import { cleanupDetachedProductMedia, cleanupExpiredCustomerMedia, hasSupportedImageSignature, MediaStorageError, persistConversationImage, resolveOwnedMediaUrl, safeImageFilename, storeUploadedImage } from './media-storage.service';

const businessId = '507f1f77bcf86cd799439011';
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'owner', membershipId: 'member', role: 'Owner' }, work);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const uploaded = { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/sellpilot/stable.png', public_id: `sellpilot/${businessId}/customers/stable`, resource_type: 'image', format: 'png', bytes: png.length, width: 10, height: 20, created_at: new Date().toISOString() };

describe('shared tenant media storage', () => {
    beforeEach(() => {
        vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.upload.mockResolvedValue(uploaded); mocks.resource.mockResolvedValue(uploaded);
        mocks.fetch.mockResolvedValue({ url: 'https://public.example/photo.png', buffer: png, contentType: 'image/png' });
    });
    afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

    it('validates file signatures and sanitizes filenames', () => {
        expect(hasSupportedImageSignature(png, 'image/png')).toBe(true);
        expect(hasSupportedImageSignature(Buffer.from('MZ executable'), 'image/png')).toBe(false);
        expect(safeImageFilename('../unsafe name?.png')).toBe('.._unsafe_name_.png');
    });

    it('stores Product uploads persistently inside the tenant folder', async () => {
        const media = await tenant(() => storeUploadedImage({ businessId, buffer: png, mimeType: 'image/png', filename: 'product.png', source: 'PRODUCT_UPLOAD' }));
        expect(mocks.upload).toHaveBeenCalledWith(png, `sellpilot/${businessId}/products/uploads`, expect.any(String));
        expect(media).toMatchObject({ provider: 'cloudinary', secureUrl: uploaded.secure_url, source: 'PRODUCT_UPLOAD', retention: 'persistent', size: png.length, width: 10, height: 20 });
        expect(media.expiresAt).toBeUndefined();
    });

    it('mirrors a public Test AI image and returns a reload-safe temporary reference for Vision/history', async () => {
        vi.stubEnv('CUSTOMER_MEDIA_RETENTION_DAYS', '7'); mocks.publicId.mockReturnValue(undefined);
        const media = await tenant(() => persistConversationImage({ businessId, url: 'https://public.example/photo.png', source: 'TEST_AI', conversationId: 'test-1', messageId: 'event-1' }));
        expect(mocks.fetch).toHaveBeenCalledWith('https://public.example/photo.png');
        expect(mocks.upload).toHaveBeenCalledWith(png, `sellpilot/${businessId}/customers/test-ai`, expect.any(String));
        expect(media).toMatchObject({ secureUrl: uploaded.secure_url, conversationId: 'test-1', messageId: 'event-1', retention: 'temporary', source: 'TEST_AI' });
        expect(media.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('converts a temporary Facebook attachment URL into a stable tenant asset without retaining signed query data', async () => {
        mocks.publicId.mockReturnValue(undefined);
        mocks.fetch.mockResolvedValueOnce({ url: 'https://lookaside.facebook.example/photo.png?temporary-token=redacted', buffer: png, contentType: 'image/png' });
        const media = await tenant(() => persistConversationImage({ businessId, url: 'https://lookaside.facebook.example/photo.png?temporary-token=redacted', source: 'FACEBOOK', conversationId: 'fb-1', messageId: 'mid-1' }));
        expect(mocks.upload).toHaveBeenCalledWith(png, `sellpilot/${businessId}/customers/facebook`, expect.any(String));
        expect(media).toMatchObject({ secureUrl: uploaded.secure_url, source: 'FACEBOOK', retention: 'temporary', originalUrl: 'https://lookaside.facebook.example/photo.png' });
        expect(media.originalUrl).not.toContain('?');
    });

    it('reuses only a Cloudinary asset owned by the current tenant', async () => {
        mocks.publicId.mockReturnValue(`sellpilot/${businessId}/customers/owned`);
        const owned = await tenant(() => resolveOwnedMediaUrl({ businessId, url: uploaded.secure_url, source: 'TEST_AI' }));
        expect(owned?.providerAssetId).toBe(uploaded.public_id);
        mocks.publicId.mockReturnValue('sellpilot/another-business/customers/asset');
        expect(await tenant(() => resolveOwnedMediaUrl({ businessId, url: uploaded.secure_url, source: 'TEST_AI' }))).toBeUndefined();
    });

    it('rejects invalid image bytes and reports missing Cloudinary configuration clearly', async () => {
        await expect(tenant(() => storeUploadedImage({ businessId, buffer: Buffer.from('MZ'), mimeType: 'image/png', filename: 'bad.png', source: 'PRODUCT_UPLOAD' }))).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
        mocks.configured.mockReturnValue(false);
        await expect(tenant(() => storeUploadedImage({ businessId, buffer: png, mimeType: 'image/png', filename: 'photo.png', source: 'TEST_AI' }))).rejects.toEqual(expect.objectContaining<Partial<MediaStorageError>>({ code: 'NOT_CONFIGURED' }));
    });

    it('deletes an expired unreferenced customer upload while retaining referenced media', async () => {
        vi.spyOn(Message, 'find').mockReturnValue({ limit: () => Promise.resolve([]) } as never);
        vi.spyOn(Message, 'exists').mockResolvedValue(null);
        vi.spyOn(Product, 'exists').mockResolvedValue(null);
        vi.spyOn(Conversation, 'exists').mockResolvedValue(null);
        mocks.list.mockResolvedValue({ resources: [{ public_id: `sellpilot/${businessId}/customers/orphan`, created_at: '2020-01-01T00:00:00.000Z' }] });
        mocks.destroy.mockResolvedValue({ result: 'ok' });
        const result = await tenant(() => cleanupExpiredCustomerMedia(businessId, new Date('2026-01-01T00:00:00.000Z')));
        expect(mocks.destroy).toHaveBeenCalledWith(`sellpilot/${businessId}/customers/orphan`);
        expect(result).toEqual({ deleted: 1, skipped: 0 });
    });

    it('removes a replaced Product asset only when no Product, message, or conversation still references it', async () => {
        vi.spyOn(Product, 'exists').mockResolvedValue(null);
        vi.spyOn(Message, 'exists').mockResolvedValue(null);
        vi.spyOn(Conversation, 'exists').mockResolvedValue(null);
        mocks.destroy.mockResolvedValue({ result: 'ok' });
        const providerAssetId = `sellpilot/${businessId}/products/uploads/replaced`;
        expect(await tenant(() => cleanupDetachedProductMedia(businessId, '507f1f77bcf86cd799439099', [{ providerAssetId }]))).toEqual({ deleted: 1 });
        expect(mocks.destroy).toHaveBeenCalledWith(providerAssetId);
    });
});
