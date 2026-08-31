import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../models/Conversation';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Offering } from '../models/Offering';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from './deterministic-response.service';

vi.mock('./business-awareness.service', () => ({
    retrieveRelevantAwareness: vi.fn(async (_businessId: string, text: string) => /offer/i.test(text)
        ? [{ targetType: 'CATEGORY', targetReference: 'Kurti', claimType: 'UP_TO_PERCENT', claimValue: 30 }]
        : []),
}));

const businessId = '507f1f77bcf86cd799439011';
const product = { _id: '507f1f77bcf86cd799439012', name: 'Zeblaze Vibe 7 Pro', basePrice: 5200, salePrice: 4990, stock: 4, availability: 'in_stock', images: ['https://example.com/watch.jpg'], variants: [{ variantId: 'black', name: 'Black', sku: 'VIBE7-BLK', price: 4990, stock: 3, images: ['https://example.com/black.jpg'] }] };
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, work);
const conversation = (state: Record<string, unknown> = {}) => vi.spyOn(Conversation, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ metadata: { entityState: state } }) }) } as never);

describe('zero-LLM canonical fast paths', () => {
    afterEach(() => vi.restoreAllMocks());

    it('answers an exact product price from the tenant Product query', async () => {
        conversation();
        vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve([product]) }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'Zeblaze Vibe 7 Pro er price koto?', { conversationId: 'c' }));
        expect(result).toMatchObject({ intent: 'PRODUCT_PRICE', message_text: expect.stringContaining('৳4990'), suggested_products: [expect.objectContaining({ id: product._id, image: product.images[0] })] });
    });

    it.each([['picture deo','PRODUCT_IMAGE'],['stock ache?','PRODUCT_STOCK'],['black ache?','PRODUCT_VARIANT']])('uses activeProductId for %s', async (message, intent) => {
        conversation({ activeProductId: product._id });
        vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(product) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, message, { conversationId: 'c' }));
        expect(result.intent).toBe(intent);
        expect(result.suggested_products[0].id).toBe(product._id);
    });

    it('answers an EdTech course fee from a canonical Offering', async () => {
        conversation();
        vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) } as never);
        vi.spyOn(Offering, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: 'offering-1', name: 'SSC 27 Science Batch', price: 3500, offeringType: 'COURSE' }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'SSC 27 science batch fee?', { conversationId: 'c' }));
        expect(result).toMatchObject({ intent: 'PRODUCT_PRICE', message_text: expect.stringContaining('৳3500') });
    });

    it('answers exact SKU price and stock from canonical product data', async () => {
        vi.spyOn(Product, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({
                _id: product._id, name: 'Offer Product', basePrice: 2000, salePrice: 1400,
                stock: 5, availability: 'in_stock', images: [],
                variants: [{ variantId: 'offer', name: 'Default', sku: 'OFFER-1', price: 2000, stock: 5, images: [] }],
            }) }),
        } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'price OFFER-1'));
        expect(result).toMatchObject({ intent: 'PRODUCT_PRICE', message_text: expect.stringContaining('৳1400') });
        expect(result.message_text).toContain('5 in stock');
    });

    it('uses real courier status without inventing an ETA', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            sort: () => ({ select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ORD-ABC123', status: 'confirmed', courier: { status: 'in_transit', trackingCode: 'TRACK123' } }) }) }),
        } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'amar parcel koi?', { psid: 'customer-1' }));
        expect(result.message_text).toBe('Order #ORD-ABC123 is currently in transit. Tracking code: TRACK123.');
        expect(result.message_text).not.toMatch(/ETA|arrive|tomorrow/i);
    });

    it('keeps verified offer details in the zero-LLM response', async () => {
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'Kurti offer ache?'));
        expect(result.message_text).toContain('Kurti collection');
        expect(result.message_text).toContain('up to 30% discount');
        expect(result.message_text).toContain('catalog price ও stock');
    });
});
