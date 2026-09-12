import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import * as checkoutService from './checkout.service';
import { getDeterministicResponse } from './deterministic-response.service';
import { cityFrom, phoneFrom, quantityFrom } from './order-flow.service';

vi.mock('./business-awareness.service', () => ({ retrieveRelevantAwareness: vi.fn(async () => []) }));

const businessId = new mongoose.Types.ObjectId().toString();
const customerId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId().toString();
const conversationId = 'conv-order-flow';

const mug = {
    _id: productId,
    name: 'Ceramic Coffee Mug',
    basePrice: 600,
    salePrice: 550,
    currency: 'BDT',
    stock: 12,
    availability: 'in_stock',
    images: [],
    variants: [],
    aiSellingStatus: 'active',
};

/** Conversation metadata is the draft's home, so the fake keeps one mutable copy. */
let metadata: Record<string, any>;

const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, work);
const say = (text: string, eventIdentifier = `evt-${Math.random()}`) =>
    tenant(() => getDeterministicResponse(businessId, text, { conversationId, psid: 'web-1', eventIdentifier })) as Promise<any>;

function applyUpdate(update: any) {
    for (const [path, value] of Object.entries(update?.$set || {})) {
        if (path === 'metadata.orderDraft') metadata.orderDraft = JSON.parse(JSON.stringify(value));
        else if (path === 'metadata.orderDraft.stage') metadata.orderDraft.stage = value;
    }
    for (const path of Object.keys(update?.$unset || {})) {
        if (path === 'metadata.orderDraft') delete metadata.orderDraft;
    }
}

function mockCatalog(products: any[] = [mug]) {
    vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve(products) }) }) } as never);
    vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(products[0]) }) } as never);
}

beforeEach(() => {
    // The customer has just been shown this product, which is how a real
    // "eita nibo" turn arrives.
    metadata = { entityState: { activeProductId: productId } };
    mockCatalog();
    vi.spyOn(Conversation, 'findOne').mockImplementation((() => ({
        select: () => ({ lean: () => Promise.resolve({ metadata, customerId, psid: 'web-1', platform: 'web-widget' }) }),
    })) as never);
    vi.spyOn(Conversation, 'updateOne').mockImplementation(((_filter: any, update: any) => {
        applyUpdate(update);
        return Promise.resolve({ acknowledged: true }) as never;
    }) as never);
    vi.spyOn(Conversation, 'findOneAndUpdate').mockImplementation(((filter: any, update: any) => ({
        lean: () => {
            const expected = filter?.['metadata.orderDraft.stage'];
            if (expected && metadata.orderDraft?.stage !== expected) return Promise.resolve(null);
            applyUpdate(update);
            return Promise.resolve({ _id: 'claimed' });
        },
    })) as never);
    vi.spyOn(Customer, 'findById').mockReturnValue({ lean: () => Promise.resolve({ _id: customerId, name: 'Web User', addresses: [] }) } as never);
    vi.spyOn(Customer, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
    vi.spyOn(Business, 'findById').mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: businessId, name: 'Shop', commerce: { paymentMethods: ['Cash on Delivery'], deliveryFees: { insideDhaka: 80, outsideDhaka: 130 } } }) }),
    } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('chat order flow', () => {
    it('walks name → phone → address → confirmation and creates one order with a customer-facing order id', async () => {
        const createOrder = vi.spyOn(checkoutService, 'createOrderWithStock').mockResolvedValue({
            _id: 'order-object-id', orderNumber: 'ORD-TEST-1234', total: 630,
        } as never);

        const started = await say('ei ta nibo');
        expect(started.intent).toBe('ORDER_FLOW');
        expect(started.message_text).toMatch(/naam|name/i);
        expect(metadata.orderDraft.items[0]).toMatchObject({ productId, quantity: 1, unitPrice: 550 });

        const afterName = await say('Rafiul Islam');
        expect(afterName.message_text).toMatch(/number/i);
        expect(metadata.orderDraft.fullName).toBe('Rafiul Islam');

        const afterPhone = await say('01712345678');
        expect(afterPhone.message_text).toMatch(/address|ঠিকানা/i);
        expect(metadata.orderDraft.phone).toBe('01712345678');

        const summary = await say('House 12, Road 5, Dhanmondi, Dhaka');
        expect(metadata.orderDraft.stage).toBe('AWAITING_CONFIRMATION');
        expect(summary.message_text).toContain('৳550');
        expect(summary.message_text).toContain('৳80');   // inside-Dhaka delivery fee
        expect(summary.message_text).toContain('৳630');  // total the customer is asked to confirm
        expect(createOrder).not.toHaveBeenCalled();      // nothing is ordered before an explicit confirm

        const confirmed = await say('confirm', 'evt-confirm');
        expect(createOrder).toHaveBeenCalledTimes(1);
        const payload: any = createOrder.mock.calls[0][0];
        expect(payload).toMatchObject({
            businessId,
            customerId,
            deliveryFee: 80,
            paymentMethod: 'Cash on Delivery',
            idempotencyKey: 'evt-confirm',
            items: [{ productId, quantity: 1 }],
            shippingAddress: {
                fullName: 'Rafiul Islam',
                phone: '01712345678',
                addressLine1: 'House 12, Road 5, Dhanmondi, Dhaka',
                city: 'Dhaka',
                zone: 'Dhaka',
                country: 'Bangladesh',
            },
        });
        expect(confirmed.message_text).toContain('ORD-TEST-1234');
        expect(confirmed.orderCreated).toMatchObject({ orderNumber: 'ORD-TEST-1234', orderId: 'order-object-id', total: 630 });
        expect(metadata.orderDraft).toBeUndefined();
    });

    it('saves the confirmed delivery details on the customer for the next order', async () => {
        vi.spyOn(checkoutService, 'createOrderWithStock').mockResolvedValue({ _id: 'o1', orderNumber: 'ORD-1', total: 630 } as never);
        await say('ei ta nibo');
        await say('Rafiul Islam');
        await say('01712345678');
        await say('Dhanmondi, Dhaka');
        await say('confirm');
        const update: any = (Customer.updateOne as any).mock.calls.at(-1)[1];
        expect(update.$set.phone).toBe('01712345678');
        expect(update.$set.addresses[0]).toMatchObject({ label: 'Delivery', city: 'Dhaka', isDefault: true });
    });

    it('never decrements stock or creates an order until the customer confirms', async () => {
        const createOrder = vi.spyOn(checkoutService, 'createOrderWithStock');
        await say('ei ta nibo');
        await say('Rafiul Islam');
        await say('01712345678');
        await say('Chawkbazar, Chattogram');
        expect(createOrder).not.toHaveBeenCalled();
        expect(metadata.orderDraft.city).toBe('Chattogram');
    });

    it('charges the outside-Dhaka delivery fee for an upcountry address', async () => {
        vi.spyOn(checkoutService, 'createOrderWithStock').mockResolvedValue({ _id: 'o1', orderNumber: 'ORD-2', total: 680 } as never);
        await say('ei ta nibo');
        await say('Rafiul Islam');
        await say('01712345678');
        await say('Chawkbazar, Chattogram');
        await say('confirm');
        expect((checkoutService.createOrderWithStock as any).mock.calls[0][0].deliveryFee).toBe(130);
    });

    it('caps the quantity at live stock instead of promising what is not there', async () => {
        mockCatalog([{ ...mug, stock: 2 }]);
        const started = await say('3 ta nibo');
        expect(metadata.orderDraft.items[0].quantity).toBe(2);
        expect(started.message_text).toMatch(/2/);
    });

    it('refuses to start an order for an out-of-stock product', async () => {
        mockCatalog([{ ...mug, stock: 0, availability: 'out_of_stock' }]);
        const started = await say('ei ta nibo');
        expect(started.message_text).toMatch(/stock/i);
        expect(metadata.orderDraft).toBeUndefined();
    });

    it('asks which product to add when the request matches several', async () => {
        mockCatalog([mug, { ...mug, _id: 'second', name: 'Travel Mug', salePrice: 890 }]);
        const started = await say('mug nibo');
        expect(started.suggested_products).toHaveLength(2);
        expect(metadata.orderDraft).toBeUndefined();
    });

    it('answers an unrelated question mid-checkout and re-asks only what the order still needs', async () => {
        await say('ei ta nibo');
        await say('Rafiul Islam');
        const detour = await say('ei ta price koto?');
        expect(detour.message_text).toContain('৳550');
        expect(detour.message_text).toMatch(/number/i);
        expect(metadata.orderDraft.stage).toBe('AWAITING_PHONE');
    });

    it('rejects an invalid phone number instead of storing it', async () => {
        await say('ei ta nibo');
        await say('Rafiul Islam');
        const rejected = await say('12345');
        expect(rejected.message_text).toMatch(/01XXXXXXXXX/);
        expect(metadata.orderDraft.phone).toBeUndefined();
    });

    it('cancels the draft on request without touching inventory', async () => {
        const createOrder = vi.spyOn(checkoutService, 'createOrderWithStock');
        await say('ei ta nibo');
        const cancelled = await say('cancel');
        expect(cancelled.message_text).toMatch(/cancel|বাতিল/i);
        expect(metadata.orderDraft).toBeUndefined();
        expect(createOrder).not.toHaveBeenCalled();
    });

    it('keeps the draft and explains itself when checkout fails on stock', async () => {
        vi.spyOn(checkoutService, 'createOrderWithStock').mockRejectedValue(new checkoutService.OrderCreationError('Insufficient stock for Ceramic Coffee Mug'));
        await say('ei ta nibo');
        await say('Rafiul Islam');
        await say('01712345678');
        await say('Dhanmondi, Dhaka');
        const failed = await say('confirm');
        expect(failed.message_text).toMatch(/Insufficient stock/i);
        expect(failed.orderCreated).toBeUndefined();
        expect(metadata.orderDraft.stage).toBe('AWAITING_CONFIRMATION');
    });

    it('lets a second confirmation through only once while the first is in flight', async () => {
        vi.spyOn(checkoutService, 'createOrderWithStock').mockResolvedValue({ _id: 'o1', orderNumber: 'ORD-3', total: 630 } as never);
        await say('ei ta nibo');
        await say('Rafiul Islam');
        await say('01712345678');
        await say('Dhanmondi, Dhaka');
        const [first, second] = await Promise.all([say('confirm', 'evt-a'), say('confirm', 'evt-b')]);
        expect((checkoutService.createOrderWithStock as any).mock.calls).toHaveLength(1);
        const messages = [first.message_text, second.message_text].join(' ');
        expect(messages).toContain('ORD-3');
    });

    it('starts the order when the customer quotes the product code', async () => {
        mockCatalog([{ ...mug, publicCode: 'CER-9F2A' }]);
        const started = await say('CER-9F2A ta nibo');
        expect(started.intent).toBe('ORDER_FLOW');
        expect(metadata.orderDraft.items[0]).toMatchObject({ code: 'CER-9F2A', quantity: 1 });
    });

    it('rehearses the confirmation in the Test AI sandbox without creating an order or moving stock', async () => {
        const createOrder = vi.spyOn(checkoutService, 'createOrderWithStock');
        const sandboxSay = (text: string) => tenant(() => getDeterministicResponse(businessId, text, { conversationId, psid: 'web-1', eventIdentifier: `evt-${text}`, sandbox: true })) as Promise<any>;
        await sandboxSay('ei ta nibo');
        await sandboxSay('Rafiul Islam');
        await sandboxSay('01712345678');
        await sandboxSay('Dhanmondi, Dhaka');
        const confirmed = await sandboxSay('confirm');
        expect(createOrder).not.toHaveBeenCalled();
        expect(confirmed.message_text).toMatch(/ORD-SANDBOX-/);
        expect(confirmed.message_text).toMatch(/test mode/i);
        expect(confirmed.orderCreated).toBeUndefined();
        expect(metadata.orderDraft).toBeUndefined();
    });

    it('skips questions a returning customer has already answered', async () => {
        vi.spyOn(Customer, 'findById').mockReturnValue({
            lean: () => Promise.resolve({
                _id: customerId, name: 'Rafiul Islam', phone: '01712345678',
                addresses: [{ label: 'Delivery', fullName: 'Rafiul Islam', phone: '01712345678', addressLine1: 'Dhanmondi 32', city: 'Dhaka', zone: 'Dhaka', isDefault: true }],
            }),
        } as never);
        const started = await say('ei ta nibo');
        expect(metadata.orderDraft.stage).toBe('AWAITING_CONFIRMATION');
        expect(started.message_text).toContain('Dhanmondi 32');
        expect(started.message_text).toMatch(/confirm/i);
    });
});

describe('order input parsing', () => {
    it('reads a quantity only when the digits stand alone', () => {
        expect(quantityFrom('amar mug lagbe. 1 ta')).toBe(1);
        expect(quantityFrom('3 ta nibo')).toBe(3);
        expect(quantityFrom('2 pcs chai')).toBe(2);
        // A product code ending in a digit is not a quantity.
        expect(quantityFrom('CER-CAF6 ta nibo')).toBeUndefined();
        expect(quantityFrom('ZEB-9012 ta nibo')).toBeUndefined();
        expect(quantityFrom('ei ta nibo')).toBeUndefined();
    });

    it('accepts Bangladeshi mobile numbers in the formats customers actually type', () => {
        expect(phoneFrom('01712345678')).toBe('01712345678');
        expect(phoneFrom('amar number +8801712345678')).toBe('01712345678');
        expect(phoneFrom('8801712345678 e call diben')).toBe('01712345678');
        expect(phoneFrom('12345')).toBeUndefined();
    });

    it('recognises districts in both scripts', () => {
        expect(cityFrom('House 12, Dhanmondi, Dhaka')).toBe('Dhaka');
        expect(cityFrom('চট্টগ্রাম, চকবাজার')).toBe('Chattogram');
        expect(cityFrom('Jessore sadar')).toBe('Jashore');
        expect(cityFrom('no district here')).toBeUndefined();
    });
});
