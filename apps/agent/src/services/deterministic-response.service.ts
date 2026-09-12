import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Knowledge } from '../models/Knowledge';
import { Offering } from '../models/Offering';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { assertTenantBusinessId } from '../tenancy/context';
import { ConversationLanguage, resolveConversationLanguage } from './conversation-intelligence.service';
import { retrieveRelevantAwareness } from './business-awareness.service';
import { classifyLightweightIntent, detectExplicitLanguagePreference, extractBudget, extractLightweightMemory, LightweightIntent, parseSearchTerms } from './turn-routing.service';
import { setupQuestionStorageKey } from './business-setup.service';
import { businessTypeLabel } from './adaptive-training.service';
import { handleOrderTurn, pendingOrderPrompt, setOrderDraftLanguage } from './order-flow.service';
import { availableVariant, card, cardLines, catalogQueryable, CompactProductCard, COLOR_WORDS, escaped, money, PRODUCT_CARD_FIELDS, requestedSku, say, sellable, termMatchScore, termPredicate } from './product-card';

export type { CompactProductCard } from './product-card';
export interface DeterministicTurnResponse { message_text: string; suggested_products?: CompactProductCard[]; intent: LightweightIntent; memory?: Record<string, unknown>; orderCreated?: { orderId: string; orderNumber: string; total: number }; }

const PRODUCT_SEARCH_LIMIT = 5;

async function getBusinessSafe(businessId: string) {
    if (mongoose.connection.readyState !== 1 && !(Business.findById as any)?.mock) return null;
    try { return await Business.findById(businessId).select('name businessType businessSubType brandVoice phone').lean(); } catch { return null; }
}

async function getOfferingsSafe(businessId: string) {
    if (mongoose.connection.readyState !== 1 && !(Offering.find as any)?.mock) return [];
    try { return await Offering.find({ businessId, status: 'active', merchantConfirmed: { $ne: false } }).select('name offeringType').limit(3).lean(); } catch { return []; }
}

const deliveryIntent = /status|where|track|parcel|delivery|koi|kothay|hoise|অবস্থা|কোথায়|পার্সেল|ডেলিভারি/i;
const followupWords = /^(?:etar|etaar|eta|this|it|this one|ওটার|এটার|এটি|এইটার)?\s*(?:price|dam|দাম|stock|available|availability|ache|ase|আছে|ছবি|picture|photo|image|pic|black|white|blue|red|size|sizes|সাইজ).{0,35}$/i;
const sizeInquiryRegex = /\b(size|sizes|সাইজ)\b/i;


const courierStatusLabels: Record<string, string> = { pending: 'pending courier processing', submitted: 'submitted to Steadfast', in_transit: 'in transit', delivered: 'delivered', cancelled: 'cancelled', returned: 'returned', failed: 'affected by a courier processing issue', unknown: 'awaiting a confirmed courier update' };


function variantAlternativeResponse(product: any, requestedColor: string, language: string, lightweightMemory: Record<string, unknown>): DeterministicTurnResponse | null {
    const alternative = availableVariant(product);
    if (!alternative) return null;
    const alternativeName = alternative.name || 'alternative';
    const alternativeCard = card(product, alternativeName);
    const priceFormatted = money(alternativeCard.price, alternativeCard.currency);
    const message = language === 'en'
        ? `${requestedColor} is currently out of stock, but the same design is available in ${alternativeName} (${priceFormatted}).`
        : language === 'bn'
            ? `${requestedColor} ভ্যারিয়েন্টটি বর্তমানে available নেই, তবে একই ডিজাইনের ${alternativeName} ভ্যারিয়েন্ট স্টকে আছে (দাম ${priceFormatted})।`
            : `${requestedColor} ta ekhon available nei, but same design-er ${alternativeName} variant ache (দাম ${priceFormatted})।`;
    return {
        message_text: message,
        suggested_products: [alternativeCard],
        intent: 'PRODUCT_VARIANT',
        memory: { ...lightweightMemory, activeProductId: String(product._id), recentProductIds: [String(product._id)] },
    };
}

/**
 * Every reply is plain text for Messenger/WhatsApp: no markdown, one fact per
 * line, and each product line carries the code the customer can quote back to
 * order. The tone is a courteous shop assistant — acknowledge, answer, offer one
 * clear next step.
 */
function productText(intent: LightweightIntent, cards: CompactProductCard[], language: string, text = '') {
    const one = cards[0];
    const price = money(one.price, one.currency);
    if (intent === 'PRODUCT_IMAGE') return one.image
        ? say(language, {
            en: `Here is ${one.name} (${one.code}).`,
            bn: `এই যে, ${one.name} (${one.code})-এর ছবি দিলাম।`,
            banglish: `Ei je, ${one.name} (${one.code})-er chobi ta dilam.`,
        })
        : say(language, {
            en: `Sorry, a confirmed photo of ${one.name} (${one.code}) is not added yet. I am happy to share any other detail.`,
            bn: `দুঃখিত, ${one.name} (${one.code})-এর confirmed ছবি এখনো যোগ করা হয়নি। অন্য কোনো details লাগলে বলবেন।`,
            banglish: `Dukkhito, ${one.name} (${one.code})-er confirmed chobi ekhono add kora hoyni. Onno kono details lagle bolben.`,
        });
    if (intent === 'PRODUCT_PRICE') {
        const stock = typeof one.stock === 'number'
            ? say(language, { en: ` ${one.stock} in stock.`, bn: ` এখন ${one.stock}টি stock-এ আছে।`, banglish: ` Ekhon ${one.stock} ta stock e ache.` })
            : '';
        return say(language, {
            en: `${one.name} (${one.code}) is ${price}.${stock} Say the word and I will place the order for you.`,
            bn: `জি, ${one.name} (${one.code})-এর দাম ${price}।${stock} নিতে চাইলে বলবেন, আমি order-টা করে দিচ্ছি।`,
            banglish: `Ji, ${one.name} (${one.code})-er price ${price}.${stock} Nite chaile bolben, ami order ta kore dicchi.`,
        });
    }
    if (intent === 'PRODUCT_STOCK') {
        if (one.availability === 'out_of_stock') return say(language, {
            en: `Sorry, ${one.name} (${one.code}) is out of stock right now. I can show you a close alternative if you like.`,
            bn: `দুঃখিত, ${one.name} (${one.code}) এখন stock-এ নেই। চাইলে কাছাকাছি অন্য option দেখাতে পারি।`,
            banglish: `Dukkhito, ${one.name} (${one.code}) ekhon stock e nei. Chaile kachakachi onno option dekhate pari.`,
        });
        if (one.availability === 'preorder') return say(language, {
            en: `${one.name} (${one.code}) is available on preorder. I would be glad to reserve one for you.`,
            bn: `${one.name} (${one.code}) এখন preorder করা যাচ্ছে। চাইলে আপনার জন্য রেখে দিতে পারি।`,
            banglish: `${one.name} (${one.code}) ekhon preorder kora jacche. Chaile apnar jonno rekhe dite pari.`,
        });
        if (one.availability === 'in_stock' && typeof one.stock === 'number') return say(language, {
            en: `Yes, ${one.name} (${one.code}) is in stock - ${one.stock} available at ${price}. Shall I place the order?`,
            bn: `জি, ${one.name} (${one.code}) stock-এ আছে—${one.stock}টি available, দাম ${price}। নিতে চাইলে বলবেন।`,
            banglish: `Ji, ${one.name} (${one.code}) stock e ache - ${one.stock} ta available, price ${price}. Nite chaile bolben.`,
        });
        if (one.availability === 'in_stock') return say(language, {
            en: `Yes, ${one.name} (${one.code}) is in stock at ${price}. The exact quantity is not listed.`,
            bn: `জি, ${one.name} (${one.code}) stock-এ আছে, দাম ${price}। Exact quantity দেওয়া নেই।`,
            banglish: `Ji, ${one.name} (${one.code}) stock e ache, price ${price}. Exact quantity deya nei.`,
        });
        return say(language, {
            en: `Stock for ${one.name} (${one.code}) is not confirmed yet. I will check and get back to you.`,
            bn: `${one.name} (${one.code})-এর stock এখনো confirm করা হয়নি। আমি দেখে জানিয়ে দিচ্ছি।`,
            banglish: `${one.name} (${one.code})-er stock ekhono confirm kora hoyni. Ami dekhe janiye dicchi.`,
        });
    }
    if (intent === 'PRODUCT_VARIANT' && one.relevantVariant) {
        const variantPrice = money(one.relevantVariant.price, one.relevantVariant.currency);
        const qty = typeof one.relevantVariant.stock === 'number'
            ? say(language, { en: `, ${one.relevantVariant.stock} in stock`, bn: `, ${one.relevantVariant.stock}টি stock-এ আছে`, banglish: `, ${one.relevantVariant.stock} ta stock e ache` })
            : '';
        return say(language, {
            en: `Yes, the ${one.relevantVariant.name} variant of ${one.name} is available - ${one.code}, ${variantPrice}${qty}.`,
            bn: `জি, ${one.name}-এর ${one.relevantVariant.name} variant আছে—${one.code}, ${variantPrice}${qty}।`,
            banglish: `Ji, ${one.name}-er ${one.relevantVariant.name} variant ache - ${one.code}, ${variantPrice}${qty}.`,
        });
    }
    if (cards.length === 1) {
        const stockNote = one.availability === 'out_of_stock'
            ? say(language, { en: 'It is out of stock right now.', bn: 'এটি এখন stock-এ নেই।', banglish: 'Eita ekhon stock e nei.' })
            : typeof one.stock === 'number'
              ? say(language, { en: `${one.stock} in stock.`, bn: `${one.stock}টি stock-এ আছে।`, banglish: `${one.stock} ta stock e ache.` })
              : '';
        return say(language, {
            en: `Yes, we have it:\n${one.name}, ${one.code}, ${price}\n${stockNote} Tell me and I will place the order.`,
            bn: `জি, এটি আমাদের কাছে আছে:\n${one.name}, ${one.code}, ${price}\n${stockNote} নিতে চাইলে বলবেন, আমি order-টা করে দিচ্ছি।`,
            banglish: `Ji, eita amader kache ache:\n${one.name}, ${one.code}, ${price}\n${stockNote} Nite chaile bolben, ami order ta kore dicchi.`,
        });
    }
    const heading = say(language, {
        en: `Certainly - we have ${cards.length} options for you:`,
        bn: `অবশ্যই—আপনার জন্য ${cards.length}টি option আছে:`,
        banglish: `Obosshoi - apnar jonno ${cards.length} ta option ache:`,
    });
    const close = say(language, {
        en: '\nTell me the name or the code and I will confirm stock and place the order.',
        bn: '\nName বা code-টি বললে আমি stock confirm করে order-টা করে দিচ্ছি।',
        banglish: '\nName ba code ta bolle ami stock confirm kore order ta kore dicchi.',
    });
    return `${heading}\n${cardLines(cards, language)}${close}`;
}

function formatOrderStatus(order: any) { const status = order.courier?.status ? courierStatusLabels[order.courier.status] || courierStatusLabels.unknown : order.status; return `Order #${order.orderNumber} is currently ${status}.${order.courier?.trackingCode ? ` Tracking code: ${order.courier.trackingCode}.` : ''}`; }

async function findProducts(businessId: string, text: string, activeProductId?: string, recentProductIds: string[] = []) {
    const intent = classifyLightweightIntent(text);
    const sku = requestedSku(text);
    if (sku) {
        const exactSkuProduct = await Product.findOne({ businessId, isActive: true, merchantConfirmed: { $ne: false }, $or: [{ slug: sku.toLowerCase() }, { 'variants.sku': sku }, { publicCode: sku.toUpperCase() }, { barcode: sku }] }).select(PRODUCT_CARD_FIELDS).lean();
        if (exactSkuProduct) return [exactSkuProduct];
    }
    if (activeProductId && (followupWords.test(text.trim()) || ['PRODUCT_IMAGE','PRODUCT_STOCK','PRODUCT_VARIANT'].includes(intent))) {
        const active = await Product.findOne({ _id: activeProductId, businessId, isActive: true, merchantConfirmed: { $ne: false } }).select(PRODUCT_CARD_FIELDS).lean();
        if (active) return [active];
    }
    if (intent === 'PRODUCT_COMPARE' && recentProductIds.length) return Product.find({ businessId, _id: { $in: recentProductIds.slice(0, 4) }, isActive: true }).select(PRODUCT_CARD_FIELDS).limit(4).lean();
    const terms = parseSearchTerms(text); if (!terms.length) return [];
    const max = extractBudget(text);
    const searchFilter = { $and: terms.slice(0, 5).map(termPredicate) };
    const priceFilter = { $or: [{ salePrice: { $lte: max } }, { salePrice: null, basePrice: { $lte: max } }] };
    const base = { businessId, isActive: true, merchantConfirmed: { $ne: false } };
    const strict = await Product.find({ ...base, ...(max !== undefined ? { $and: [searchFilter, priceFilter] } : searchFilter) }).select(PRODUCT_CARD_FIELDS).limit(PRODUCT_SEARCH_LIMIT).lean();
    if (strict.length) return strict;
    // Every term matching at once is the precise answer, but a customer types a
    // product noun inside a sentence ("ekta coffee mug lagbe, ceramic"). Requiring
    // all terms then finds nothing and the catalog looks empty, so fall back to
    // any-term matches ranked by how well each product actually matches.
    const looseFilter = { $or: terms.slice(0, 5).map(termPredicate) };
    const loose = await Product.find({ ...base, ...(max !== undefined ? { $and: [looseFilter, priceFilter] } : looseFilter) }).select(PRODUCT_CARD_FIELDS).limit(PRODUCT_SEARCH_LIMIT * 3).lean();
    return loose
        .map((item: any) => ({ item, score: termMatchScore(item, terms) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => (right.score - left.score) || (Number(sellable(right.item)) - Number(sellable(left.item))))
        .slice(0, PRODUCT_SEARCH_LIMIT)
        .map((entry) => entry.item);
}

async function stableBusinessFact(businessId: string, text: string, language: string, existingBusiness?: any) {
    const business = existingBusiness || await Business.findById(businessId).select('phone businessType').lean();
    if (/\b(?:support|contact|phone|mobile|whatsapp)\s*(?:number|no\b)|\bnumber\s*(?:ta|ti)?\s*(?:den|din|deo|dao|chai)\b|ফোন\s*নাম্বার|নাম্বার/i.test(text) && business?.phone) return language === 'en' ? `You can contact us at ${business.phone}.` : `যোগাযোগের number: ${business.phone}।`;
    const selectors: Array<[RegExp, string[], string[]]> = [
        [/(?:delivery|shipping).*(?:charge|cost|fee|time)|(?:charge|cost|fee).*(?:delivery|shipping)|dhaka.*delivery|delivery.*dhaka|ডেলিভারি/i, ['DELIVERY'], ['delivery_charge','delivery_time','delivery']],
        [/\bcod\b|cash on delivery/i, ['PAYMENT'], ['cod']], [/payment method|pay(?:ment)? options?|bkash|nagad/i, ['PAYMENT'], ['payment']],
        [/return|exchange|refund|cancel|রিটার্ন|রিফান্ড/i, ['RETURN','REFUND','POLICY'], ['return','refund','cancellation']],
        [/address|location|office|ঠিকানা/i, ['LOCATION','CONTACT'], ['office','location','store_location']],
        [/opening hour|working hour|open today|কখন খোলা/i, ['HOURS'], ['hours']],
        [/fee|ফি|consultation charge|service charge/i, ['FEE','PRICING'], ['fee','consultancy_fee','pricing','fees','packages']],
        [/support|contact/i, ['SUPPORT','CONTACT'], ['support','contact']],
    ];
    const selected = selectors.find(([pattern]) => pattern.test(text)); if (!selected) return undefined;
    const type = String(business?.businessType || '');
    if (type) {
        const setupKeys = selected[2].flatMap((key) => [setupQuestionStorageKey(type as any, key), key]);
        const setupEntry = await Knowledge.findOne({ businessId, status: 'active', merchantConfirmed: true, factSource: 'BUSINESS_SETUP', businessType: type, setupQuestionKey: { $in: setupKeys } })
            .sort({ updatedAt: -1 }).select('content structuredValue').lean();
        const setupValue = setupEntry?.structuredValue ?? setupEntry?.content;
        const setupContent = Array.isArray(setupValue) ? setupValue.join(', ') : String(setupValue || '').replace(/\s+/g, ' ').trim();
        if (setupContent && setupContent.length <= 500) return setupContent;
    }
    const domains = selected[1];
    const titleTerms: Record<string, string> = { DELIVERY: 'delivery|shipping', PAYMENT: 'payment|cod|cash on delivery', LOCATION: 'address|location', CONTACT: 'contact|address', HOURS: 'opening|working hours', FEE: 'fee|charge', PRICING: 'pricing|fee' };
    const entry = await Knowledge.findOne({ businessId, status: 'active', merchantConfirmed: { $ne: false }, $or: [{ knowledgeDomain: { $in: domains } }, { title: { $regex: domains.map((domain) => titleTerms[domain]).filter(Boolean).join('|'), $options: 'i' } }] }).sort({ isPinned: -1, sourcePriority: 1 }).select('content').lean();
    const content = String(entry?.content || '').replace(/\s+/g, ' ').trim();
    return content && content.length <= 500 ? content : undefined;
}

const CATALOG_BROWSE_LIMIT = 5;
// Browse phrasing itself is not a search term: "what do you sell" must not be
// searched for as a product named "sell".
const BROWSE_FILLER = new Set(('what which kind type thing things stuff everything any you your our their and the for with '
    + 'sell sells selling have has having offer offers offering carry carries available inventory catalog catalogue '
    + 'collection collections menu range lists full complete entire please bolun bolen jinis jinish bikri bikroy bechen '
    + 'koren kore kichu kisu niye acche dhoroner dhorner ekhon ache ase '
    + 'আপনাদের আপনার তোমাদের আমাদের কাছে এখানে আছে দেখান দেখাও দেখতে চাই কালেকশন ক্যাটালগ জিনিস বিক্রি করেন কিছু ধরনের কোন').split(' '));


/**
 * Catalog browse ("ki ki product ache", "shob product list dekhan") is answered
 * from the merchant's live product collection, so a product added a minute ago
 * is listed on the very next customer turn — no retraining, no prompt edit, no
 * hardcoded catalog. Without this the turn carried no usable search term and the
 * generic product search answered "not available" for a full catalog.
 */
async function catalogBrowseResponse(businessId: string, text: string, language: string, lightweightMemory: Record<string, unknown>): Promise<DeterministicTurnResponse | null> {
    if (!catalogQueryable()) return null;
    const bn = language !== 'en';
    const budget = extractBudget(text);
    const terms = parseSearchTerms(text).filter((term) => term.length > 2 && !BROWSE_FILLER.has(term));
    const base: Record<string, any> = { businessId, isActive: true, merchantConfirmed: { $ne: false }, aiSellingStatus: { $ne: 'disabled' } };
    if (budget !== undefined) base.$or = [{ salePrice: { $lte: budget } }, { salePrice: null, basePrice: { $lte: budget } }];

    let filter: Record<string, any> = terms.length ? { ...base, $and: terms.slice(0, 3).map(termPredicate) } : base;
    let matched = await Product.find(filter).select(PRODUCT_CARD_FIELDS).limit(CATALOG_BROWSE_LIMIT * 3).lean().catch(() => []) as any[];
    const narrowed = Boolean(terms.length && matched.length);
    if (!matched.length && terms.length) {
        filter = base;
        matched = await Product.find(filter).select(PRODUCT_CARD_FIELDS).limit(CATALOG_BROWSE_LIMIT * 3).lean().catch(() => []) as any[];
    }

    if (!matched.length) {
        const offerings = await Offering.find({ businessId, status: 'active', merchantConfirmed: { $ne: false } }).select('name price salePrice currency offeringType').limit(CATALOG_BROWSE_LIMIT).lean().catch(() => []) as any[];
        if (offerings.length) {
            const lines = offerings.map((offering: any, index: number) => {
                const amount = offering.salePrice ?? offering.price;
                return `${index + 1}. ${offering.name}${typeof amount === 'number' ? ` - ${money(amount, String(offering.currency || 'BDT').toUpperCase())}` : ''}`;
            }).join('\n');
            const intro = say(language, {
                en: `Certainly - we currently offer ${offerings.length} service${offerings.length === 1 ? '' : 's'}:`,
                bn: `অবশ্যই—আমাদের এখন ${offerings.length}টি সার্ভিস আছে:`,
                banglish: `Obosshoi - amader ekhon ${offerings.length} ta service ache:`,
            });
            const close = say(language, {
                en: 'Tell me which one you need and I will gladly share the details.',
                bn: 'কোনটি সম্পর্কে জানতে চান বলুন, আমি বিস্তারিত জানিয়ে দিচ্ছি।',
                banglish: 'Kon ta niye jante chan bolun, ami details janiye dicchi.',
            });
            return { message_text: `${intro}\n${lines}\n${close}`, intent: 'CATALOG_BROWSE', memory: lightweightMemory };
        }
        const empty = say(language, {
            en: 'Apologies - no confirmed product is listed in our catalog right now. Tell me what you are looking for and our team will confirm it for you.',
            bn: 'দুঃখিত, এই মুহূর্তে আমাদের catalog-এ confirmed কোনো প্রোডাক্ট যোগ করা নেই। আপনি কী খুঁজছেন বলুন, আমাদের team confirm করে জানাবে।',
            banglish: 'Dukkhito, ekhon amader catalog-e confirmed kono product add kora nei. Apni ki khujchen bolun, team confirm kore janabe.',
        });
        return { message_text: empty, intent: 'CATALOG_BROWSE', memory: lightweightMemory };
    }

    const ordered = [...matched].sort((left: any, right: any) =>
        (Number(sellable(right)) - Number(sellable(left)))
        || (Number(Boolean(right.isFeatured)) - Number(Boolean(left.isFeatured)))
        || String(left.name || '').localeCompare(String(right.name || '')));
    const cards = ordered.slice(0, CATALOG_BROWSE_LIMIT).map((item: any) => card(item, ''));
    const counted = mongoose.connection.readyState === 1 ? await Product.countDocuments(filter).catch(() => matched.length) : matched.length;
    const total = Math.max(Number(counted) || 0, cards.length);

    const lines = cardLines(cards, language);

    const budgetLabel = budget === undefined ? '' : language === 'en' ? ` within ${money(budget, cards[0].currency)}` : bn ? ` ${money(budget, cards[0].currency)}-এর মধ্যে` : ` ${money(budget, cards[0].currency)} er moddhe`;
    const hasMore = total > cards.length;
    const intro = narrowed
        ? say(language, {
            en: `Certainly - ${total} product${total === 1 ? '' : 's'}${budgetLabel} match what you are looking for:`,
            bn: `অবশ্যই—আপনার চাহিদার সাথে মিলে এমন ${total}টি প্রোডাক্ট${budgetLabel} আছে:`,
            banglish: `Obosshoi - apnar chahida onujayi ${total} ta product${budgetLabel} ache:`,
        })
        : say(language, {
            en: `Certainly - we currently have ${total} product${total === 1 ? '' : 's'}${budgetLabel}${hasMore ? '. Here are a few' : ''}:`,
            bn: `অবশ্যই—আমাদের এখন ${total}টি প্রোডাক্ট${budgetLabel} আছে${hasMore ? '—এর মধ্যে কয়েকটি' : ''}:`,
            banglish: `Obosshoi - amader ekhon ${total} ta product${budgetLabel} ache${hasMore ? ' - er moddhe kichu' : ''}:`,
        });
    const more = hasMore
        ? say(language, {
            en: `\nPlus ${total - cards.length} more - tell me the type you need and I will narrow it down.`,
            bn: `\nআরও ${total - cards.length}টি আছে—কোন ধরনেরটি খুঁজছেন বললে আমি বেছে দেখাচ্ছি।`,
            banglish: `\nAro ${total - cards.length} ta ache - kon dhoroner ta khujchen bolle ami beche dekhacchi.`,
        })
        : '';
    const close = say(language, {
        en: '\nTell me the name or the code of the one you like and I will share full details or place the order.',
        bn: '\nকোনটি পছন্দ হয়েছে সেটির name বা code বললে আমি details জানিয়ে দেব বা order করে দেব।',
        banglish: '\nKon ta pochondo hoyeche setar name ba code bolle ami details janiye debo ba order kore debo.',
    });

    return {
        message_text: `${intro}\n${lines}${more}${close}`,
        suggested_products: cards,
        intent: 'CATALOG_BROWSE',
        memory: { ...lightweightMemory, recentProductIds: cards.map((item) => item.id) },
    };
}

interface DeterministicTurnContext {
    businessId: string;
    text: string;
    language: ConversationLanguage;
    intent: LightweightIntent;
    entity: Record<string, any>;
    lightweightMemory: Record<string, unknown>;
    explicitLanguage?: 'bn' | 'en' | 'banglish';
    customerReference?: DeterministicCustomerReference;
}

async function resolveDeterministicResponse(context: DeterministicTurnContext): Promise<string|DeterministicTurnResponse|null> {
    const { businessId, text, language, intent, entity, lightweightMemory, explicitLanguage, customerReference } = context;
    if (explicitLanguage) return { message_text: explicitLanguage === 'en' ? 'Sure — I’ll reply in English.' : explicitLanguage === 'bn' ? 'অবশ্যই—আমি বাংলায় উত্তর দেব।' : 'Thik ache—ami Banglish-e reply dibo.', intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    if (/\b(are you|r u)\s+(?:an?\s+)?(?:ai|bot|human)|তুমি কি (?:এআই|বট|মানুষ)|আপনি কি (?:এআই|বট|মানুষ)/i.test(text)) return { message_text: language === 'en' ? "I'm this business's automated SellPilot assistant." : 'আমি এই business-এর SellPilot automated assistant।', intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    if (/^(?:hi(?:\s+there)?|hello(?:\s+there)?|hey(?:\s+there)?|good\s+(?:morning|afternoon|evening)|assalamu\s+alaikum|assalamualaykum|assalamu['’]?alaikum|salam(?:(?:\s+bhai|\s+apu|\s+alaikum))?|kemon\s+achen\??|kemon\s+acho\??|ki\s+khobor\??|আসসালামু\s+আলাইকুম|সালাম|হ্যালো|হাই|কেমন\s+আছেন\??|কেমন\s+আছো\??|thanks?(?:\s+(?:you|u|a\s+lot|so\s+much))?|thank\s+(?:you|u)(?:\s+so\s+much)?|thx|many\s+thanks|ধন্যবাদ(?:\s+(?:আপনাকে|ভাই|আপু))?|অনেক\s+ধন্যবাদ)[!.\s]*$/i.test(text.trim())) {
        const business = await Business.findById(businessId).select('name brandVoice').lean();
        if (business?.brandVoice?.tone === 'custom' && (business.brandVoice.customTone || business.brandVoice.examples?.length)) return null;
        const thanks = /thank|ধন্যবাদ/i.test(text);
        return { message_text: thanks ? (language === 'en' ? "You're welcome!" : language === 'bn' ? 'আপনাকে স্বাগতম!' : 'Welcome!') : (language === 'en' ? `Hi! How can I help with ${business?.name || 'the business'}?` : language === 'bn' ? `হ্যালো! ${business?.name || 'এই ব্যবসা'} সম্পর্কে কী জানতে চান?` : `Hello! ${business?.name || 'ei business'} niye ki jante chan?`), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    }
    if (intent === 'ORDER_STATUS') {
        const orderMatch = text.match(/\border\s*#?\s*([a-z0-9-]{6,})\b/i);
        const query = orderMatch ? Order.findOne({ businessId, orderNumber: orderMatch[1].toUpperCase() }) : customerReference?.psid ? Order.findOne({ businessId, psid: customerReference.psid }).sort({ createdAt: -1 }) : null;
        const order = query ? await query.select('orderNumber status courier').lean() : null;
        if (order) return { message_text: formatOrderStatus(order), intent, memory: lightweightMemory };
    }
    if (intent === 'BUSINESS_FACT') { const fact = await stableBusinessFact(businessId, text, language); if (fact) return { message_text: fact, intent, memory: lightweightMemory }; }
    if (intent === 'CATALOG_BROWSE') { const browse = await catalogBrowseResponse(businessId, text, language, lightweightMemory); if (browse) return browse; }
    if (!['GENERAL_CONVERSATION','KNOWLEDGE','HUMAN_HANDOFF','ORDER_STATUS','BUSINESS_FACT','CATALOG_BROWSE'].includes(intent)) {
        // Conversational Memory: follow-up size inquiry on active product
        if (sizeInquiryRegex.test(text) && entity.activeProductId) {
            const active = await Product.findOne({ _id: entity.activeProductId, businessId, isActive: true, merchantConfirmed: { $ne: false } }).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images specs brand categoryId').lean();
            if (active) {
                const sizeSet = new Set<string>();
                for (const v of (active.variants || [])) {
                    if (v.isActive === false || v.availability === 'out_of_stock' || v.stock === 0) continue;
                    const vName = String(v.name || '').trim();
                    const tokenMatch = vName.match(/\b(S|M|L|XL|XXL|XXXL|Small|Medium|Large|Extra Large)\b/i);
                    if (tokenMatch) sizeSet.add(tokenMatch[0].toUpperCase());
                    else if (v.specs?.size) sizeSet.add(String(v.specs.size));
                    else if (vName) sizeSet.add(vName);
                }
                if (!sizeSet.size && active.specs?.sizes) {
                    const rawSizes = Array.isArray(active.specs.sizes) ? active.specs.sizes : [active.specs.sizes];
                    rawSizes.forEach((s: any) => sizeSet.add(String(s)));
                }
                const activeCard = card(active, text);
                if (sizeSet.size > 0) {
                    const sizeList = Array.from(sizeSet).join(', ');
                    const msg = say(language, {
                        en: `${active.name} (${activeCard.code}) is available in these sizes: ${sizeList}. Which one should I keep for you?`,
                        bn: `${active.name} (${activeCard.code})-এর available size: ${sizeList}। কোনটি রাখব বলুন।`,
                        banglish: `${active.name} (${activeCard.code})-er available size: ${sizeList}. Kon ta rakhbo bolun.`,
                    });
                    return { message_text: msg, suggested_products: [activeCard], intent: 'PRODUCT_VARIANT', memory: { ...lightweightMemory, activeProductId: String(active._id) } };
                }
                const msg = say(language, {
                    en: `${active.name} (${activeCard.code}) comes in one standard regular size.`,
                    bn: `${active.name} (${activeCard.code}) standard/regular size-এ আসে।`,
                    banglish: `${active.name} (${activeCard.code}) standard/regular size e ase.`,
                });
                return { message_text: msg, suggested_products: [activeCard], intent: 'PRODUCT_VARIANT', memory: { ...lightweightMemory, activeProductId: String(active._id) } };
            }
        }

        const rawTerms = parseSearchTerms(text);
        const colorWord = rawTerms.find((w) => COLOR_WORDS[w.toLowerCase()]);
        const requestedColor = colorWord ? COLOR_WORDS[colorWord.toLowerCase()] : undefined;
        const coreTerms = colorWord ? rawTerms.filter((w) => w.toLowerCase() !== colorWord.toLowerCase()) : rawTerms;

        const products = await findProducts(businessId, text, entity.activeProductId, entity.recentProductIds || []);
        if (products.length === 1 && products[0].aiSellingStatus === 'disabled') {
            return { message_text: say(language, {
                en: 'Sorry, this product is not available for order at the moment. I would be glad to show you what we do have.',
                bn: 'দুঃখিত, এই পণ্যটি এখন order নেওয়া যাচ্ছে না। চাইলে আমাদের available পণ্যগুলো দেখিয়ে দিতে পারি।',
                banglish: 'Dukkhito, ei product ta ekhon order neya jacche na. Chaile amader available product gulo dekhiye dite pari.',
            }), intent, memory: lightweightMemory };
        }

        const activeProducts = products.filter((item) => item.aiSellingStatus !== 'disabled');

        // STEP 1: Exact Match (with requested color variant if specified)
        if (requestedColor && activeProducts.length > 0) {
            const exactMatch = activeProducts.find((p) =>
                (p.variants || []).some((v: any) => v.isActive !== false && v.availability !== 'out_of_stock' && (typeof v.stock !== 'number' || v.stock > 0) && (String(v.name || '').toLowerCase().includes(requestedColor.toLowerCase()) || String(v.sku || '').toLowerCase().includes(requestedColor.toLowerCase())))
                || (String(p.name || '').toLowerCase().includes(requestedColor.toLowerCase()) && p.availability !== 'out_of_stock')
            );
            if (exactMatch) {
                const exactCard = card(exactMatch, text);
                const priceFormatted = money(exactCard.price, exactCard.currency);
                const msg = say(language, {
                    en: `Yes - ${exactMatch.name} in ${requestedColor} is in stock.\n${exactCard.name}, ${exactCard.code}, ${priceFormatted}\nShall I place the order for you?`,
                    bn: `জি, ${exactMatch.name}-এর ${requestedColor} available আছে।\n${exactCard.name}, ${exactCard.code}, ${priceFormatted}\nনিতে চাইলে বলবেন, আমি order-টা করে দিচ্ছি।`,
                    banglish: `Ji, ${exactMatch.name}-er ${requestedColor} available ache.\n${exactCard.name}, ${exactCard.code}, ${priceFormatted}\nNite chaile bolben, ami order ta kore dicchi.`,
                });
                return {
                    message_text: msg,
                    suggested_products: [exactCard],
                    intent: intent === 'PRODUCT_VARIANT' ? 'PRODUCT_VARIANT' : 'PRODUCT_STOCK',
                    memory: { ...lightweightMemory, activeProductId: String(exactMatch._id), recentProductIds: [String(exactMatch._id)] }
                };
            }
        }

        // The requested colour did not survive STEP 1, so it is unavailable on every
        // match. Offer another live variant of the same product instead of quoting the
        // sold-out one back to the customer.
        if (requestedColor && activeProducts.length) {
            const withAlternative = activeProducts.find((item) => availableVariant(item));
            if (withAlternative) {
                const alternative = variantAlternativeResponse(withAlternative, requestedColor, language, lightweightMemory);
                if (alternative) return alternative;
            }
        }

        const cards = activeProducts.map((item) => card(item, text)).slice(0, intent === 'PRODUCT_COMPARE' ? 4 : intent === 'PRODUCT_SEARCH' ? PRODUCT_SEARCH_LIMIT : 3);
        const exact = cards.length === 1 || Boolean(entity.activeProductId && String(cards[0]?.id) === String(entity.activeProductId));
        if (cards.length && (intent === 'PRODUCT_SEARCH' || (exact && ['PRODUCT_PRICE','PRODUCT_STOCK','PRODUCT_IMAGE','PRODUCT_VARIANT'].includes(intent)))) {
            return { message_text: productText(intent, cards, language, text), suggested_products: cards, intent, memory: { ...lightweightMemory, activeProductId: cards.length === 1 ? cards[0].id : entity.activeProductId, recentProductIds: cards.map((item) => item.id) } };
        }
        if (cards.length && ['PRODUCT_PRICE','PRODUCT_STOCK','PRODUCT_IMAGE','PRODUCT_VARIANT'].includes(intent)) {
            return { message_text: `${say(language, {
                en: 'I found a few close matches - which one did you mean?',
                bn: 'কয়েকটি কাছাকাছি option পেলাম—কোনটির কথা বলছেন?',
                banglish: 'Koyekta kachakachi option pelam - kon tar kotha bolchen?',
            })}\n${cardLines(cards, language)}`, suggested_products: cards, intent, memory: { ...lightweightMemory, recentProductIds: cards.map((item) => item.id) } };
        }

        // When no active products match directly:
        if (!activeProducts.length) {
            // Check non-commerce merchant
            const business = await getBusinessSafe(businessId);
            if (business?.businessType && business.businessType !== 'ECOMMERCE') {
                const physicalProductPattern = /\b(hoodie|hoodies|shirt|shirts|t-shirt|tshirts|panjabi|watch|shoe|shoes|pant|pants|dress|saree|sharee|jacket|clothing|পোশাক|জামা|হুডি|পাঞ্জাবি|ঘড়ি|জুতো)\b/i;
                if (physicalProductPattern.test(text) || ['PRODUCT_STOCK','PRODUCT_PRICE','PRODUCT_VARIANT','PRODUCT_IMAGE','PRODUCT_SEARCH'].includes(intent)) {
                    const offerings = await getOfferingsSafe(businessId);
                    const typeLabel = businessTypeLabel(business.businessType);
                    const serviceNames = (offerings || []).map((o: any) => o.name).join(', ');
                    const matchedWord = text.match(physicalProductPattern)?.[0] || (language === 'en' ? 'clothing' : 'পোশাক');
                    const msg = say(language, {
                        en: `Apologies - we do not carry ${matchedWord}. ${business.name || 'We'} is a ${typeLabel}, providing ${serviceNames || 'consultation and services'}. I would be glad to tell you about those.`,
                        bn: `দুঃখিত, আমাদের এখানে ${matchedWord} নেই। ${business.name || 'আমরা'} মূলত ${typeLabel} হিসেবে ${serviceNames || 'consultation ও সার্ভিস'} দিয়ে থাকি। এগুলো সম্পর্কে জানতে চাইলে বলবেন।`,
                        banglish: `Dukkhito, amader ekhane ${matchedWord} nei. ${business.name || 'Amra'} mulot ${typeLabel} hisebe ${serviceNames || 'consultation o service'} diye thaki. Egulo niye jante chaile bolben.`,
                    });
                    return { message_text: msg, intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
                }
            }

            // STEP 2: Same Product, Alternative Available Variant
            const isProductQueryable = mongoose.connection.readyState === 1 || Boolean((Product.find as any)?.mock);
            if (requestedColor && coreTerms.length > 0 && isProductQueryable) {
                const coreFilter = {
                    businessId,
                    isActive: true,
                    merchantConfirmed: { $ne: false },
                    $and: coreTerms.slice(0, 5).map((term) => {
                        const pattern = escaped(term);
                        return { $or: [
                            { name: { $regex: pattern, $options: 'i' } }, { brand: { $regex: pattern, $options: 'i' } },
                            { slug: { $regex: pattern, $options: 'i' } }, { aliases: { $regex: pattern, $options: 'i' } },
                            { description: { $regex: pattern, $options: 'i' } }, { 'variants.sku': { $regex: pattern, $options: 'i' } },
                            { 'variants.name': { $regex: pattern, $options: 'i' } },
                        ] };
                    })
                };
                const coreProducts = await Product.find(coreFilter).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images specs brand categoryId').limit(3).lean().catch(() => []);
                const sameProductWithAlt = (coreProducts || []).find((p: any) => p.aiSellingStatus !== 'disabled' && availableVariant(p));
                if (sameProductWithAlt) {
                    const alternative = variantAlternativeResponse(sameProductWithAlt, requestedColor, language, lightweightMemory);
                    if (alternative) return alternative;
                }
            }

            if (intent === 'PRODUCT_PRICE') {
                const terms = parseSearchTerms(text); const pattern = terms.map(escaped).join('.*');
                const offering = pattern ? await Offering.findOne({ businessId, status: 'active', merchantConfirmed: { $ne: false }, name: { $regex: pattern, $options: 'i' } }).select('name price salePrice currency availability offeringType').lean().catch(() => null) : entity.activeOfferingId ? await Offering.findOne({ _id: entity.activeOfferingId, businessId }).select('name price salePrice currency availability offeringType').lean().catch(() => null) : null;
                const amount = offering ? offering.salePrice ?? offering.price : undefined;
                if (offering && amount !== undefined) { const formatted = money(amount, offering.currency || 'BDT'); return { message_text: language === 'en' ? `${offering.name} is ${formatted}.` : `${offering.name}-এর fee ${formatted}।`, intent, memory: { ...lightweightMemory, activeOfferingId: String(offering._id), activeService: offering.name } }; }
                const fact = await stableBusinessFact(businessId, text, language);
                if (fact) return { message_text: fact, intent: 'BUSINESS_FACT', memory: lightweightMemory };
            }

            // STEP 3: Similar In-Stock Products Fallback
            if (rawTerms.length > 0 && isProductQueryable) {
                const similarProducts = await Product.find({
                    businessId,
                    isActive: true,
                    merchantConfirmed: { $ne: false },
                    aiSellingStatus: { $ne: 'disabled' },
                    availability: { $ne: 'out_of_stock' },
                    $or: [{ stock: null }, { stock: { $gt: 0 } }],
                }).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images specs brand categoryId').limit(3).lean().catch(() => []);

                if (similarProducts && similarProducts.length > 0) {
                    const similarCards = similarProducts.map((item: any) => card(item, text));
                    const termLabel = rawTerms.join(' ');
                    const msg = say(language, {
                        en: `Sorry, we do not have ${termLabel} at the moment. Here are some close options you may like:`,
                        bn: `দুঃখিত, ${termLabel} এই মুহূর্তে আমাদের কাছে নেই। কাছাকাছি কিছু option দিলাম—দেখতে পারেন:`,
                        banglish: `Dukkhito, ${termLabel} ei muhurte amader kache nei. Kachakachi kichu option dilam - dekhte paren:`,
                    });
                    const suggestionClose = say(language, {
                        en: '\nTell me the name or code of any one and I will share the details.',
                        bn: '\nযেকোনোটির name বা code বললে আমি details জানিয়ে দিচ্ছি।',
                        banglish: '\nJekono ekta-r name ba code bolle ami details janiye dicchi.',
                    });
                    return {
                        message_text: `${msg}\n${cardLines(similarCards, language)}${suggestionClose}`,
                        suggested_products: similarCards,
                        intent: 'PRODUCT_SEARCH',
                        memory: { ...lightweightMemory, recentProductIds: similarCards.map((c: any) => c.id) }
                    };
                }
            }

            // STEP 4: Polite Out of Stock
            if (rawTerms.length > 0) {
                const termLabel = rawTerms.join(' ');
                const msg = say(language, {
                    en: `Sorry, ${termLabel} is not in our catalog right now. If you tell me what you need it for, I will suggest the closest thing we have.`,
                    bn: `দুঃখিত, ${termLabel} এখন আমাদের catalog-এ নেই। কী প্রয়োজনে লাগবে বললে কাছাকাছি option বলে দিতে পারি।`,
                    banglish: `Dukkhito, ${termLabel} ekhon amader catalog e nei. Ki proyojone lagbe bolle kachakachi option bole dite pari.`,
                });
                return {
                    message_text: msg,
                    intent: 'PRODUCT_STOCK',
                    memory: lightweightMemory,
                };
            }

            return { message_text: say(language, {
                en: 'Happy to help - which product or service would you like to know about?',
                bn: 'অবশ্যই সাহায্য করব—কোন প্রোডাক্ট বা সার্ভিস সম্পর্কে জানতে চান বলুন।',
                banglish: 'Obosshoi help korbo - kon product ba service niye jante chan bolun.',
            }), intent, memory: lightweightMemory };
        }
    }
    if (!requestedSku(text) && /offer|discount|sale|price drop|অফার|ছাড়/i.test(text)) {
        const awareness = (await retrieveRelevantAwareness(businessId, text, 1))[0];
        if (awareness) {
            const target = awareness.targetReference || (awareness.targetType === 'ALL_PRODUCTS' ? 'selected products' : 'selected products');
            const claim = awareness.claimType === 'UP_TO_PERCENT' && Number.isFinite(Number(awareness.claimValue)) ? `up to ${Number(awareness.claimValue)}% discount` : 'a current offer';
            return { message_text: language === 'en' ? `${target} currently has ${claim}. Current catalog prices and stock still apply.` : `${target} collection-এ এখন ${claim} আছে। Current catalog price ও stock apply করবে।`, intent: 'BUSINESS_FACT', memory: lightweightMemory };
        }
    }
    return null;
}

export interface DeterministicCustomerReference {
    psid?: string;
    conversationId?: string;
    /** Inbound event id — used as the order idempotency key so a retried delivery cannot double-charge stock. */
    eventIdentifier?: string;
    /** Test AI sandbox turns must never create a real order or move stock. */
    sandbox?: boolean;
}

export async function getDeterministicResponse(businessId: string, text: string, customerReference?: DeterministicCustomerReference): Promise<string|DeterministicTurnResponse|null> {
    assertTenantBusinessId(businessId, 'deterministic-response');
    const conversation = customerReference?.conversationId
        ? await Conversation.findOne({ businessId, conversationId: customerReference.conversationId }).select('metadata customerId psid platform').lean()
        : null;
    const entity = conversation?.metadata?.entityState || {};
    const explicitLanguage = detectExplicitLanguagePreference(text);
    const language = resolveConversationLanguage(text, entity.preferredLanguage as ConversationLanguage | undefined);
    const intent = classifyLightweightIntent(text);
    const lightweightMemory = { ...extractLightweightMemory(text), preferredLanguage: language };

    // An explicit "bangla te bolen" is a language request, never an answer to the
    // checkout question in flight.
    if (explicitLanguage) {
        await setOrderDraftLanguage(businessId, customerReference?.conversationId, explicitLanguage);
        return resolveDeterministicResponse({ businessId, text, language, intent, entity, lightweightMemory, explicitLanguage, customerReference });
    }

    // Checkout owns the turn first: mid-order a customer's "Dhanmondi 32, Dhaka"
    // is an address, not a product search.
    const orderTurn = await handleOrderTurn({
        businessId,
        conversationId: customerReference?.conversationId,
        text,
        language,
        conversation,
        entity,
        lightweightMemory,
        eventIdentifier: customerReference?.eventIdentifier,
        sandbox: customerReference?.sandbox,
        resolveProducts: async (query: string) => {
            const matched = await findProducts(businessId, query, entity.activeProductId, entity.recentProductIds || []);
            if (matched.length) return matched;
            // "eita nibo" carries no searchable term — the product is whatever the
            // conversation was just about.
            const remembered = [entity.activeProductId, ...(entity.recentProductIds || [])].filter(Boolean).slice(0, 4);
            if (!remembered.length) return [];
            return Product.find({ businessId, _id: { $in: remembered }, isActive: true, merchantConfirmed: { $ne: false } }).select(PRODUCT_CARD_FIELDS).limit(4).lean();
        },
    });
    if (orderTurn) return orderTurn;

    const response = await resolveDeterministicResponse({ businessId, text, language, intent, entity, lightweightMemory, explicitLanguage, customerReference });
    // The customer detoured to another question mid-checkout — answer it, then
    // re-ask for exactly what the order still needs instead of dropping the flow.
    const pending = pendingOrderPrompt(conversation?.metadata, language);
    if (pending && response && typeof response !== 'string') {
        return { ...response, message_text: `${response.message_text}\n${pending}` };
    }
    return response;
}
