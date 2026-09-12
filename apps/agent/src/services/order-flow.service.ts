import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { normalizeBangladeshPhone } from '../courier/bangladesh-phone';
import { assertTenantBusinessId } from '../tenancy/context';
import { createOrderWithStock, OrderCreationError } from './checkout.service';
import { card, CompactProductCard, money, productCode, say } from './product-card';
import { LightweightIntent } from './turn-routing.service';

/**
 * Deterministic chat checkout — zero LLM calls.
 *
 * A customer who says "ei mug ta nibo" is walked through name → phone → address
 * → explicit confirmation, and only the confirmation turn touches inventory:
 * `createOrderWithStock` decrements stock and writes the Order inside one
 * transaction, so stock can never drop without an order existing (or vice versa).
 * The draft lives on the conversation, so the flow survives restarts and the
 * customer can ask unrelated questions mid-checkout without losing their place.
 */

export type OrderDraftStage =
    | 'AWAITING_VARIANT'
    | 'AWAITING_NAME'
    | 'AWAITING_PHONE'
    | 'AWAITING_ADDRESS'
    | 'AWAITING_CITY'
    | 'AWAITING_CONFIRMATION'
    | 'SUBMITTING';

export interface OrderDraftItem {
    productId: string;
    /** The code the customer saw and can quote back. */
    code?: string;
    variantId?: string;
    sku?: string;
    name: string;
    variantName?: string;
    unitPrice: number;
    currency: string;
    quantity: number;
}

export interface OrderDraft {
    stage: OrderDraftStage;
    /** Pinned at the first order turn so a one-word answer like a phone number cannot flip the reply language mid-checkout. */
    language?: string;
    items: OrderDraftItem[];
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    zone?: string;
    updatedAt: string;
}

export interface OrderFlowResponse {
    message_text: string;
    suggested_products?: CompactProductCard[];
    intent: LightweightIntent;
    memory?: Record<string, unknown>;
    orderCreated?: { orderId: string; orderNumber: string; total: number };
}

export interface OrderTurnContext {
    businessId: string;
    conversationId?: string;
    text: string;
    language: string;
    conversation?: { customerId?: unknown; psid?: string; platform?: string; metadata?: Record<string, any> } | null;
    entity: Record<string, any>;
    lightweightMemory: Record<string, unknown>;
    eventIdentifier?: string;
    /** Test AI sandbox: rehearse the whole flow without touching real inventory. */
    sandbox?: boolean;
    /** Product resolution stays with the catalog search that already understands the merchant's wording. */
    resolveProducts: (text: string) => Promise<any[]>;
}

const DRAFT_TTL_MINUTES = 180;
const MAX_QUANTITY = 20;

const ORDER_INTENT = /\b(?:nibo|nebo|nib|nite chai|nite chachchi|kinbo|kinte chai|order korbo|order korte chai|order korlam|order dibo|order debo|place (?:an )?order|buy (?:it|this|now)|checkout)\b|নিব|নেব|কিনব|কিনতে চাই|অর্ডার\s*(?:করব|করতে|দিব|দেব|করলাম)/i;
const CONFIRM_WORDS = /^(?:confirm(?:ed)?|confirm\s*(?:koro|korun|kore\s*din)|ha|haa|hae|hyan|hn|ji|jee|jii|yes|yep|ok|okay|acha|thik\s*ache|thik|kore\s*din|kore\s*dao|order\s*(?:koro|korun|confirm|kore\s*din))[\s!.।]*$/i;
const CANCEL_WORDS = /^(?:cancel|cancel\s*(?:koro|korun|kore\s*din)|bad\s*(?:dao|din)|thak|lagbe\s*na|na|no|nah|বাতিল|লাগবে\s*না|না|থাক)[\s!.।]*$/i;
const ADDRESS_CHANGE = /\b(?:address|thikana)\b.{0,24}\b(?:change|bodla|bodlate|onno|another|different|update|vul|wrong)\b|\b(?:onno|another|new)\s+(?:address|thikana)\b|ঠিকানা.{0,20}(?:বদল|পরিবর্তন|ভুল|অন্য)/i;
// Greetings and flow keywords are never somebody's name.
const NAME_NOISE = /^(?:hi|hey|hello|yo|salam|assalam|walaikum|ok|okay|acha|hmm+|yes|no|na|ji|thanks?|thank you|start|order|confirm)/i;
const QUESTION_WORDS = /\?|\b(?:koto|kemon|kivabe|kobe|ki|kothay|how|what|when|where|why|which|price|dam|stock|delivery|charge|discount|warranty|return)\b|কত|কেমন|কীভাবে|কবে|কোথায়|দাম|ছাড়/i;

const DHAKA_CITY = /\b(?:dhaka|dhk)\b|ঢাকা/i;
const KNOWN_CITIES: Array<[RegExp, string]> = [
    [/\bdhaka\b|ঢাকা/i, 'Dhaka'],
    [/\b(?:chattogram|chittagong|ctg)\b|চট্টগ্রাম|চিটাগাং/i, 'Chattogram'],
    [/\bsylhet\b|সিলেট/i, 'Sylhet'],
    [/\bkhulna\b|খুলনা/i, 'Khulna'],
    [/\brajshahi\b|রাজশাহী/i, 'Rajshahi'],
    [/\b(?:barishal|barisal)\b|বরিশাল/i, 'Barishal'],
    [/\brangpur\b|রংপুর/i, 'Rangpur'],
    [/\bmymensingh\b|ময়মনসিংহ/i, 'Mymensingh'],
    [/\b(?:cumilla|comilla)\b|কুমিল্লা/i, 'Cumilla'],
    [/\bnarayanganj\b|নারায়ণগঞ্জ/i, 'Narayanganj'],
    [/\bgazipur\b|গাজীপুর/i, 'Gazipur'],
    [/\bsavar\b|সাভার/i, 'Savar'],
    [/\bnarsingdi\b|নরসিংদী/i, 'Narsingdi'],
    [/\b(?:bogura|bogra)\b|বগুড়া/i, 'Bogura'],
    [/\b(?:jashore|jessore)\b|যশোর/i, 'Jashore'],
    [/\bcox'?s?\s*bazar\b|কক্সবাজার/i, "Cox's Bazar"],
    [/\bnoakhali\b|নোয়াখালী/i, 'Noakhali'],
    [/\bfeni\b|ফেনী/i, 'Feni'],
    [/\bdinajpur\b|দিনাজপুর/i, 'Dinajpur'],
    [/\bpabna\b|পাবনা/i, 'Pabna'],
    [/\btangail\b|টাঙ্গাইল/i, 'Tangail'],
    [/\bkushtia\b|কুষ্টিয়া/i, 'Kushtia'],
    [/\bfaridpur\b|ফরিদপুর/i, 'Faridpur'],
    [/\bsirajganj\b|সিরাজগঞ্জ/i, 'Sirajganj'],
    [/\bbrahmanbaria\b|ব্রাহ্মণবাড়িয়া/i, 'Brahmanbaria'],
];

function orderFlowQueryable() {
    return mongoose.connection.readyState === 1 || Boolean((Conversation.updateOne as any)?.mock);
}

export function quantityFrom(text: string) {
    // The digits must stand alone: a product code such as "CER-CAF6 ta nibo" ends
    // in a digit and was being read as a quantity of six.
    const counted = text.match(/(?<![\w-])(\d{1,2})\s*(?:ta|টা|টি|pc|pcs|piece|pieces|copy|set|jon)\b/i);
    const bare = counted ? undefined : text.trim().match(/^(\d{1,2})$/);
    const value = Number(counted?.[1] ?? bare?.[1]);
    if (!Number.isInteger(value) || value < 1) return undefined;
    return Math.min(value, MAX_QUANTITY);
}

export function phoneFrom(text: string) {
    const match = text.match(/(?<!\d)(?:\+?88)?0?1[3-9]\d{8}(?!\d)/);
    if (!match) return undefined;
    const raw = match[0];
    try {
        return normalizeBangladeshPhone(/^1[3-9]/.test(raw) ? `0${raw}` : raw);
    } catch {
        return undefined;
    }
}

export function cityFrom(text: string) {
    return KNOWN_CITIES.find(([pattern]) => pattern.test(text))?.[1];
}

function plausibleName(value?: string) {
    const name = String(value || '').trim();
    if (name.length < 2 || name.length > 60) return undefined;
    if (/^(?:web user|facebook user|guest|customer)$/i.test(name)) return undefined;
    if (/\d/.test(name)) return undefined;
    return name;
}

function cleanName(text: string) {
    const stripped = text
        .replace(/\b(?:amar|my)\s+(?:nam|naam|name)\s*(?:holo|hocche|is)?\s*[:-]?\s*/i, '')
        .replace(/\b(?:name|nam|naam)\s*[:-]\s*/i, '')
        .replace(/আমার\s*নাম\s*[:-]?\s*/, '')
        .replace(/[.।!]+$/, '')
        .trim();
    return plausibleName(stripped);
}

function draftAlive(draft?: OrderDraft | null): draft is OrderDraft {
    if (!draft?.stage || !Array.isArray(draft.items) || !draft.items.length) return false;
    const age = Date.now() - new Date(draft.updatedAt || 0).getTime();
    return Number.isFinite(age) && age < DRAFT_TTL_MINUTES * 60 * 1000;
}

function draftTotals(draft: OrderDraft, deliveryFee: number) {
    const subtotal = draft.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

function itemLines(draft: OrderDraft) {
    return draft.items
        .map((item, index) => `${index + 1}. ${item.name}${item.variantName ? ` (${item.variantName})` : ''}, ${item.code || '-'}, x${item.quantity}, ${money(item.unitPrice * item.quantity, item.currency)}`)
        .join('\n');
}

function addressLine(draft: OrderDraft) {
    const line = String(draft.addressLine1 || '').trim();
    const city = String(draft.city || '').trim();
    if (!city) return line;
    const pattern = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return pattern.test(line) ? line : `${line}, ${city}`;
}

async function saveDraft(businessId: string, conversationId: string, draft: OrderDraft) {
    draft.updatedAt = new Date().toISOString();
    await Conversation.updateOne({ businessId, conversationId }, { $set: { 'metadata.orderDraft': draft } });
    return draft;
}

async function clearDraft(businessId: string, conversationId: string) {
    await Conversation.updateOne({ businessId, conversationId }, { $unset: { 'metadata.orderDraft': '' } });
}

async function loadCustomer(context: OrderTurnContext) {
    const byId = context.conversation?.customerId
        ? await Customer.findById(context.conversation.customerId).lean().catch(() => null)
        : null;
    if (byId) return byId as any;
    if (!context.conversation?.psid) return null;
    return await Customer.findOne({ psid: context.conversation.psid }).lean().catch(() => null) as any;
}

async function deliveryFeeFor(businessId: string, city?: string) {
    const business = await Business.findById(businessId).select('commerce name').lean().catch(() => null) as any;
    const fees = business?.commerce?.deliveryFees || {};
    const inside = Number(fees.insideDhaka ?? 80);
    const outside = Number(fees.outsideDhaka ?? 130);
    return {
        business,
        paymentMethod: business?.commerce?.paymentMethods?.[0] || 'Cash on Delivery',
        deliveryFee: city && DHAKA_CITY.test(city) ? inside : outside,
    };
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function askVariant(draft: OrderDraft, variants: any[], language: string) {
    const names = variants.map((variant: any, index: number) => `${index + 1}. ${variant.name}${variant.sku ? `, ${variant.sku}` : ''}`).join('\n');
    return say(language, {
        en: `${draft.items[0].name} comes in a few options - which one would you like?\n${names}`,
        bn: `${draft.items[0].name}-এর কয়েকটি option আছে—কোনটি নেবেন বলুন:\n${names}`,
        banglish: `${draft.items[0].name}-er koyekta option ache - kon ta niben bolun:\n${names}`,
    });
}

function askFor(stage: OrderDraftStage, language: string) {
    if (stage === 'AWAITING_NAME') return say(language, {
        en: 'Wonderful. May I have the name the parcel should go under?',
        bn: 'দারুণ! পার্সেলটি কার নামে যাবে—আপনার নামটা বলবেন প্লিজ।',
        banglish: 'Darun! Parcel ta kar name e jabe - apnar naam ta bolben please.',
    });
    if (stage === 'AWAITING_PHONE') return say(language, {
        en: 'Thank you. Could you share a mobile number for the courier to call? (e.g. 01712345678)',
        bn: 'ধন্যবাদ! কুরিয়ার কল করার জন্য একটা মোবাইল নম্বর দেবেন প্লিজ। (যেমন 01712345678)',
        banglish: 'Dhonnobad! Courier call korar jonno ekta mobile number diben please. (jemon 01712345678)',
    });
    if (stage === 'AWAITING_ADDRESS') return say(language, {
        en: 'Thank you. Please send the full delivery address - house/road/area and district.',
        bn: 'ধন্যবাদ! এবার ডেলিভারি ঠিকানাটা পুরো লিখে দিন—বাসা/রোড/এলাকা ও জেলা সহ।',
        banglish: 'Dhonnobad! Ebar delivery address ta puro likhe din - basa/road/area o district soho.',
    });
    if (stage === 'AWAITING_CITY') return say(language, {
        en: 'Almost done - which district or city is this address in?',
        bn: 'প্রায় হয়ে গেছে—ঠিকানাটি কোন জেলা/শহরে বলবেন প্লিজ?',
        banglish: 'Prai hoye geche - address ta kon district/city te bolben please?',
    });
    return say(language, {
        en: 'Reply "confirm" and I will place the order right away.',
        bn: '"confirm" লিখলেই আমি অর্ডারটি করে দিচ্ছি।',
        banglish: '"confirm" likhlei ami order ta kore dicchi.',
    });
}

/** The question the customer still owes us, appended when they detour mid-checkout. */
export function pendingOrderPrompt(conversationMetadata: Record<string, any> | undefined, language: string) {
    const draft = conversationMetadata?.orderDraft as OrderDraft | undefined;
    if (!draftAlive(draft) || draft.stage === 'SUBMITTING') return undefined;
    if (draft.stage === 'AWAITING_VARIANT') return undefined;
    return askFor(draft.stage, draft.language || language);
}

/** Re-pins an in-flight checkout to a language the customer explicitly asked for. */
export async function setOrderDraftLanguage(businessId: string, conversationId: string | undefined, language: string) {
    if (!conversationId || !orderFlowQueryable()) return;
    await Conversation.updateOne(
        { businessId, conversationId, 'metadata.orderDraft.stage': { $exists: true } },
        { $set: { 'metadata.orderDraft.language': language } },
    ).catch(() => undefined);
}

async function summaryResponse(context: OrderTurnContext, draft: OrderDraft): Promise<OrderFlowResponse> {
    const { deliveryFee, paymentMethod } = await deliveryFeeFor(context.businessId, draft.city);
    const totals = draftTotals(draft, deliveryFee);
    const currency = draft.items[0].currency;
    const header = say(context.language, {
        en: 'Thank you. Here is your order summary:',
        bn: 'ধন্যবাদ! আপনার অর্ডারটি একবার দেখে নিন:',
        banglish: 'Dhonnobad! Apnar order ta ekbar dekhe nin:',
    });
    const deliveryLabel = say(context.language, { en: 'Delivery', bn: 'ডেলিভারি', banglish: 'Delivery' });
    const totalLabel = say(context.language, { en: 'Total', bn: 'মোট', banglish: 'Total' });
    const closing = say(context.language, {
        en: 'If everything looks right, reply "confirm" and I will place it. Anything to change, just tell me.',
        bn: 'সব ঠিক থাকলে "confirm" লিখুন, আমি অর্ডারটি করে দিচ্ছি। কিছু বদলাতে চাইলে নির্দ্বিধায় বলুন।',
        banglish: 'Sob thik thakle "confirm" likhun, ami order ta kore dicchi. Kichu bodlate chaile nirdhidhay bolun.',
    });
    const message = [
        header,
        itemLines(draft),
        `${deliveryLabel}${draft.city ? ` (${draft.city})` : ''}: ${money(totals.deliveryFee, currency)}`,
        `${totalLabel}: ${money(totals.total, currency)} - ${paymentMethod}`,
        `${draft.fullName} - ${draft.phone}`,
        addressLine(draft),
        closing,
    ].join('\n');
    return { message_text: message, intent: 'ORDER_FLOW', memory: context.lightweightMemory };
}

/** Moves the draft to the next unanswered question and returns that turn's reply. */
async function advance(context: OrderTurnContext, draft: OrderDraft): Promise<OrderFlowResponse> {
    const next: OrderDraftStage = !draft.fullName
        ? 'AWAITING_NAME'
        : !draft.phone
          ? 'AWAITING_PHONE'
          : !draft.addressLine1
            ? 'AWAITING_ADDRESS'
            : !draft.city
              ? 'AWAITING_CITY'
              : 'AWAITING_CONFIRMATION';
    draft.stage = next;
    await saveDraft(context.businessId, context.conversationId!, draft);
    if (next === 'AWAITING_CONFIRMATION') return summaryResponse(context, draft);
    return { message_text: askFor(next, context.language), intent: 'ORDER_FLOW', memory: context.lightweightMemory };
}

// ── Item selection ───────────────────────────────────────────────────────────

function unitPriceOf(product: any, variant?: any) {
    return Number(product.salePrice ?? variant?.price ?? product.basePrice);
}

function stockOf(product: any, variant?: any) {
    const stock = variant ? variant.stock : product.stock;
    return typeof stock === 'number' ? stock : undefined;
}

function pickVariant(product: any, text: string) {
    const variants = (product.variants || []).filter((variant: any) => variant.isActive !== false);
    if (!variants.length) return { variant: undefined, options: [] as any[] };
    const lower = text.toLowerCase();
    const named = variants.find((variant: any) => String(variant.name || '').toLowerCase().split(/\s+/).some((word: string) => word.length > 1 && lower.includes(word)));
    const inStock = variants.filter((variant: any) => variant.availability !== 'out_of_stock' && (typeof variant.stock !== 'number' || variant.stock > 0));
    if (named) return { variant: named, options: inStock };
    if (inStock.length === 1) return { variant: inStock[0], options: inStock };
    return { variant: undefined, options: inStock };
}

async function addItem(context: OrderTurnContext, existing: OrderDraft | undefined, product: any, text: string): Promise<OrderFlowResponse | null> {
    if (product.aiSellingStatus === 'disabled' || product.isActive === false) {
        return {
            message_text: say(context.language, {
                en: `My apologies - ${product.name} cannot be ordered right now. I would be glad to suggest available alternatives.`,
                bn: `দুঃখিত, ${product.name} এখন order নেওয়া যাচ্ছে না। চাইলে available বিকল্প দেখিয়ে দিতে পারি।`,
                banglish: `Dukkhito, ${product.name} ekhon order neya jacche na. Chaile available alternative dekhiye dite pari.`,
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    const { variant, options } = pickVariant(product, text);
    const draft: OrderDraft = existing || { stage: 'AWAITING_NAME', items: [], language: context.language, updatedAt: new Date().toISOString() };
    if (!draft.language) draft.language = context.language;

    if (!variant && options.length > 1) {
        draft.items = [{
            productId: String(product._id), code: productCode(product), name: product.name, unitPrice: unitPriceOf(product),
            currency: String(product.currency || 'BDT').toUpperCase(), quantity: quantityFrom(text) || 1,
        }];
        draft.stage = 'AWAITING_VARIANT';
        await saveDraft(context.businessId, context.conversationId!, draft);
        return { message_text: askVariant(draft, options, context.language), suggested_products: [card(product, text)], intent: 'ORDER_FLOW', memory: { ...context.lightweightMemory, activeProductId: String(product._id) } };
    }

    const available = stockOf(product, variant);
    if (available !== undefined && available <= 0) {
        return {
            message_text: say(context.language, {
                en: `My apologies - ${product.name} is out of stock right now, so I cannot take an order for it yet. I can show you a close alternative.`,
                bn: `দুঃখিত, ${product.name} এখন stock-এ নেই, তাই এই মুহূর্তে order নিতে পারছি না। চাইলে কাছাকাছি option দেখাতে পারি।`,
                banglish: `Dukkhito, ${product.name} ekhon stock e nei, tai ei muhurte order nite parchi na. Chaile kachakachi option dekhate pari.`,
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    const requested = quantityFrom(text) || 1;
    const quantity = available !== undefined ? Math.min(requested, available) : requested;
    const item: OrderDraftItem = {
        productId: String(product._id),
        code: productCode(product, variant),
        variantId: variant?.variantId,
        sku: variant?.sku,
        name: product.name,
        variantName: variant?.name,
        unitPrice: unitPriceOf(product, variant),
        currency: String(variant?.currency || product.currency || 'BDT').toUpperCase(),
        quantity,
    };
    const duplicate = draft.items.find((candidate) => candidate.productId === item.productId && candidate.variantId === item.variantId);
    if (duplicate) duplicate.quantity = Math.min(duplicate.quantity + quantity, available ?? MAX_QUANTITY);
    else draft.items.push(item);

    const trimmedNotice = quantity < requested
        ? say(context.language, {
            en: `We have ${quantity} of ${product.name} in stock at the moment, so I have added ${quantity}. `,
            bn: `${product.name} এখন ${quantity}টি stock-এ আছে, তাই ${quantity}টি যোগ করলাম। `,
            banglish: `${product.name} ekhon ${quantity} ta stock e ache, tai ${quantity} ta add korlam. `,
        })
        : '';

    // A returning customer is not re-interviewed: reuse whatever the profile
    // already confirms, and only ask for the fields still missing.
    if (!draft.fullName || !draft.phone || !draft.addressLine1) {
        const customer = await loadCustomer(context);
        const saved = (customer?.addresses || []).find((address: any) => address.isDefault) || customer?.addresses?.[0];
        draft.fullName = draft.fullName || plausibleName(customer?.name) || plausibleName(saved?.fullName);
        draft.phone = draft.phone || customer?.phone || saved?.phone;
        draft.addressLine1 = draft.addressLine1 || saved?.addressLine1;
        draft.city = draft.city || saved?.city;
        draft.zone = draft.zone || saved?.zone;
    }

    const reply = await advance(context, draft);
    return { ...reply, message_text: `${trimmedNotice}${reply.message_text}`, suggested_products: [card(product, text)], memory: { ...context.lightweightMemory, activeProductId: String(product._id) } };
}

async function startOrAddItem(context: OrderTurnContext, existing?: OrderDraft): Promise<OrderFlowResponse | null> {
    const products = (await context.resolveProducts(context.text)).filter((item: any) => item.aiSellingStatus !== 'disabled');
    if (!products.length) return null;
    if (products.length > 1) {
        const cards = products.slice(0, 5).map((item: any) => card(item, context.text));
        return {
            message_text: say(context.language, {
                en: 'Certainly - which one should I add to the order?',
                bn: 'অবশ্যই—কোনটি অর্ডারে যোগ করব বলুন:',
                banglish: 'Obosshoi - kon ta order e add korbo bolun:',
            }) + '\n' + cards.map((item, index) => `${index + 1}. ${item.name}, ${item.code}, ${money(item.price, item.currency)}`).join('\n'),
            suggested_products: cards,
            intent: 'ORDER_FLOW',
            memory: { ...context.lightweightMemory, recentProductIds: cards.map((item) => item.id) },
        };
    }
    return addItem(context, existing, products[0], context.text);
}

// ── Confirmation ─────────────────────────────────────────────────────────────

async function submitOrder(context: OrderTurnContext, draft: OrderDraft): Promise<OrderFlowResponse> {
    const conversationId = context.conversationId!;
    // Claim the draft so two concurrent confirmations cannot both reach checkout.
    const claimed = await Conversation.findOneAndUpdate(
        { businessId: context.businessId, conversationId, 'metadata.orderDraft.stage': 'AWAITING_CONFIRMATION' },
        { $set: { 'metadata.orderDraft.stage': 'SUBMITTING' } },
    ).lean();
    if (!claimed) {
        return {
            message_text: say(context.language, {
                en: 'Your order is being placed right now — one moment.',
                bn: 'আপনার অর্ডারটি এই মুহূর্তে প্লেস হচ্ছে—একটু অপেক্ষা করুন।',
                banglish: 'Apnar order ta ekhon place hocche - ektu opekkha korun.',
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    const restore = async () => {
        draft.stage = 'AWAITING_CONFIRMATION';
        await saveDraft(context.businessId, conversationId, draft);
    };

    const { deliveryFee: previewFee, paymentMethod: previewPayment } = await deliveryFeeFor(context.businessId, draft.city);
    if (context.sandbox) {
        // The merchant is testing the assistant — rehearse the confirmation but
        // never create an order or move real stock.
        await clearDraft(context.businessId, conversationId);
        const previewTotals = draftTotals(draft, previewFee);
        const currency = draft.items[0].currency;
        return {
            message_text: [
                say(context.language, {
                en: 'Thank you - your order is confirmed.',
                bn: 'ধন্যবাদ! আপনার অর্ডারটি কনফার্ম হয়েছে।',
                banglish: 'Dhonnobad! Apnar order ta confirm hoyeche.',
            }),
                `Order ID: ORD-SANDBOX-${Date.now().toString(36).toUpperCase()}`,
                itemLines(draft),
                `${say(context.language, { en: 'Total', bn: 'মোট', banglish: 'Total' })}: ${money(previewTotals.total, currency)} (${previewPayment})`,
                `${draft.fullName} - ${draft.phone}`,
                addressLine(draft),
                say(context.language, {
                    en: '(Test mode — no real order was created and stock did not change.)',
                    bn: '(টেস্ট মোড—আসল অর্ডার তৈরি হয়নি এবং stock পরিবর্তন হয়নি।)',
                    banglish: '(Test mode - asol order toiri hoyni, stock o bodlayni.)',
                }),
            ].join('\n'),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    const customer = await loadCustomer(context);
    if (!customer) {
        await restore();
        return {
            message_text: say(context.language, {
                en: 'I could not confirm your customer profile, so a human will complete this order safely.',
                bn: 'আপনার কাস্টমার প্রোফাইল নিশ্চিত করতে পারিনি, তাই একজন প্রতিনিধি অর্ডারটি সম্পন্ন করবেন।',
                banglish: 'Apnar customer profile confirm korte parini, tai ekjon representative order ta complete korben.',
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    const deliveryFee = previewFee;
    const paymentMethod = previewPayment;
    const shippingAddress = {
        fullName: draft.fullName!,
        phone: draft.phone!,
        addressLine1: draft.addressLine1!,
        city: draft.city!,
        zone: draft.zone || draft.city!,
        country: 'Bangladesh',
    };

    try {
        const order = await createOrderWithStock({
            businessId: context.businessId,
            customerId: customer._id,
            psid: context.conversation?.psid,
            items: draft.items.map((item) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, quantity: item.quantity })),
            shippingAddress,
            deliveryFee,
            paymentMethod,
            source: context.conversation?.platform === 'facebook' || context.conversation?.platform === 'whatsapp' ? 'messenger' : 'web',
            idempotencyKey: context.eventIdentifier,
        });

        // Remember the confirmed delivery details so a repeat customer is not re-interviewed.
        await Customer.updateOne(
            { _id: customer._id },
            { $set: { name: draft.fullName, phone: draft.phone, addresses: [{ label: 'Delivery', ...shippingAddress, isDefault: true }] } },
        ).catch(() => undefined);
        await clearDraft(context.businessId, conversationId);

        const currency = draft.items[0].currency;
        const message = [
            say(context.language, {
                en: 'Thank you - your order is confirmed.',
                bn: 'ধন্যবাদ! আপনার অর্ডারটি কনফার্ম হয়েছে।',
                banglish: 'Dhonnobad! Apnar order ta confirm hoyeche.',
            }),
            `Order ID: ${order.orderNumber}`,
            itemLines(draft),
            `${say(context.language, { en: 'Total', bn: 'মোট', banglish: 'Total' })}: ${money(order.total, currency)} (${paymentMethod}, ${say(context.language, { en: 'delivery', bn: 'ডেলিভারি', banglish: 'delivery' })} ${money(deliveryFee, currency)})`,
            `${shippingAddress.fullName} - ${shippingAddress.phone}`,
            addressLine(draft),
            say(context.language, {
                en: 'Please keep this Order ID - quote it any time you want an update. Thank you for shopping with us.',
                bn: 'Order ID টি রেখে দিন—আপডেট জানতে এটি বললেই হবে। আমাদের সাথে থাকার জন্য ধন্যবাদ।',
                banglish: 'Order ID ta rekhe din - update jante eta bollei hobe. Amader sathe thakar jonno dhonnobad.',
            }),
        ].join('\n');

        return {
            message_text: message,
            intent: 'ORDER_FLOW',
            memory: { ...context.lightweightMemory, lastOrderNumber: order.orderNumber, activeProductId: undefined },
            orderCreated: { orderId: String(order._id), orderNumber: order.orderNumber, total: order.total },
        };
    } catch (error) {
        await restore();
        const reason = error instanceof OrderCreationError ? error.message : '';
        console.error('Chat order confirmation failed:', error instanceof Error ? error.message : error);
        const stockProblem = /stock|unavailable|not found/i.test(reason);
        return {
            message_text: stockProblem
                ? say(context.language, {
                    en: `My apologies - I could not place the order: ${reason}. Tell me a smaller quantity or another product and I will arrange it right away.`,
                    bn: `দুঃখিত, অর্ডারটি করা গেল না: ${reason}। কম quantity বা অন্য product বললে সাথে সাথে করে দিচ্ছি।`,
                    banglish: `Dukkhito, order ta kora gelo na: ${reason}. Kom quantity ba onno product bolle sathe sathei kore dicchi.`,
                })
                : say(context.language, {
                    en: 'My apologies - I could not complete the order just now. A colleague will confirm it for you shortly.',
                    bn: 'দুঃখিত, এই মুহূর্তে অর্ডারটি সম্পন্ন করা গেল না। আমাদের একজন প্রতিনিধি শীঘ্রই এটি কনফার্ম করবেন।',
                    banglish: 'Dukkhito, ei muhurte order ta complete kora gelo na. Amader ekjon representative shiggiri eta confirm korben.',
                }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }
}

// ── Turn handling ────────────────────────────────────────────────────────────

async function continueDraft(context: OrderTurnContext, draft: OrderDraft): Promise<OrderFlowResponse | null> {
    const text = context.text.trim();
    const isQuestion = QUESTION_WORDS.test(text);

    if (draft.stage === 'SUBMITTING') {
        return {
            message_text: say(context.language, {
                en: 'Your order is being placed right now — one moment.',
                bn: 'আপনার অর্ডারটি এই মুহূর্তে প্লেস হচ্ছে—একটু অপেক্ষা করুন।',
                banglish: 'Apnar order ta ekhon place hocche - ektu opekkha korun.',
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    if (draft.stage === 'AWAITING_VARIANT') {
        const products = await context.resolveProducts(draft.items[0].name);
        const product = products.find((item: any) => String(item._id) === draft.items[0].productId) || products[0];
        if (!product) return null;
        const { variant, options } = pickVariant(product, text);
        const chosenByNumber = options[Number(text.trim()) - 1];
        const chosen = variant || chosenByNumber;
        if (!chosen) return isQuestion ? null : { message_text: askVariant(draft, options, context.language), intent: 'ORDER_FLOW', memory: context.lightweightMemory };
        const quantity = draft.items[0]?.quantity || 1;
        draft.items = [];
        return addItem(context, draft, product, `${chosen.name} ${quantity} ta`);
    }

    if (draft.stage === 'AWAITING_NAME') {
        const name = NAME_NOISE.test(text) || ORDER_INTENT.test(text) ? undefined : cleanName(text);
        if (!name) return isQuestion ? null : { message_text: askFor('AWAITING_NAME', context.language), intent: 'ORDER_FLOW', memory: context.lightweightMemory };
        draft.fullName = name;
        return advance(context, draft);
    }

    if (draft.stage === 'AWAITING_PHONE') {
        const phone = phoneFrom(text);
        if (!phone) {
            if (isQuestion && !/\d/.test(text)) return null;
            return {
                message_text: say(context.language, {
                    en: 'Sorry, that does not look like a valid mobile number. Could you send it as 01XXXXXXXXX please?',
                    bn: 'দুঃখিত, নম্বরটি ঠিক মনে হচ্ছে না। 01XXXXXXXXX ফরম্যাটে দেবেন প্লিজ।',
                    banglish: 'Dukkhito, number ta thik mone hocche na. 01XXXXXXXXX format e diben please.',
                }),
                intent: 'ORDER_FLOW',
                memory: context.lightweightMemory,
            };
        }
        draft.phone = phone;
        return advance(context, draft);
    }

    if (draft.stage === 'AWAITING_ADDRESS') {
        const phone = phoneFrom(text);
        const addressText = (phone ? text.replace(/(?<!\d)(?:\+?88)?0?1[3-9]\d{8}(?!\d)/, ' ') : text).replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
        if (addressText.length < 8) {
            if (isQuestion) return null;
            return { message_text: askFor('AWAITING_ADDRESS', context.language), intent: 'ORDER_FLOW', memory: context.lightweightMemory };
        }
        if (phone && !draft.phone) draft.phone = phone;
        draft.addressLine1 = addressText.slice(0, 200);
        draft.city = cityFrom(addressText) || draft.city;
        draft.zone = draft.zone || draft.city;
        return advance(context, draft);
    }

    if (draft.stage === 'AWAITING_CITY') {
        const city = cityFrom(text) || (text.length <= 30 && !/\d/.test(text) ? text.replace(/[.।!]+$/, '').trim() : undefined);
        if (!city) return isQuestion ? null : { message_text: askFor('AWAITING_CITY', context.language), intent: 'ORDER_FLOW', memory: context.lightweightMemory };
        draft.city = city;
        draft.zone = draft.zone || city;
        return advance(context, draft);
    }

    // AWAITING_CONFIRMATION
    if (CONFIRM_WORDS.test(text)) return submitOrder(context, draft);
    if (ADDRESS_CHANGE.test(text)) {
        draft.addressLine1 = undefined;
        draft.city = undefined;
        draft.zone = undefined;
        draft.stage = 'AWAITING_ADDRESS';
        await saveDraft(context.businessId, context.conversationId!, draft);
        return { message_text: askFor('AWAITING_ADDRESS', context.language), intent: 'ORDER_FLOW', memory: context.lightweightMemory };
    }
    const quantity = draft.items.length === 1 ? quantityFrom(text) : undefined;
    if (quantity && !isQuestion) {
        draft.items[0].quantity = quantity;
        await saveDraft(context.businessId, context.conversationId!, draft);
        return summaryResponse(context, draft);
    }
    return null;
}

export async function handleOrderTurn(rawContext: OrderTurnContext): Promise<OrderFlowResponse | null> {
    assertTenantBusinessId(rawContext.businessId, 'order-flow.turn');
    if (!rawContext.conversationId || !orderFlowQueryable()) return null;

    const stored = rawContext.conversation?.metadata?.orderDraft as OrderDraft | undefined;
    const draft = draftAlive(stored) ? stored : undefined;
    // Stay in the language the checkout started in: "Rafiul Islam" or a phone
    // number on its own would otherwise read as English and flip the replies.
    const conversationId = rawContext.conversationId;
    const context: OrderTurnContext = draft?.language ? { ...rawContext, language: draft.language, conversationId } : rawContext;
    const text = context.text.trim();

    if (draft && CANCEL_WORDS.test(text)) {
        await clearDraft(context.businessId, conversationId);
        return {
            message_text: say(context.language, {
                en: 'Of course - I have cancelled that order. Whenever you are ready, I am right here to help.',
                bn: 'অবশ্যই—অর্ডারটি বাতিল করে দিলাম। যেকোনো সময় বলবেন, আমি আছি।',
                banglish: 'Obosshoi - order ta cancel kore dilam. Jekono somoy bolben, ami achi.',
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }

    // A fresh order intent while a draft waits for confirmation adds to that order.
    if (ORDER_INTENT.test(text) && (!draft || draft.stage === 'AWAITING_CONFIRMATION')) {
        const added = await startOrAddItem(context, draft);
        if (added) return added;
    }

    if (draft) return continueDraft(context, draft);
    return null;
}
