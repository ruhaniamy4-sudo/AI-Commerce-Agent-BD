import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../models/Conversation';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Offering } from '../models/Offering';
import { Business } from '../models/Business';
import { Knowledge } from '../models/Knowledge';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from './deterministic-response.service';

vi.mock('./business-awareness.service', () => ({
    retrieveRelevantAwareness: vi.fn(async (_businessId: string, text: string) => /offer/i.test(text)
        ? [{ targetType: 'CATEGORY', targetReference: 'Kurti', claimType: 'UP_TO_PERCENT', claimValue: 30 }]
        : []),
}));

const businessId = '507f1f77bcf86cd799439011';
const product = { _id: '507f1f77bcf86cd799439012', name: 'Zeblaze Vibe 7 Pro', basePrice: 5200, salePrice: 4990, currency: 'BDT', stock: 4, availability: 'in_stock', images: ['https://example.com/watch.jpg'], variants: [{ variantId: 'black', name: 'Black', sku: 'VIBE7-BLK', price: 4990, currency: 'BDT', stock: 3, availability: 'in_stock', images: ['https://example.com/black.jpg'] }] };
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

    it('builds order-independent normalized name, brand, alias, and SKU search predicates', async () => {
        conversation();
        const find = vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve([product]) }) }) } as never);
        await tenant(() => getDeterministicResponse(businessId, 'Pro Zeblaze Vibe price?', { conversationId: 'c' }));
        const query: any = find.mock.calls[0][0];
        expect(query.businessId).toBe(businessId);
        expect(query.isActive).toBe(true);
        expect(query.$and).toBeDefined();
        expect(JSON.stringify(query)).toContain('aliases');
        expect(JSON.stringify(query)).toContain('variants.sku');
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

    it('does not turn in-stock with unknown quantity into out of stock', async () => {
        conversation({ activeProductId: product._id });
        vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ ...product, stock: null, availability: 'in_stock', variants: [] }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'stock ache?', { conversationId: 'c' }));
        expect(result.message_text).toContain('in stock');
        expect(result.message_text).not.toContain('out of stock');
        expect(result.suggested_products[0].stock).toBeNull();
    });

    it('uses the canonical USD currency instead of a global BDT symbol', async () => {
        conversation();
        vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve([{ ...product, currency: 'USD', basePrice: 19, salePrice: undefined }]) }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'Zeblaze Vibe 7 Pro price?', { conversationId: 'c' }));
        expect(result.message_text).toContain('$19');
        expect(result.message_text).not.toContain('৳');
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

    it('answers natural delivery questions from the current business-type confirmed setup fact', async () => {
        conversation();
        vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ businessType: 'ECOMMERCE' }) }) } as never);
        const fact = vi.spyOn(Knowledge, 'findOne').mockReturnValue({ sort: () => ({ select: () => ({ lean: () => Promise.resolve({ structuredValue: 'Inside Dhaka ৳80, outside Dhaka ৳130' }) }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'Dhaka delivery cost koto?', { conversationId: 'c' }));
        expect(result.message_text).toContain('৳80');
        expect(fact).toHaveBeenCalledWith(expect.objectContaining({ businessId, factSource: 'BUSINESS_SETUP', businessType: 'ECOMMERCE', setupQuestionKey: { $in: expect.arrayContaining(['ECOMMERCE:delivery_charge']) } }));
    });

    it('answers COD from a confirmed setup fact without a generation call', async () => {
        conversation();
        vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ businessType: 'ECOMMERCE' }) }) } as never);
        vi.spyOn(Knowledge, 'findOne').mockReturnValue({ sort: () => ({ select: () => ({ lean: () => Promise.resolve({ structuredValue: 'Yes, cash on delivery is available' }) }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'COD ache?', { conversationId: 'c' }));
        expect(result).toMatchObject({ intent: 'BUSINESS_FACT', message_text: expect.stringContaining('cash on delivery') });
    });

    it('persists and obeys explicit language preference on zero-LLM turns', async () => {
        conversation({ activeProductId: product._id, preferredLanguage: 'bn' });
        vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(product) }) } as never);
        const remembered: any = await tenant(() => getDeterministicResponse(businessId, 'price?', { conversationId: 'c' }));
        expect(remembered.message_text).toContain('-এর price');
        expect(remembered.memory.preferredLanguage).toBe('bn');

        const switched: any = await tenant(() => getDeterministicResponse(businessId, 'Please reply in English', { conversationId: 'c' }));
        expect(switched.message_text).toContain('English');
        expect(switched.memory.preferredLanguage).toBe('en');
    });

    it('uses a safe clarification instead of claiming the catalog has no matching product', async () => {
        conversation();
        vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) } as never);
        const result: any = await tenant(() => getDeterministicResponse(businessId, 'show galaxy ultra', { conversationId: 'c' }));
        expect(result.message_text).toMatch(/product, model, or SKU/i);
        expect(result.message_text).not.toMatch(/do not have|not available|no product/i);
    });

    it('answers standard greetings without an LLM but leaves a custom brand voice to the styled path', async () => {
        const business = vi.spyOn(Business, 'findById')
            .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ name: 'Demo Store', brandVoice: { tone: 'friendly' } }) }) } as never)
            .mockReturnValueOnce({ select: () => ({ lean: () => Promise.resolve({ name: 'Demo Store', brandVoice: { tone: 'custom', customTone: 'Use our signature greeting' } }) }) } as never);
        const greeting: any = await tenant(() => getDeterministicResponse(businessId, 'hello'));
        expect(greeting.message_text).toContain('Demo Store');
        expect(await tenant(() => getDeterministicResponse(businessId, 'hello'))).toBeNull();
        expect(business).toHaveBeenCalledTimes(2);
    });
});
