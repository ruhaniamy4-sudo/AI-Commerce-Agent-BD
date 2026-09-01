import axios from 'axios';
import { classifyProductImageSource } from '@edutechs/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicImage } from './external-image.service';
import { mirrorExternalProductImages } from './external-image.service';
import * as cloudinaryStorage from '../cloudinary.service';

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('external product image safety', () => {
    afterEach(() => vi.restoreAllMocks());

    it('classifies managed, Fabrilife, arbitrary, invalid, and missing image sources safely', () => {
        expect(classifyProductImageSource('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe('managed');
        expect(classifyProductImageSource('https://fabrilife.com/media/product.png')).toBe('external');
        expect(classifyProductImageSource('https://merchant-a.example/catalog/item.png')).toBe('external');
        expect(classifyProductImageSource('javascript:alert(1)')).toBe('invalid');
        expect(classifyProductImageSource('not a URL')).toBe('invalid');
        expect(classifyProductImageSource('')).toBe('missing');
    });

    it('accepts a bounded public image with matching content and type', async () => {
        vi.spyOn(axios, 'get').mockResolvedValue({ status: 200, headers: { 'content-type': 'image/png', 'content-length': String(png.length) }, data: png } as any);
        const result = await fetchPublicImage('https://merchant-a.example/product.png', 0, publicResolver);
        expect(result).toMatchObject({ url: 'https://merchant-a.example/product.png', contentType: 'image/png' });
        expect(result.buffer).toEqual(png);
    });

    it('rejects private redirects, unsupported content, oversized declarations, and broken downloads', async () => {
        vi.spyOn(axios, 'get').mockResolvedValueOnce({ status: 302, headers: { location: 'http://127.0.0.1/private.png' }, data: Buffer.alloc(0) } as any);
        await expect(fetchPublicImage('https://merchant-a.example/product.png', 0, publicResolver)).rejects.toMatchObject({ code: 'INVALID_URL' });
        vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'text/html' }, data: Buffer.from('<html>') } as any);
        await expect(fetchPublicImage('https://merchant-a.example/product.png', 0, publicResolver)).rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
        vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'image/png', 'content-length': '9000000' }, data: png } as any);
        await expect(fetchPublicImage('https://merchant-a.example/product.png', 0, publicResolver)).rejects.toMatchObject({ code: 'TOO_LARGE' });
        vi.mocked(axios.get).mockRejectedValueOnce(new Error('network failed'));
        await expect(fetchPublicImage('https://merchant-a.example/product.png', 0, publicResolver)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    });

    it('mirrors an approved scraped Product image into stable tenant storage with provenance metadata', async () => {
        vi.spyOn(cloudinaryStorage, 'isCloudinaryConfigured').mockReturnValue(true);
        vi.spyOn(cloudinaryStorage, 'cloudinaryPublicIdFromUrl').mockReturnValue(undefined);
        vi.spyOn(cloudinaryStorage, 'uploadImageBuffer').mockResolvedValue({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/sellpilot/business/products/imported.png', public_id: 'sellpilot/business/products/imported', resource_type: 'image', format: 'png', bytes: png.length, width: 100, height: 80, created_at: new Date().toISOString() });
        vi.spyOn(axios, 'get').mockResolvedValue({ status: 200, headers: { 'content-type': 'image/png', 'content-length': String(png.length) }, data: png } as any);
        const result = await mirrorExternalProductImages(['https://merchant-a.example/product.png'], 'business', publicResolver);
        expect(result.images[0]).toContain('res.cloudinary.com');
        expect(result.imports[0]).toMatchObject({ sourceUrl: 'https://merchant-a.example/product.png', status: 'mirrored', provider: 'cloudinary', providerAssetId: 'sellpilot/business/products/imported', source: 'SCRAPED_PRODUCT', size: png.length });
    });

    it('reuses only a managed Product image from the current tenant folder', async () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/sellpilot/business/products/owned.png';
        vi.spyOn(cloudinaryStorage, 'isCloudinaryConfigured').mockReturnValue(true);
        vi.spyOn(cloudinaryStorage, 'cloudinaryPublicIdFromUrl').mockReturnValue('sellpilot/business/products/owned');
        vi.spyOn(cloudinaryStorage, 'getCloudinaryImage').mockResolvedValue({ secure_url: url, public_id: 'sellpilot/business/products/owned', resource_type: 'image', format: 'png', bytes: png.length, width: 10, height: 20, created_at: new Date().toISOString() } as any);
        const get = vi.spyOn(axios, 'get');
        const result = await mirrorExternalProductImages([url], 'business');
        expect(result).toMatchObject({ images: [url], imports: [expect.objectContaining({ status: 'managed', providerAssetId: 'sellpilot/business/products/owned' })] });
        expect(get).not.toHaveBeenCalled();
    });
});
