import { afterEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { awarenessLifecycle, effectiveDiscount, validateAwarenessAgainstCatalog } from './business-awareness.service';
import { classifyFacebookPost } from './ingestion/facebook-awareness.service';

describe('current business awareness', () => {
    afterEach(() => vi.restoreAllMocks());

    it('calculates regular/offer discount without creating another price field', () => {
        expect(effectiveDiscount(2000, 1400)).toBe(30);
        expect(effectiveDiscount(2000, undefined)).toBeUndefined();
        expect(effectiveDiscount(1000, 1200)).toBeUndefined();
    });

    it('expires campaigns and keeps future campaigns upcoming', () => {
        const now = new Date('2026-08-30T00:00:00Z');
        expect(awarenessLifecycle(undefined, new Date('2026-08-29'), now)).toBe('EXPIRED');
        expect(awarenessLifecycle(new Date('2026-09-01'), undefined, now)).toBe('UPCOMING');
        expect(awarenessLifecycle(undefined, new Date('2026-09-01'), now)).toBe('ACTIVE');
    });

    it('verifies an up-to category claim when a canonical product reaches it', async () => {
        vi.spyOn(Category, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'category-kurti' }) } as any);
        vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [{ basePrice: 2000, salePrice: 1400 }, { basePrice: 2000, salePrice: 1600 }] }) }) } as any);
        await expect(validateAwarenessAgainstCatalog({ targetType: 'CATEGORY', targetReference: 'Kurti', claimType: 'UP_TO_PERCENT', claimValue: 30 })).resolves.toMatchObject({ validation: 'VERIFIED' });
    });

    it('flags an unsupported universal category discount as a mismatch', async () => {
        vi.spyOn(Category, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'category-kurti' }) } as any);
        vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [{ basePrice: 2000, salePrice: 1400 }, { basePrice: 2000, salePrice: 1600 }, { basePrice: 2000 }] }) }) } as any);
        await expect(validateAwarenessAgainstCatalog({ targetType: 'CATEGORY', targetReference: 'Kurti', claimType: 'PERCENT', claimValue: 30 })).resolves.toMatchObject({ validation: 'MISMATCH' });
    });

    it('classifies recent Facebook category offers but ignores old campaigns', () => {
        const now = new Date('2026-08-30T00:00:00Z');
        expect(classifyFacebookPost({ id: 'new', message: 'All Kurti up to 30% off!', created_time: '2026-08-29T00:00:00Z' }, now)).toMatchObject({ type: 'CAMPAIGN', targetType: 'CATEGORY', claimType: 'UP_TO_PERCENT', claimValue: 30 });
        expect(classifyFacebookPost({ id: 'old', message: 'All Kurti 30% off', created_time: '2021-01-01T00:00:00Z' }, now)).toBeNull();
    });

    it('supports service-business announcements without turning them into products', () => {
        const result = classifyFacebookPost({ id: 'visa', message: 'Canada September intake applications open', created_time: '2026-08-29T00:00:00Z' }, new Date('2026-08-30'));
        expect(result).toMatchObject({ type: 'ANNOUNCEMENT', sourceType: 'facebook' });
        expect(result?.targetType).toBe('ALL_PRODUCTS');
    });
});
