import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { normalizeBangladeshPhone } from '../courier/bangladesh-phone';
import { assertTenantBusinessId } from '../tenancy/context';
import { createOrderWithStock, OrderCreationError } from './checkout.service';
import { Order } from '../models/Order';
import { card, CompactProductCard, money, productCode, requestedSku, say } from './product-card';
import { classifyLightweightIntent, LightweightIntent, parseSearchTerms } from './turn-routing.service';

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
    /** Stable idempotency key for this basket: a retry must return the same order, never a second one. */
    orderKey?: string;
    /** When the draft was claimed for submission, so a crashed submit can be recovered. */
    submittingAt?: string;
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
    /** The customer explicitly asked to place the order in this message. */
    confirmRequested?: boolean;
    /** Product resolution stays with the catalog search that already understands the merchant's wording. */
    resolveProducts: (text: string) => Promise<any[]>;
}

const DRAFT_TTL_MINUTES = 180;
const MAX_QUANTITY = 20;

// Buying is said a dozen ways. "lagbe", "dorkar" and "chai" are the everyday
// ones, and they arrive with prefixes ("vai eta amar 2 ta lagbe"), so nothing here
// is anchored.
// An unmistakable instruction to buy: checkout starts on these alone.
const ORDER_INTENT = /\b(?:nibo|nebo|nib|nite chai|nite chachchi|kinbo|kinte chai|kinte chachchi|nilam|rekhe den|book korbo|book kore rakhen|pathai den|pathiye den|pathaye den|dia den|diye den|de den|packet koren|parcel koren|order korbo|order korte chai|order korlam|order dibo|order debo|place (?:an )?order|buy (?:it|this|now)|checkout)\b|নিব|নেব|কিনব|কিনতে চাই|পাঠিয়ে\s*(?:দিন|দেন)|অর্ডার\s*(?:করব|করতে|দিব|দেব|করলাম)/i;
// "lagbe", "dorkar", "chai" mean "I want one" — but also "amar budget 3000 er
// moddhe kichu lagbe", which is browsing. They start checkout only when the
// customer also names the product or says how many.
const SOFT_ORDER_INTENT = /\b(?:lagbe|lagbo|lagto|dorkar|chai|chachchi|rakhen)\b|লাগবে|দরকার|চাই/i;
// A question asks about buying; it does not instruct us to buy.
const ASKS_RATHER_THAN_ORDERS = /\?\s*$|\b(?:pabo|hobe|jabe|parbo|ache|dibe|dibn|kobe|koto|kotodin)\s*(?:to|ki|kina|na)?\s*\??$|\b(?:pabo|hobe|jabe|parbo)\s+(?:to|ki|kina)\b/i;
// A bare affirmative answering the summary. Kept anchored: "ha" inside a sentence
// is not a confirmation.
const CONFIRM_WORDS = /^(?:confirm(?:ed)?|ha|haa|hae|hyan|hn|hmm+|ji|jee|jii|yes|yep|ok(?:ay)?|acha|accha|thik\s*ache|thik|done|hoye\s*jak|হ্যাঁ|হ্যা|জি|আচ্ছা|ঠিক\s*আছে|ওকে)[\s!.।,]*$/i;
// "ji vai, order ta confirm kore den" — the confirmation verb anywhere in the
// sentence, in every spelling Bangladeshi customers type.
const CONFIRM_ORDER_PHRASE = /\b(?:confirm|konfirm|cnfrm|conform)\b|কনফার্ম|\border\s*(?:ta|ti)?\s*(?:kore\s*)?(?:den|din|dao|deo|dio|koro|korun|felun|nin|nen)\b|\b(?:kore|kre)\s*(?:den|din|dao|deo|dio|felun)\b|অর্ডার\s*(?:টা)?\s*(?:করে\s*)?(?:দিন|দেন|দাও|করুন|ফেলুন)/i;
// An explicit cancel verb counts wherever it appears; bare negatives only when
// the whole message is the negative.
const CANCEL_EXPLICIT = /\b(?:cancel|cancle|batil)\b|বাতিল|\blagbe\s*na\b|\bdorkar\s*nei\b|লাগবে\s*না/i;
const CANCEL_WORDS = /^(?:cancel|na|no|nah|nai|thak|thak\s*lagbe\s*na|বাতিল|না|থাক|লাগবে\s*না)[\s!.।]*$/i;
const ADDRESS_CHANGE = /\b(?:address|thikana)\b.{0,24}\b(?:change|bodla|bodlate|onno|another|different|update|vul|bhul|wrong)\b|\b(?:onno|another|new)\s+(?:address|thikana)\b|ঠিকানা.{0,20}(?:বদল|পরিবর্তন|ভুল|অন্য)/i;
const NAME_CHANGE = /\b(?:nam|naam|name)\b.{0,20}\b(?:vul|bhul|wrong|change|bodla|bodlate|thik\s*na)\b|নাম.{0,16}(?:ভুল|বদল|পরিবর্তন)/i;
/** "amar ager address e pathan" — reuse what the customer already gave us once. */
const REUSE_ADDRESS = /\b(?:age|ager|ageri|agery|previous|last|same|purono)\s*(?:er)?\s*(?:order(?:ed)?)?\s*(?:address|thikana|jaygay)|আগের\s*(?:ঠিকানা|অর্ডারের)/i;
/** "koto holo total", "shob miliye koto" — a recap, not a new product search. */
const TOTAL_QUERY = /\b(?:total|mot|shob\s*miliye|sob\s*miliye|koto\s*(?:holo|holo|porlo|porbe|hoise|dite\s*hobe)|koto\s*dibo)\b|মোট\s*কত|সব\s*মিলিয়ে|কত\s*(?:হলো|পড়ল|দিতে\s*হবে)/i;
/** "mug ta bad din", "oita lagbe na" — drop an item from the basket. */
const REMOVE_ITEM = /\b(?:bad|baad)\s*(?:dao|din|den|dio|de)\b|\b(?:oi|ei|eta|oita|eita)\s*(?:ta|ti)?\s*(?:lagbe\s*na|bad)\b|\bremove\b|বাদ\s*(?:দিন|দাও)/i;
const QUESTION_WORDS = /\?|\b(?:koto|kemon|kivabe|kobe|ki|kothay|how|what|when|where|why|which|price|dam|stock|delivery|charge|discount|warranty|return|payment|bikash|bkash|nagad|rocket|cod)\b|কত|কেমন|কীভাবে|কবে|কোথায়|দাম|ছাড়|বিকাশ|নগদ/i;
/** A phone-shaped run of digits, so a question containing "2 ta" is not read as a number. */
// Greetings and flow keywords are never somebody's name.
const NAME_NOISE = /^(?:hi|hey|hello|yo|salam|assalam|walaikum|ok|okay|acha|hmm+|yes|no|na|ji|thanks?|thank you|start|order|confirm)/i;
/** "3000 er moddhe", "budget 5000", "under 1500" — framing a search, not placing an order. */
const BUDGET_PHRASE = /\b(?:budget|under|within|max(?:imum)?)\b|\b\d{2,7}\s*(?:taka|tk|৳)?\s*(?:er|র)?\s*(?:moddhe|modhye|vitore|bhitore)\b|মধ্যে|ভিতরে|বাজেট/i;
const PHONE_SHAPED = /(?<!\d)(?:\+?88)?0?1\d{6,9}(?!\d)/;

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

const WORD_NUMBERS: Record<string, number> = {
    ek: 1, ekta: 1, ekti: 1, একটা: 1, একটি: 1, এক: 1,
    dui: 2, duita: 2, duto: 2, duita_: 2, দুই: 2, দুইটা: 2, দুটো: 2,
    tin: 3, tinta: 3, তিন: 3, তিনটা: 3,
    char: 4, charta: 4, চার: 4, চারটা: 4,
    panch: 5, pach: 5, panchta: 5, পাঁচ: 5, পাঁচটা: 5,
    choy: 6, ছয়: 6, sat: 7, সাত: 7, at: 8, আট: 8, noy: 9, নয়: 9, dosh: 10, দশ: 10,
};

/** "aro ekta", "arekta" — one more than whatever is already in the basket. */
export function quantityIncrementFrom(text: string) {
    if (!/\b(?:aro|are|arek|ar)\s*(?:ek|ekta|ekti|akta)?\b|আরেকটা|আরও\s*একটা/i.test(text)) return undefined;
    const counted = text.match(/\b(?:aro|are)\s*(\d{1,2})\s*(?:ta|টা|pcs?)\b/i);
    if (counted) return Number(counted[1]);
    const word = text.match(/\b(?:aro|are)\s*([a-z]+)\s*(?:ta|টা)?\b/i)?.[1]?.toLowerCase();
    return (word && WORD_NUMBERS[word]) || 1;
}

export function quantityFrom(text: string) {
    // The digits must stand alone: a product code such as "CER-CAF6 ta nibo" ends
    // in a digit and was being read as a quantity of six.
    const counted = text.match(/(?<![\w-])(\d{1,2})\s*(?:ta|টা|টি|pc|pcs|piece|pieces|copy|set|jon)\b/i);
    const bare = counted ? undefined : text.trim().match(/^(\d{1,2})$/);
    // "duita nibo", "tinta den" — spelled-out counts are just as common as digits.
    const spelled = counted || bare ? undefined : text.toLowerCase().match(/\b(ekta|ekti|duita|duto|dui|tinta|tin|charta|char|panchta|panch|pach|choy|sat|dosh)\b|(একটা|একটি|দুইটা|দুটো|দুই|তিনটা|তিন|চারটা|চার|পাঁচটা|পাঁচ)/);
    if (spelled) return Math.min(WORD_NUMBERS[spelled[1] || spelled[2]] || 1, MAX_QUANTITY);
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

/**
 * Sub-areas a customer names instead of the district. "Mirpur 10" is Dhaka, and
 * it decides the delivery fee, so it cannot be left unrecognised.
 */
const SUB_AREAS: Array<[RegExp, string]> = [
    [/\b(?:mirpur|mohammadpur|dhanmondi|gulshan|banani|uttara|badda|rampura|mugda|khilgaon|bashundhara|banasree|motijheel|paltan|farmgate|mohakhali|tejgaon|shyamoli|kalabagan|malibagh|jatrabari|demra|keraniganj|savar|ashulia|tongi|azimpur|lalbagh|old dhaka|puran dhaka|shantinagar|bailey road|niketan|nikunja|khilkhet|kuril|baridhara|wari|gendaria|sutrapur|kamrangirchar|hazaribagh|adabor|shewrapara|kazipara|pallabi|rupnagar|agargaon|shyamoli)\b|মিরপুর|মোহাম্মদপুর|ধানমন্ডি|গুলশান|বনানী|উত্তরা|বাড্ডা|রামপুরা|যাত্রাবাড়ী|খিলগাঁও|বসুন্ধরা|মতিঝিল|ফার্মগেট|মহাখালী|তেজগাঁও|শ্যামলী|পুরান\s*ঢাকা/i, 'Dhaka'],
    [/\b(?:agrabad|halishahar|pahartali|nasirabad|khulshi|chawkbazar ctg|patenga|bayezid)\b|আগ্রাবাদ|হালিশহর|পতেঙ্গা/i, 'Chattogram'],
];

/** The district a message names, directly or through a sub-area. */
export function cityFrom(text: string) {
    return KNOWN_CITIES.find(([pattern]) => pattern.test(text))?.[1]
        || SUB_AREAS.find(([pattern]) => pattern.test(text))?.[1];
}

/** The district plus the sub-area worth keeping on the shipping label. */
export function areaFrom(text: string) {
    const city = cityFrom(text);
    if (!city) return undefined;
    const area = SUB_AREAS.find(([pattern]) => pattern.test(text));
    if (!area) return { city, zone: city };
    const matched = text.match(area[0])?.[0] || city;
    const numbered = text.match(new RegExp(`${matched}\\s*-?\\s*(\\d{1,2})`, 'i'));
    return { city, zone: numbered ? `${matched} ${numbered[1]}` : matched };
}

/**
 * Customers often hand over everything at once: "confirm kore den. Name: rafi,
 * Phone: 01712345678, address: Dhanmondi, Dhaka". Labelled values are read
 * wherever they appear so the flow asks only for what is genuinely missing.
 */
export function extractLabelledDetails(text: string) {
    const stopAtNextLabel = (value: string) => value
        .split(/\s*(?:,|;|\n|\bar\b|\band\b)?\s*(?:name|naam|nam|phone|mobile|number|contact|address|thikana|নাম|ফোন|মোবাইল|নম্বর|ঠিকানা)\s*[:\-=]/i)[0]
        .replace(/^[\s,;:.\-]+|[\s,;:.\-]+$/g, '')
        .trim();

    const rawName = text.match(/\b(?:name|naam|nam|নাম)\s*[:\-=]\s*([^,;\n]{2,60})/i)?.[1];
    const rawAddress = text.match(/\b(?:address|thikana|ঠিকানা|location)\s*[:\-=]\s*([^\n]{3,200})/i)?.[1];
    const labelledPhone = text.match(/\b(?:phone|mobile|number|contact|ফোন|মোবাইল|নম্বর)\s*[:\-=]\s*([^,;\n]{5,25})/i)?.[1];

    const address = rawAddress ? stopAtNextLabel(rawAddress) : undefined;
    return {
        fullName: rawName ? plausibleName(stopAtNextLabel(rawName)) : undefined,
        // An invalid number is left unset on purpose: the flow then asks for a real one.
        phone: phoneFrom(labelledPhone || '') || undefined,
        addressLine1: address && address.length >= 3 ? address.slice(0, 200) : undefined,
        /** A number was offered but is not a usable Bangladeshi mobile. */
        phoneRejected: Boolean(labelledPhone) && !phoneFrom(labelledPhone || ''),
    };
}

function plausibleName(value?: string) {
    const name = String(value || '').trim();
    if (name.length < 2 || name.length > 60) return undefined;
    // Placeholder identities are not names: the flow must still ask the customer.
    if (/^(?:web user|facebook user|guest|customer|sandbox tester|test user|tester|test|demo|user|na|n\/a)$/i.test(name)) return undefined;
    if (/\d/.test(name)) return undefined;
    // A question or a flow keyword is never somebody's name.
    if (/[?？]/.test(name)) return undefined;
    if (name.split(/\s+/).length > 5) return undefined;
    if (/\b(?:payment|delivery|discount|bikash|bkash|nagad|rocket|cod|order|price|dam|stock|charge|koto|kobe|kivabe|ache|hobe)\b/i.test(name)) return undefined;
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
    const reassurance = say(context.language, {
        en: `Cash on delivery - you pay when it reaches you. ${draft.city && DHAKA_CITY.test(draft.city) ? 'Usually 1-2 days inside Dhaka.' : 'Usually 2-4 days outside Dhaka.'}`,
        bn: `ক্যাশ অন ডেলিভারি—হাতে পেয়ে টাকা দেবেন। ${draft.city && DHAKA_CITY.test(draft.city) ? 'ঢাকায় সাধারণত ১-২ দিন লাগে।' : 'ঢাকার বাইরে সাধারণত ২-৪ দিন লাগে।'}`,
        banglish: `Cash on delivery - hate peye taka diben. ${draft.city && DHAKA_CITY.test(draft.city) ? 'Dhaka-y sadharonoto 1-2 din lage.' : 'Dhaka-r baire sadharonoto 2-4 din lage.'}`,
    });
    const message = [
        header,
        itemLines(draft),
        `${deliveryLabel}${draft.city ? ` (${draft.city})` : ''}: ${money(totals.deliveryFee, currency)}`,
        `${totalLabel}: ${money(totals.total, currency)} - ${paymentMethod}`,
        `${draft.fullName} - ${draft.phone}`,
        addressLine(draft),
        reassurance,
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
    // Mint the idempotency key once per basket. Using the inbound event id instead
    // would let a retried confirmation create a second order.
    if (next === 'AWAITING_CONFIRMATION' && !draft.orderKey) {
        draft.orderKey = `draft:${context.conversationId}:${Date.now().toString(36)}`;
    }
    await saveDraft(context.businessId, context.conversationId!, draft);
    if (next === 'AWAITING_CONFIRMATION') {
        // The customer already said "confirm kore den" and nothing is missing, so
        // asking them to confirm a second time would just stall their order.
        return context.confirmRequested ? submitOrder(context, draft) : summaryResponse(context, draft);
    }
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
    if (duplicate) {
        // Only an explicit count changes the quantity. Saying "eta nibo" again is
        // the customer repeating themselves, not ordering a second one.
        const explicit = quantityFrom(text) !== undefined || quantityIncrementFrom(text) !== undefined;
        if (explicit) duplicate.quantity = Math.min(duplicate.quantity + quantity, available ?? MAX_QUANTITY);
    } else {
        draft.items.push(item);
    }

    const trimmedNotice = quantity < requested
        ? say(context.language, {
            en: `We have ${quantity} of ${product.name} in stock at the moment, so I have added ${quantity}. `,
            bn: `${product.name} এখন ${quantity}টি stock-এ আছে, তাই ${quantity}টি যোগ করলাম। `,
            banglish: `${product.name} ekhon ${quantity} ta stock e ache, tai ${quantity} ta add korlam. `,
        })
        : '';

    const supplied = extractLabelledDetails(text);
    if (supplied.fullName) draft.fullName = supplied.fullName;
    if (supplied.phone) draft.phone = supplied.phone;
    if (supplied.addressLine1) {
        draft.addressLine1 = supplied.addressLine1;
        draft.city = cityFrom(supplied.addressLine1) || draft.city;
        draft.zone = draft.zone || draft.city;
    }

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

    // A number that was offered but is not usable is called out, so the customer
    // knows why they are being asked again.
    const phoneNotice = supplied.phoneRejected && !draft.phone
        ? say(context.language, {
            en: 'That mobile number does not look complete. ',
            bn: 'নম্বরটি পুরো মনে হচ্ছে না। ',
            banglish: 'Number ta puro mone hocche na. ',
        })
        : '';
    const reply = await advance(context, draft);
    return { ...reply, message_text: `${trimmedNotice}${phoneNotice}${reply.message_text}`, suggested_products: [card(product, text)], memory: { ...context.lightweightMemory, activeProductId: String(product._id) } };
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
    if (!draft.orderKey) draft.orderKey = `draft:${conversationId}:${Date.now().toString(36)}`;
    const claimed = await Conversation.findOneAndUpdate(
        { businessId: context.businessId, conversationId, 'metadata.orderDraft.stage': 'AWAITING_CONFIRMATION' },
        { $set: { 'metadata.orderDraft.stage': 'SUBMITTING', 'metadata.orderDraft.orderKey': draft.orderKey, 'metadata.orderDraft.submittingAt': new Date().toISOString() } },
    ).lean();
    if (!claimed) return submittingResponse(context, draft);

    const restore = async () => {
        draft.stage = 'AWAITING_CONFIRMATION';
        await saveDraft(context.businessId, conversationId, draft);
    };

    const { deliveryFee: previewFee, paymentMethod: previewPayment } = await deliveryFeeFor(context.businessId, draft.city);
    const customer = await loadCustomer(context) || await createCustomerFromDraft(context, draft);
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
            conversationId,
            items: draft.items.map((item) => ({ productId: item.productId, variantId: item.variantId, sku: item.sku, quantity: item.quantity })),
            shippingAddress,
            deliveryFee,
            paymentMethod,
            source: context.conversation?.platform === 'facebook' || context.conversation?.platform === 'whatsapp' ? 'messenger' : 'web',
            // Test AI orders are real orders, tagged so the merchant can tell them apart.
            ...(context.sandbox ? { adminNote: 'Placed from the Test AI sandbox' } : {}),
            idempotencyKey: draft.orderKey,
        });

        // The order and the stock movement are committed from here on, so every
        // remaining step is best-effort: none of it may turn into "order failed".
        await Customer.updateOne(
            { _id: customer._id },
            { $set: { name: draft.fullName, phone: draft.phone, addresses: [{ label: 'Delivery', ...shippingAddress, isDefault: true }] } },
        ).catch(() => undefined);
        await clearDraft(context.businessId, conversationId).catch(() => undefined);

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
                en: `We will call before delivery, and you pay only when the parcel reaches you.${draft.city && DHAKA_CITY.test(draft.city) ? ' Usually 1-2 days inside Dhaka.' : ' Usually 2-4 days outside Dhaka.'}`,
                bn: `ডেলিভারির আগে কল করা হবে, আর টাকা দেবেন পার্সেল হাতে পাওয়ার পরেই।${draft.city && DHAKA_CITY.test(draft.city) ? ' ঢাকায় সাধারণত ১-২ দিন লাগে।' : ' ঢাকার বাইরে সাধারণত ২-৪ দিন লাগে।'}`,
                banglish: `Delivery-r age call kora hobe, ar taka diben parcel hate pawar porei.${draft.city && DHAKA_CITY.test(draft.city) ? ' Dhaka-y sadharonoto 1-2 din lage.' : ' Dhaka-r baire sadharonoto 2-4 din lage.'}`,
            }),
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
        console.error('Chat order confirmation failed:', error instanceof Error ? error.message : error);
        return {
            message_text: checkoutFailureText(context, error),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }
}

/** What the customer hears when checkout refuses — grounded, kind, and actionable. */
function checkoutFailureText(context: OrderTurnContext, error: unknown) {
    const failure = error instanceof OrderCreationError ? error : undefined;
    const item = failure?.product ? failure.product : say(context.language, { en: 'that item', bn: 'পণ্যটি', banglish: 'product ta' });
    switch (failure?.code) {
        case 'INSUFFICIENT_STOCK':
            return typeof failure.available === 'number' && failure.available > 0
                ? say(context.language, {
                    en: `My apologies - only ${failure.available} of ${item} is left. Shall I place the order for ${failure.available}?`,
                    bn: `দুঃখিত, ${item} এখন ${failure.available}টি আছে। ${failure.available}টি দিয়ে অর্ডারটি করে দেব?`,
                    banglish: `Dukkhito, ${item} ekhon ${failure.available} ta ache. ${failure.available} ta diye order ta kore debo?`,
                })
                : say(context.language, {
                    en: `My apologies - ${item} just went out of stock. I can show you the closest alternative right away.`,
                    bn: `দুঃখিত, ${item} এইমাত্র শেষ হয়ে গেছে। চাইলে কাছাকাছি option এখনই দেখাতে পারি।`,
                    banglish: `Dukkhito, ${item} eimatro shesh hoye geche. Chaile kachakachi option ekhoni dekhate pari.`,
                });
        case 'PRODUCT_UNAVAILABLE':
        case 'VARIANT_UNAVAILABLE':
        case 'VARIANT_NOT_FOUND':
        case 'PRODUCT_NOT_FOUND':
            return say(context.language, {
                en: `My apologies - ${item} cannot be ordered right now. Tell me what you need and I will suggest what we do have.`,
                bn: `দুঃখিত, ${item} এখন অর্ডার নেওয়া যাচ্ছে না। কী দরকার বলুন, যা আছে তা থেকে দেখিয়ে দিচ্ছি।`,
                banglish: `Dukkhito, ${item} ekhon order neya jacche na. Ki dorkar bolun, ja ache ta theke dekhiye dicchi.`,
            });
        case 'INVALID_QUANTITY':
            return say(context.language, {
                en: 'Could you tell me how many pieces you need? I will place it right away.',
                bn: 'কয়টি নেবেন বলবেন প্লিজ? সাথে সাথেই অর্ডারটি করে দিচ্ছি।',
                banglish: 'Koyta niben bolben please? Sathe sathei order ta kore dicchi.',
            });
        default:
            return say(context.language, {
                en: 'My apologies - I could not complete the order just now. A colleague will confirm it for you shortly.',
                bn: 'দুঃখিত, এই মুহূর্তে অর্ডারটি সম্পন্ন করা গেল না। আমাদের একজন প্রতিনিধি শীঘ্রই এটি কনফার্ম করবেন।',
                banglish: 'Dukkhito, ei muhurte order ta complete kora gelo na. Amader ekjon representative shiggiri eta confirm korben.',
            });
    }
}

const SUBMIT_STUCK_MS = 90_000;

/**
 * A confirmation already in flight. If the submit crashed between claiming the
 * draft and finishing, the customer must not be told "one moment" for three
 * hours — look the order up by its durable key and answer honestly.
 */
async function submittingResponse(context: OrderTurnContext, draft: OrderDraft): Promise<OrderFlowResponse> {
    const startedAt = draft.submittingAt ? new Date(draft.submittingAt).getTime() : 0;
    const stuck = startedAt > 0 && Date.now() - startedAt > SUBMIT_STUCK_MS;
    if (stuck && draft.orderKey) {
        const placed = await Order.findOne({ businessId: context.businessId, idempotencyKey: draft.orderKey }).select('orderNumber total').lean().catch(() => null) as any;
        if (placed) {
            await clearDraft(context.businessId, context.conversationId!).catch(() => undefined);
            return {
                message_text: say(context.language, {
                    en: `Good news - your order went through. Order ID: ${placed.orderNumber}.`,
                    bn: `সুখবর—আপনার অর্ডারটি হয়ে গেছে। Order ID: ${placed.orderNumber}।`,
                    banglish: `Sukhobor - apnar order ta hoye geche. Order ID: ${placed.orderNumber}.`,
                }),
                intent: 'ORDER_FLOW',
                memory: { ...context.lightweightMemory, lastOrderNumber: placed.orderNumber },
                orderCreated: { orderId: String(placed._id), orderNumber: placed.orderNumber, total: placed.total },
            };
        }
        draft.stage = 'AWAITING_CONFIRMATION';
        draft.submittingAt = undefined;
        await saveDraft(context.businessId, context.conversationId!, draft);
        return {
            message_text: say(context.language, {
                en: 'Sorry for the wait - that attempt did not go through. Reply "confirm" and I will place it now.',
                bn: 'অপেক্ষা করানোর জন্য দুঃখিত—ওই চেষ্টাটি সম্পন্ন হয়নি। "confirm" লিখুন, এখনই করে দিচ্ছি।',
                banglish: 'Opekkha koranor jonno dukkhito - oi chestata sompanno hoyni. "confirm" likhun, ekhoni kore dicchi.',
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }
    return {
        message_text: say(context.language, {
            en: 'Your order is being placed right now — one moment please.',
            bn: 'আপনার অর্ডারটি এই মুহূর্তে প্লেস হচ্ছে—একটু অপেক্ষা করুন প্লিজ।',
            banglish: 'Apnar order ta ekhon place hocche - ektu opekkha korun please.',
        }),
        intent: 'ORDER_FLOW',
        memory: context.lightweightMemory,
    };
}

// ── Turn handling ────────────────────────────────────────────────────────────

async function continueDraft(context: OrderTurnContext, draft: OrderDraft): Promise<OrderFlowResponse | null> {
    const text = context.text.trim();
    const isQuestion = QUESTION_WORDS.test(text);
    const reply = (message: string): OrderFlowResponse => ({ message_text: message, intent: 'ORDER_FLOW', memory: context.lightweightMemory });

    if (draft.stage === 'SUBMITTING') return submittingResponse(context, draft);

    // A recap works at any stage: the customer asking "koto holo total" must never
    // be answered with a catalog search for the word "total".
    if (TOTAL_QUERY.test(text) && draft.items.length) return summaryResponse(context, draft);

    // Dropping an item is a basket edit, not a new order line.
    if (REMOVE_ITEM.test(text) && draft.items.length) {
        const removal = await removeItem(context, draft, text);
        if (removal) return removal;
    }

    // A customer mid-checkout who asks to see products is browsing, not answering.
    // Let the catalog reply; the pending question is re-appended afterwards, so the
    // order is neither lost nor allowed to swallow the conversation.
    if (['AWAITING_NAME', 'AWAITING_PHONE', 'AWAITING_ADDRESS', 'AWAITING_CITY'].includes(draft.stage)
        && ['CATALOG_BROWSE', 'PRODUCT_SEARCH', 'PRODUCT_PRICE', 'PRODUCT_STOCK', 'PRODUCT_IMAGE', 'PRODUCT_COMPARE'].includes(classifyLightweightIntent(text))
        && parseSearchTerms(text).length > 0) {
        return null;
    }

    // Whatever the customer labelled in this message is taken first, whichever
    // question is pending — they may answer three of them in one line.
    const inline = extractLabelledDetails(text);
    let absorbed = false;
    if (inline.fullName && inline.fullName !== draft.fullName) { draft.fullName = inline.fullName; absorbed = true; }
    if (inline.phone && inline.phone !== draft.phone) { draft.phone = inline.phone; absorbed = true; }
    if (inline.addressLine1 && inline.addressLine1 !== draft.addressLine1) {
        applyAddress(draft, inline.addressLine1);
        absorbed = true;
    }
    if (absorbed) {
        const advanced = await advance(context, draft);
        if (inline.phoneRejected && !draft.phone) {
            return { ...advanced, message_text: say(context.language, {
                en: 'That mobile number does not look complete. ',
                bn: 'নম্বরটি পুরো মনে হচ্ছে না। ',
                banglish: 'Number ta puro mone hocche na. ',
            }) + advanced.message_text };
        }
        return advanced;
    }

    if (draft.stage === 'AWAITING_VARIANT') {
        const products = await context.resolveProducts(draft.items[0].name);
        const product = products.find((item: any) => String(item._id) === draft.items[0].productId) || products[0];
        if (!product) return null;
        const { variant, options } = pickVariant(product, text);
        const chosenByNumber = options[Number(text.trim()) - 1];
        const chosen = variant || chosenByNumber;
        if (!chosen) return isQuestion ? null : reply(askVariant(draft, options, context.language));
        const quantity = draft.items[0]?.quantity || 1;
        draft.items = [];
        return addItem(context, draft, product, `${chosen.name} ${quantity} ta`);
    }

    if (draft.stage === 'AWAITING_NAME') {
        // A question is answered by the rest of the assistant, never stored as a name.
        if (isQuestion || CONFIRM_ORDER_PHRASE.test(text) || ORDER_INTENT.test(text)) return null;
        const name = NAME_NOISE.test(text) ? undefined : cleanName(text);
        if (!name) return reply(askFor('AWAITING_NAME', context.language));
        draft.fullName = name;
        return advance(context, draft);
    }

    if (draft.stage === 'AWAITING_PHONE') {
        const phone = phoneFrom(text);
        if (!phone) {
            // "2 ta nile koto porbe?" carries digits but was never meant as a number.
            if (isQuestion && !PHONE_SHAPED.test(text)) return null;
            return reply(say(context.language, {
                en: 'Sorry, that does not look like a valid mobile number. Could you send it as 01XXXXXXXXX please?',
                bn: 'দুঃখিত, নম্বরটি ঠিক মনে হচ্ছে না। 01XXXXXXXXX ফরম্যাটে দেবেন প্লিজ।',
                banglish: 'Dukkhito, number ta thik mone hocche na. 01XXXXXXXXX format e diben please.',
            }));
        }
        draft.phone = phone;
        return advance(context, draft);
    }

    if (draft.stage === 'AWAITING_ADDRESS') {
        // "amar ager address e pathan" means the saved one, not a place called that.
        if (REUSE_ADDRESS.test(text)) {
            const saved = await savedAddress(context);
            if (saved) {
                draft.fullName = draft.fullName || saved.fullName;
                draft.phone = draft.phone || saved.phone;
                draft.addressLine1 = saved.addressLine1;
                draft.city = saved.city;
                draft.zone = saved.zone || saved.city;
                return advance(context, draft);
            }
            return reply(say(context.language, {
                en: 'I could not find a saved address for you, so please send the full delivery address.',
                bn: 'আপনার সেভ করা ঠিকানা পাইনি, তাই পুরো ডেলিভারি ঠিকানাটা লিখে দিন প্লিজ।',
                banglish: 'Apnar save kora address paini, tai puro delivery address ta likhe din please.',
            }));
        }
        const phone = phoneFrom(text);
        const addressText = (phone ? text.replace(PHONE_SHAPED, ' ') : text).replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
        const looksLikeAddress = addressText.length >= 8
            && (/\d/.test(addressText) || addressText.split(/\s+/).length >= 2 || Boolean(cityFrom(addressText)));
        if (!looksLikeAddress || (isQuestion && !cityFrom(addressText) && !/\d/.test(addressText))) {
            if (isQuestion) return null;
            return reply(askFor('AWAITING_ADDRESS', context.language));
        }
        if (phone && !draft.phone) draft.phone = phone;
        applyAddress(draft, addressText);
        return advance(context, draft);
    }

    if (draft.stage === 'AWAITING_CITY') {
        if (isQuestion && !cityFrom(text)) return null;
        const area = areaFrom(text);
        const freeText = text.split(/\s+/).length <= 3 && !NAME_NOISE.test(text) && !/[?]/.test(text)
            ? text.replace(/[.।!]+$/, '').trim()
            : undefined;
        const city = area?.city || (freeText && freeText.length >= 3 ? freeText : undefined);
        if (!city) return reply(askFor('AWAITING_CITY', context.language));
        draft.city = city;
        draft.zone = area?.zone || draft.zone || city;
        return advance(context, draft);
    }

    // ── AWAITING_CONFIRMATION ────────────────────────────────────────────────
    if (CONFIRM_WORDS.test(text) || CONFIRM_ORDER_PHRASE.test(text)) return submitOrder(context, draft);

    if (ADDRESS_CHANGE.test(text)) {
        draft.addressLine1 = undefined;
        draft.city = undefined;
        draft.zone = undefined;
        draft.stage = 'AWAITING_ADDRESS';
        await saveDraft(context.businessId, context.conversationId!, draft);
        return reply(askFor('AWAITING_ADDRESS', context.language));
    }

    if (NAME_CHANGE.test(text)) {
        draft.fullName = undefined;
        draft.stage = 'AWAITING_NAME';
        await saveDraft(context.businessId, context.conversationId!, draft);
        return reply(askFor('AWAITING_NAME', context.language));
    }

    // "number ta vul hoise, 01812345678 ta den" — correct it and re-show the summary.
    const correctedPhone = phoneFrom(text);
    if (correctedPhone && correctedPhone !== draft.phone) {
        draft.phone = correctedPhone;
        await saveDraft(context.businessId, context.conversationId!, draft);
        return summaryResponse(context, draft);
    }

    const correctedCity = !isQuestion ? areaFrom(text) : undefined;
    if (correctedCity && correctedCity.city !== draft.city) {
        draft.city = correctedCity.city;
        draft.zone = correctedCity.zone;
        await saveDraft(context.businessId, context.conversationId!, draft);
        return summaryResponse(context, draft);
    }

    const increment = quantityIncrementFrom(text);
    const quantity = increment !== undefined ? undefined : quantityFrom(text);
    if ((increment !== undefined || quantity !== undefined) && !isQuestion) {
        const target = targetItem(draft, text);
        if (target) {
            const wanted = increment !== undefined ? target.quantity + increment : quantity!;
            const capped = await cappedQuantity(context, target, wanted);
            target.quantity = capped.quantity;
            await saveDraft(context.businessId, context.conversationId!, draft);
            const summary = await summaryResponse(context, draft);
            return capped.notice ? { ...summary, message_text: capped.notice + summary.message_text } : summary;
        }
    }
    return null;
}

/** The item a basket edit refers to: the named one, or the only one there is. */
function targetItem(draft: OrderDraft, text: string) {
    if (draft.items.length === 1) return draft.items[0];
    const lower = text.toLowerCase();
    return draft.items.find((item) =>
        (item.code && lower.includes(item.code.toLowerCase()))
        || item.name.toLowerCase().split(/\s+/).some((word) => word.length > 2 && lower.includes(word)));
}

/** Never promise more than the shelf holds, and say so when trimming. */
async function cappedQuantity(context: OrderTurnContext, item: OrderDraftItem, wanted: number) {
    const requested = Math.max(1, Math.min(wanted, MAX_QUANTITY));
    const products = await context.resolveProducts(item.code || item.name).catch(() => []);
    const product = products.find((candidate: any) => String(candidate._id) === item.productId);
    const variant = product && item.variantId ? (product.variants || []).find((candidate: any) => candidate.variantId === item.variantId) : undefined;
    const available = product ? stockOf(product, variant) : undefined;
    if (available === undefined || requested <= available) return { quantity: requested, notice: '' };
    return {
        quantity: Math.max(1, available),
        notice: say(context.language, {
            en: `We have ${available} of ${item.name} in stock right now. `,
            bn: `${item.name} এখন ${available}টি stock-এ আছে। `,
            banglish: `${item.name} ekhon ${available} ta stock e ache. `,
        }),
    };
}

/** "mug ta bad din" — take it out, and end the draft if nothing is left. */
async function removeItem(context: OrderTurnContext, draft: OrderDraft, text: string): Promise<OrderFlowResponse | null> {
    const target = targetItem(draft, text);
    if (!target) return null;
    draft.items = draft.items.filter((item) => item !== target);
    if (!draft.items.length) {
        await clearDraft(context.businessId, context.conversationId!);
        return {
            message_text: say(context.language, {
                en: `No problem, I have taken ${target.name} out. Tell me whenever you want to order something else.`,
                bn: `কোনো সমস্যা নেই, ${target.name} বাদ দিয়ে দিলাম। অন্য কিছু নিতে চাইলে বলবেন।`,
                banglish: `Kono somossa nei, ${target.name} bad diye dilam. Onno kichu nite chaile bolben.`,
            }),
            intent: 'ORDER_FLOW',
            memory: context.lightweightMemory,
        };
    }
    await saveDraft(context.businessId, context.conversationId!, draft);
    const summary = await summaryResponse(context, draft);
    return { ...summary, message_text: say(context.language, {
        en: `${target.name} is out of the order. `,
        bn: `${target.name} অর্ডার থেকে বাদ দিলাম। `,
        banglish: `${target.name} order theke bad dilam. `,
    }) + summary.message_text };
}

/** One place that decides city and zone from an address line. */
function applyAddress(draft: OrderDraft, addressText: string) {
    const area = areaFrom(addressText);
    draft.addressLine1 = addressText.slice(0, 200);
    draft.city = area?.city || draft.city;
    draft.zone = area?.zone || draft.zone || draft.city;
}

/** No customer record yet (a sandbox or an unlinked web chat) — create one from the draft. */
async function createCustomerFromDraft(context: OrderTurnContext, draft: OrderDraft) {
    const psid = context.conversation?.psid || `chat:${context.conversationId}`;
    try {
        return await Customer.findOneAndUpdate(
            { psid },
            {
                $set: { name: draft.fullName, phone: draft.phone, lastMessageAt: new Date() },
                $setOnInsert: { language: 'bn', tags: ['chat-customer'], notes: '', optedOut: false },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
    } catch (error) {
        console.error('Could not create the customer for this order:', error instanceof Error ? error.message : error);
        return null;
    }
}

async function savedAddress(context: OrderTurnContext) {
    const customer = await loadCustomer(context);
    const saved = (customer?.addresses || []).find((address: any) => address.isDefault) || customer?.addresses?.[0];
    return saved && saved.addressLine1 && saved.city ? saved : undefined;
}

/**
 * Does this turn instruct us to place an order? A plain buy verb does; a soft
 * "lagbe" only counts when the message also names the product or a quantity, and
 * a question never does.
 */
/** Did this message itself carry the delivery details? */
function hasLabelledDetails(text: string) {
    const supplied = extractLabelledDetails(text);
    return Boolean(supplied.fullName || supplied.phone || supplied.addressLine1);
}

function wantsToOrder(text: string, context: OrderTurnContext) {
    if (CONFIRM_ORDER_PHRASE.test(text)) return true;
    if (ASKS_RATHER_THAN_ORDERS.test(text) && !ORDER_INTENT.test(text)) return false;
    if (ORDER_INTENT.test(text)) return true;
    if (!SOFT_ORDER_INTENT.test(text)) return false;
    if (ASKS_RATHER_THAN_ORDERS.test(text)) return false;
    // "budget 600 er moddhe ekta mug lagbe" is a search: the customer has not seen
    // a price yet, so answer with the product first and let them say "nibo".
    if (BUDGET_PHRASE.test(text)) return false;
    // A quoted code is unambiguous; otherwise the product must already be the one
    // we just showed them.
    return Boolean(requestedSku(text)) || Boolean(context.entity?.activeProductId);
}

export async function handleOrderTurn(rawContext: OrderTurnContext): Promise<OrderFlowResponse | null> {
    assertTenantBusinessId(rawContext.businessId, 'order-flow.turn');
    if (!rawContext.conversationId || !orderFlowQueryable()) return null;

    const stored = rawContext.conversation?.metadata?.orderDraft as OrderDraft | undefined;
    const draft = draftAlive(stored) ? stored : undefined;
    // Stay in the language the checkout started in: "Rafiul Islam" or a phone
    // number on its own would otherwise read as English and flip the replies.
    const conversationId = rawContext.conversationId;
    const text = rawContext.text.trim();
    const context: OrderTurnContext = {
        ...rawContext,
        conversationId,
        ...(draft?.language ? { language: draft.language } : {}),
        // Skipping the summary is only safe when the customer is answering one they
        // have already seen, or supplied every detail in this very message. A bare
        // "confirm kore den" against a remembered product still gets a summary first.
        confirmRequested: (CONFIRM_ORDER_PHRASE.test(text) || CONFIRM_WORDS.test(text))
            && (draft?.stage === 'AWAITING_CONFIRMATION' || hasLabelledDetails(text)),
    };

    // "vai ekhon lagbe na, cancel kore den" — the verb decides, not the shape of the sentence.
    // "cancel kore den" carries a confirmation-shaped verb too, so the cancel verb
    // wins unless the customer literally said "confirm".
    const saysConfirm = /(?:confirm|konfirm|cnfrm|conform)|কনফার্ম/i.test(text);
    if (draft && (CANCEL_EXPLICIT.test(text) || CANCEL_WORDS.test(text)) && !saysConfirm) {
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

    // The pending question owns the turn; only then can a new order intent add an
    // item, so "confirm" answers the summary instead of ordering the same thing twice.
    if (draft) {
        const handled = await continueDraft(context, draft);
        if (handled) return handled;
    }

    if (wantsToOrder(text, context)) {
        const added = await startOrAddItem(context, draft);
        if (added) return added;
    }
    return null;
}
