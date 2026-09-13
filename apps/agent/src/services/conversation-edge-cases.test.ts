import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from './deterministic-response.service';
import { mergeMemory } from './conversation-memory.service';

vi.mock('./business-awareness.service', () => ({ retrieveRelevantAwareness: vi.fn(async () => []) }));

const businessId = new mongoose.Types.ObjectId().toString();
const customerId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId().toString();
const powerbank = {
    _id: productId, name: 'Power Bank 20000mAh', publicCode: 'POW-2769B', basePrice: 2600,
    currency: 'BDT', stock: 28, availability: 'in_stock', images: [], variants: [], aiSellingStatus: 'active',
};

let metadata: any;

/** The conversation's remembered state, merged forward exactly as the live turn pipeline does. */
function rememberTurn(memory: Record<string, unknown> | undefined) {
    if (!memory) return;
    metadata.entityState = mergeMemory(metadata.entityState, memory as any);
}

const say = (text: string, catalog: any[] = [powerbank]) => {
    vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve(catalog) }) }) } as never);
    vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(catalog[0]) }) } as never);
    return withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
        getDeterministicResponse(businessId, text, { conversationId: 'c', psid: 'web-1', eventIdentifier: `e-${text.slice(0, 10)}` })
    ).then((result: any) => { rememberTurn(result?.memory); return result; });
};

beforeEach(() => {
    metadata = { entityState: {} };
    vi.spyOn(Conversation, 'findOne').mockImplementation((() => ({
        select: () => ({ lean: () => Promise.resolve({ metadata, customerId, psid: 'web-1', platform: 'web-widget' }) }),
    })) as never);
    vi.spyOn(Conversation, 'updateOne').mockImplementation(((_f: any, u: any) => {
        if (u?.$set?.['metadata.orderDraft']) metadata.orderDraft = JSON.parse(JSON.stringify(u.$set['metadata.orderDraft']));
        if (u?.$unset?.['metadata.orderDraft']) delete metadata.orderDraft;
        return Promise.resolve({}) as never;
    }) as never);
    vi.spyOn(Customer, 'findById').mockReturnValue({ lean: () => Promise.resolve({ _id: customerId, name: 'Web User', addresses: [] }) } as never);
    vi.spyOn(Business, 'findById').mockReturnValue({
        select: () => ({ lean: () => Promise.resolve({ _id: businessId, name: 'SellPilot Store', businessType: 'ECOMMERCE', commerce: { paymentMethods: ['Cash on Delivery', 'bKash'], deliveryFees: { insideDhaka: 80, outsideDhaka: 130 } } }) }),
    } as never);
    vi.spyOn(Knowledge, 'findOne').mockReturnValue({
        sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
        select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('objections get a salesperson answer, not a catalog search', () => {
    it.each([
        ['dam ta onek beshi mone hocche', /listed|dame|budget/i],
        ['onno page e er theke kome dey', /live|stock|delivery|compare|tulona/i],
        ['apnader product vejal na to?', /stock|listing|parcel|team/i],
        ['amar kalke lagbe, pabo to?', /1-2|2-4|courier|delivery/i],
    ])('answers "%s" with reassurance instead of "we do not have that"', async (message, expected) => {
        const reply = await say(message);
        expect(reply.message_text).toMatch(expected);
        // The objection's own words must never be echoed back as a missing product.
        expect(reply.message_text).not.toMatch(/amader kache nei|not in our catalog|catalog-এ নেই/i);
    });
});

describe('courtesy', () => {
    it('returns the salaam', async () => {
        const reply = await say('Assalamu alaikum');
        expect(reply.message_text).toMatch(/walaikum/i);
    });

    it('answers thanks as thanks, not as a greeting', async () => {
        const reply = await say('thanks vai');
        expect(reply.message_text).toMatch(/welcome|dhonnobad|ধন্যবাদ/i);
        expect(reply.message_text).not.toMatch(/what are you looking for|কী খুঁজছেন/i);
    });
});

describe('a sold-out product is never closed like a sale', () => {
    it('quotes the price but does not offer to place the order', async () => {
        const soldOut = [{ ...powerbank, stock: 0, availability: 'out_of_stock' }];
        const reply = await say('power bank er dam koto?', soldOut);
        expect(reply.message_text).toContain('৳2600');
        expect(reply.message_text).toMatch(/out of stock|stock e nei|stock-এ নেই/i);
        expect(reply.message_text).not.toMatch(/order ta kore dicchi|place the order/i);
    });
});

describe('context survives far past the model’s message window', () => {
    it('still knows the budget, size and product ten turns later', async () => {
        await say('amar budget 3000 er moddhe kichu lagbe');
        await say('size L hole valo hoy');
        await say('kalo hole nibo');
        await say('power bank ta dekhan');
        for (const filler of ['accha', 'hmm', 'ok', 'thik ache', 'ekhon na', 'pore dekhbo']) await say(filler);

        expect(metadata.entityState).toMatchObject({
            budget: 3000,
            size: 'L',
            color: 'Black',
            activeProductName: 'Power Bank 20000mAh',
            activeProductCode: 'POW-2769B',
        });
    });

    it('answers "eta koto?" with the product quoted several turns earlier', async () => {
        await say('power bank ta dekhan');
        await say('accha');
        await say('hmm');
        const reply = await say('eta koto?');
        expect(reply.message_text).toContain('Power Bank 20000mAh');
        expect(reply.message_text).toContain('৳2600');
    });
});

describe('order status speaks the customer’s language', () => {
    it('does not name the courier vendor and offers a next step', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            sort: () => ({ select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ORD-77', status: 'shipped', courier: { status: 'in_transit', trackingCode: 'TRK9' } }) }) }),
            select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ORD-77', status: 'shipped', courier: { status: 'in_transit', trackingCode: 'TRK9' } }) }),
        } as never);
        const reply = await say('vai amar order ta koi?');
        expect(reply.message_text).toContain('ORD-77');
        expect(reply.message_text).not.toMatch(/steadfast/i);
        expect(reply.message_text).toMatch(/pothe ache|in transit|পথে/i);
    });
});
