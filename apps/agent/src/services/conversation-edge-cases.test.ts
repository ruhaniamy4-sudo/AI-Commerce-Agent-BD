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
    it.each([
        ['Okay vaiya thank you.', /welcome|dhonnobad|ধন্যবাদ/i],
        ['ok thanks', /welcome|dhonnobad|ধন্যবাদ/i],
        ['thik ache bhai, dhonnobad', /welcome|dhonnobad|ধন্যবাদ/i],
        ['accha vaiya', /khujchen|looking for|নিতে চাইলে|order/i],
        ['hmm thik ache', /khujchen|looking for|নিতে চাইলে|order/i],
        ['ji apu', /khujchen|looking for|নিতে চাইলে|order/i],
        ['assalamu alaikum bhai', /walaikum/i],
        ['hello vai', /swagotom|welcome|স্বাগতম/i],
    ])('answers the combined courtesy message "%s" without a model call', async (message, expected) => {
        const reply = await say(message);
        expect(reply).toBeTruthy();
        expect(reply.message_text).toMatch(expected);
    });

    it('does not mistake a real question for courtesy', async () => {
        // "ki ache" and "thik ache to?" say something; they must reach the catalog.
        expect(await say('ki ki ache?')).toBeTruthy();
        const real = await say('ok, power bank er dam koto?');
        expect(real.message_text).toContain('৳2600');
    });

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

describe('turns that used to cost a model call now cost none', () => {
    it.each([
        'Accha apni ki AI?',
        'apni ki bot?',
        'apnara ki manush naki AI?',
        'are you a human?',
        'আপনি কি এআই?',
        'tumi ki robot?',
    ])('answers "%s" without a model call', async (message) => {
        const reply = await say(message);
        expect(reply).toBeTruthy();
        expect(reply.intent).toBe('GENERAL_CONVERSATION');
        // Honest about being automated, and still useful.
        expect(reply.message_text).toMatch(/assistant/i);
        expect(reply.message_text).not.toMatch(/\bI am a human\b/i);
    });

    it('answers an order-status question that quotes the number first', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ORD-M9X2K-7A4C', status: 'shipped', courier: { status: 'in_transit', trackingCode: 'TRK9' } }) }),
            sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
        } as never);
        const reply = await say('ORD-M9X2K-7A4C ei order er status ta janaben?');
        expect(reply.intent).toBe('ORDER_STATUS');
        expect(reply.message_text).toContain('ORD-M9X2K-7A4C');
        expect(reply.message_text).not.toMatch(/human agent will continue/i);
    });

    it('explains a sandbox order id instead of hunting for an order that was never created', async () => {
        const reply = await say('ORD-SANDBOX-MTZ4VXO2 ei order er status ta janaben?');
        expect(reply.intent).toBe('ORDER_STATUS');
        expect(reply.message_text).toMatch(/test mode|টেস্ট মোড/i);
        expect(reply.message_text).not.toMatch(/human agent will continue/i);
    });

    it('asks for the order id rather than handing a status question to a person', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve(null) }),
            sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
        } as never);
        const reply = await say('amar order ta koi vai?');
        expect(reply.intent).toBe('ORDER_STATUS');
        expect(reply.message_text).toMatch(/ORD-|order id/i);
        expect(reply.message_text).not.toMatch(/human agent will continue/i);
    });

    it('does not read "status" as an order number', async () => {
        const findOne = vi.spyOn(Order, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve(null) }),
            sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
        } as never);
        const reply = await say('Amar order status ta ki?');
        expect(reply.message_text).not.toMatch(/STATUS/);
        // It asks for a real identifier instead of hunting for an order called "STATUS".
        expect(reply.message_text).toMatch(/ORD-|order id|mobile/i);
        expect(JSON.stringify(findOne.mock.calls)).not.toContain('"STATUS"');
    });

    it('finds the order from the mobile number the customer replies with', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            sort: () => ({ select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ORD-BYPHONE', status: 'confirmed', courier: undefined }) }) }),
            select: () => ({ lean: () => Promise.resolve(null) }),
        } as never);
        // No flag needed: a message that is essentially just a number identifies an order.
        const reply = await say('number: 01632149759');
        expect(reply.intent).toBe('ORDER_STATUS');
        expect(reply.message_text).toContain('ORD-BYPHONE');
    });

    it('says plainly when a quoted order number does not exist', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve(null) }),
            sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
        } as never);
        const reply = await say('ORD-NOPE-1234 ta check korben?');
        expect(reply.message_text).toContain('ORD-NOPE-1234');
        expect(reply.message_text).toMatch(/khuje pelam na|could not find|খুঁজে পেলাম না/i);
    });

    it('uses the order number it remembered from earlier in the conversation', async () => {
        const findOne = vi.spyOn(Order, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ORD-REMEMBERED', status: 'pending', courier: undefined }) }),
            sort: () => ({ select: () => ({ lean: () => Promise.resolve(null) }) }),
        } as never);
        metadata.entityState.lastOrderNumber = 'ORD-REMEMBERED';
        const reply = await say('order ta kobe pabo?');
        expect(JSON.stringify(findOne.mock.calls[0][0])).toContain('ORD-REMEMBERED');
        expect(reply.message_text).toContain('ORD-REMEMBERED');
    });
});

describe('an English checkout reaches checkout', () => {
    // Reproduces the sandbox transcript that prompted this: the assistant quoted
    // the power bank, asked for name/phone/address, and then answered the reply
    // carrying all three with "which product and how many should I put down?" -
    // because nothing in the message looked like an order intent, so no draft was
    // ever opened and the whole turn fell through to the model.
    it('opens the draft when the customer hands over name, phone and address', async () => {
        await say('do you have a power bank?');
        expect(metadata.entityState.activeProductId).toBe(productId);

        const reply = await say('Name: Rafiul Islam, Phone: 01632149759, Address: Agargaon, Dhaka');
        expect(reply).toBeTruthy();
        expect(reply.intent).toBe('ORDER_FLOW');
        expect(metadata.orderDraft?.items?.[0]?.productId).toBe(productId);
        expect(metadata.orderDraft?.fullName).toBe('Rafiul Islam');
        expect(metadata.orderDraft?.phone).toBe('01632149759');
        expect(reply.message_text).toMatch(/confirm/i);
        expect(reply.message_text).not.toMatch(/which product|kon product|কোন প্রোডাক্ট/i);
    });

    it('reads a bare "1 please" as the quantity for the product on screen', async () => {
        await say('do you have a power bank?');
        const reply = await say('1 please');
        expect(reply).toBeTruthy();
        expect(reply.intent).toBe('ORDER_FLOW');
        expect(metadata.orderDraft?.items?.[0]).toMatchObject({ productId, quantity: 1 });
        // The old fallback: a catalog search for the word "please".
        expect(reply.message_text).not.toMatch(/which product or service|kon product ba service/i);
    });

    it('does not start an order from a bare number with nothing on screen', async () => {
        const reply = await say('2 please');
        expect(metadata.orderDraft).toBeUndefined();
        expect(reply?.intent).not.toBe('ORDER_FLOW');
    });
});

describe('a question is not a checkout instruction', () => {
    it('answers "delivery address ta ki lagbe?" instead of opening an order', async () => {
        await say('do you have a power bank?');
        const reply = await say('delivery address ta ki lagbe?');
        expect(metadata.orderDraft).toBeUndefined();
        expect(reply?.intent).not.toBe('ORDER_FLOW');
    });
});

describe('a greeting and a question in one message get both answers', () => {
    // The sandbox transcript this came from: a shop with two power banks in stock
    // answered "দুঃখিত, আসসালামু আলাইকুম পাওয়ারব্যাংক এই মুহূর্তে আমাদের কাছে নেই"
    // and offered kettles instead. The salaam had survived into the catalog
    // search, which requires every term to match.
    it('returns the salaam and still finds the Bangla product name', async () => {
        const reply = await say('আসসালামু আলাইকুম। পাওয়ারব্যাংক আছে?');
        expect(reply.message_text).toMatch(/ওয়ালাইকুম আসসালাম/);
        expect(reply.message_text).toContain('Power Bank 20000mAh');
        expect(reply.message_text).toContain('৳2600');
        expect(reply.message_text).not.toMatch(/আসসালামু আলাইকুম পাওয়ারব্যাংক/);
        expect(reply.message_text).not.toMatch(/নেই|do not have|not in our catalog/i);
    });

    it.each([
        ['assalamu alaikum, power bank ache?', /walaikum assalam/i],
        ['নমস্কার ভাই, পাওয়ার ব্যাংক আছে?', /হ্যালো/],
        ['good morning, power bank ache?', /hello/i],
    ])('answers "%s" as a greeting plus a product question', async (message, greeting) => {
        const reply = await say(message);
        expect(reply.message_text).toMatch(greeting);
        expect(reply.message_text).toContain('Power Bank 20000mAh');
    });

    it('does not prepend a greeting to a message that never had one', async () => {
        const reply = await say('power bank ache?');
        expect(reply.message_text).not.toMatch(/walaikum|হ্যালো|hello/i);
        expect(reply.message_text).toContain('Power Bank 20000mAh');
    });

    it('still answers a message that is only a greeting as a greeting', async () => {
        const reply = await say('আসসালামু আলাইকুম');
        expect(reply.message_text).toMatch(/ওয়ালাইকুম আসসালাম/);
        expect(reply.message_text).not.toContain('Power Bank 20000mAh');
    });
});

describe('a count next to a product name is a count', () => {
    it('finds the product when the quantity is glued to the Bangla numeral', async () => {
        // "২টা" tokenises as one word that is neither short enough to drop nor a
        // listed stop word, so it was ANDed into the search and found nothing.
        const reply = await say('২টা পাওয়ারব্যাংক লাগবে');
        expect(reply.message_text).toContain('Power Bank 20000mAh');
        expect(reply.message_text).not.toMatch(/নেই|not in our catalog/i);
    });

    it('carries the count into the order when the customer names both', async () => {
        const reply = await say('২টা পাওয়ারব্যাংক নিব');
        expect(reply.intent).toBe('ORDER_FLOW');
        expect(metadata.orderDraft?.items?.[0]).toMatchObject({ productId, quantity: 2 });
    });
});

describe('quoting the code we printed starts the order', () => {
    it('goes to checkout instead of asking which one again', async () => {
        // The listing invites "name বা code-টি বললে আমি order-টা করে দিচ্ছি", the
        // customer quoted POW-2769B, and the reply was "কোনটি অর্ডারে যোগ করব?"
        // with the same two products listed again.
        await say('আমার একটা পাওয়ার ব্যাংক লাগবে');
        const reply = await say('POW-2769B এইটা লাগবে ১ টা');
        expect(reply.intent).toBe('ORDER_FLOW');
        expect(metadata.orderDraft?.items?.[0]).toMatchObject({ productId, quantity: 1 });
        expect(reply.message_text).not.toMatch(/কোনটি অর্ডারে যোগ করব|which one should I add/i);
    });

    it('reads the code as a code and the trailing number as a count', async () => {
        // "POW-2769B" ends in digits and "১ টা" is the quantity; neither may be
        // read as the other.
        await say('আমার একটা পাওয়ার ব্যাংক লাগবে');
        await say('POW-2769B এইটা লাগবে ২ টা');
        expect(metadata.orderDraft?.items?.[0]).toMatchObject({ productId, quantity: 2 });
    });
});
