import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
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
import { handleOrderTurn, pendingOrderPrompt, phoneFrom, setOrderDraftLanguage } from './order-flow.service';
import { extractTurnMemory } from './conversation-memory.service';
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
const followupWords = /^(?:etar|etaar|eta|eita|eitar|oita|oitar|ei ta|oi ta|this|it|this one|ওটার|এটার|এটি|এইটার|ওইটা)?\s*(?:price|dam|দাম|koto|kot|kto|rate|taka|stock|available|availability|ache|ase|আছে|ছবি|picture|photo|image|pic|black|white|blue|red|size|sizes|সাইজ).{0,35}$/i;
const sizeInquiryRegex = /\b(size|sizes|সাইজ)\b/i;


const courierStatusLabels = {
    en: { pending: 'being prepared', confirmed: 'confirmed', packed: 'packed', submitted: 'handed to the courier', shipped: 'on its way', in_transit: 'on its way', delivered: 'delivered', completed: 'delivered', cancelled: 'cancelled', returned: 'returned', refunded: 'refunded', failed: 'held up at the courier', unknown: 'awaiting a confirmed update' },
    bn: { pending: 'প্রস্তুত করা হচ্ছে', confirmed: 'কনফার্ম করা হয়েছে', packed: 'প্যাক করা হয়েছে', submitted: 'কুরিয়ারে দেওয়া হয়েছে', shipped: 'পথে আছে', in_transit: 'পথে আছে', delivered: 'ডেলিভারি হয়ে গেছে', completed: 'ডেলিভারি হয়ে গেছে', cancelled: 'বাতিল হয়েছে', returned: 'ফেরত এসেছে', refunded: 'রিফান্ড হয়েছে', failed: 'কুরিয়ারে আটকে আছে', unknown: 'আপডেটের অপেক্ষায়' },
    banglish: { pending: 'prostut kora hocche', confirmed: 'confirm kora hoyeche', packed: 'pack kora hoyeche', submitted: 'courier e deya hoyeche', shipped: 'pothe ache', in_transit: 'pothe ache', delivered: 'delivery hoye geche', completed: 'delivery hoye geche', cancelled: 'batil hoyeche', returned: 'ferot eseche', refunded: 'refund hoyeche', failed: 'courier e atke ache', unknown: 'update er opekkhay' },
} as const;


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
/** What "eta" refers to later: the single product just discussed, with its code and price. */
function activeProductMemory(cards: CompactProductCard[], entity: Record<string, any>) {
    if (cards.length !== 1) return { activeProductId: entity.activeProductId };
    const [one] = cards;
    return { activeProductId: one.id, activeProductName: one.name, activeProductCode: one.code, activeProductPrice: one.price };
}

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
    if (intent === 'PRODUCT_PRICE' && one.availability === 'out_of_stock') {
        return say(language, {
            en: `${one.name} (${one.code}) is ${price}, but it is out of stock right now. I can show you a close alternative if you like.`,
            bn: `${one.name} (${one.code})-এর দাম ${price}, তবে এখন stock-এ নেই। চাইলে কাছাকাছি option দেখাতে পারি।`,
            banglish: `${one.name} (${one.code})-er price ${price}, tobe ekhon stock e nei. Chaile kachakachi option dekhate pari.`,
        });
    }
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
            : typeof one.stock === 'number' && one.stock > 0
              ? say(language, { en: `${one.stock} in stock.`, bn: `${one.stock}টি stock-এ আছে।`, banglish: `${one.stock} ta stock e ache.` })
              : '';
        if (one.availability === 'out_of_stock') {
            return say(language, {
                en: `${one.name} (${one.code}) is ${price}, but it is out of stock at the moment. Shall I show you the closest alternative?`,
                bn: `${one.name} (${one.code})-এর দাম ${price}, তবে এই মুহূর্তে stock-এ নেই। কাছাকাছি option দেখাব?`,
                banglish: `${one.name} (${one.code})-er price ${price}, tobe ei muhurte stock e nei. Kachakachi option dekhabo?`,
            });
        }
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

/**
 * The four objections that dominate Bangladeshi commerce chat. Each one is
 * acknowledged first, answered with something true from the catalog, and closed
 * with a way forward — never argued with, never answered by inventing a discount.
 */
const OBJECTIONS: Array<[string, RegExp]> = [
    ['PRICE', /\b(?:dam|daam)\s*(?:ta)?\s*(?:beshi|besi|onek|barti)\b|\bbeshi\s*dam\b|\bkom\s*(?:hobe|korun|koren|kora\s*jabe)\b|\bdiscount\b|\boffer\s*(?:ache|dao|den)\b|\bcheap\b|দাম.{0,12}(?:বেশি|কম)|কমানো\s*যাবে|ছাড়\s*(?:আছে|দিন)/i],
    ['COMPETITOR', /\bonno\s*(?:jaygay|page|shop|dokane)\b|\bother\s*(?:shop|page)\b|\bfacebook\s*e\s*kom\b|\bdaraz\b|অন্য\s*(?:জায়গায়|পেজে|দোকানে)/i],
    ['TRUST', /\bvejal\b|\bvejal\s*na\b|\bnokol\b|\bcopy\b|\bfake\b|\boriginal\s*(?:to|kina|naki)\b|\basol\b|\bquality\s*(?:valo|thik|kemon)\b|\bgenuine\b|ভেজাল|নকল|আসল\s*(?:তো|কিনা)|কোয়ালিটি/i],
    ['URGENCY', /\b(?:aj(?:ke)?|kal(?:ke)?|porshu|ekhoni|ajker\s*moddhe|urgent)\b.{0,18}\b(?:lagbe|dorkar|chai|pabo|dibe|delivery)\b|\b(?:lagbe|dorkar|chai|pabo)\b.{0,12}\b(?:aj(?:ke)?|kal(?:ke)?|ekhoni|urgent)\b|আজকে?.{0,14}(?:লাগবে|দরকার|পাবো)|কালকে?.{0,14}(?:লাগবে|দরকার|পাবো)/i],
];

async function objectionResponse(businessId: string, text: string, language: string, entity: Record<string, any>, lightweightMemory: Record<string, unknown>): Promise<DeterministicTurnResponse | null> {
    const matched = OBJECTIONS.find(([, pattern]) => pattern.test(text));
    if (!matched) return null;
    const [kind] = matched;

    const business = await getBusinessSafe(businessId) as any;
    const fees = business?.commerce?.deliveryFees || {};
    const active = entity.activeProductName
        ? { name: String(entity.activeProductName), code: entity.activeProductCode, price: entity.activeProductPrice }
        : undefined;
    const itemLabel = active ? `${active.name}${active.code ? ` (${active.code})` : ''}` : say(language, { en: 'this item', bn: 'এটি', banglish: 'eita' });

    if (kind === 'PRICE') {
        const live = (await retrieveRelevantAwareness(businessId, text, 1).catch(() => []))[0];
        if (live) {
            const claim = live.claimType === 'UP_TO_PERCENT' && Number.isFinite(Number(live.claimValue))
                ? `${Number(live.claimValue)}%`
                : '';
            const target = live.targetReference || say(language, { en: 'selected products', bn: 'নির্বাচিত কিছু প্রোডাক্টে', banglish: 'kichu product e' });
            const followUp = active
                ? say(language, {
                    en: ` Shall I check it for ${itemLabel}?`,
                    bn: ` ${itemLabel}-এর জন্য দেখে দেব?`,
                    banglish: ` ${itemLabel}-er jonno dekhe debo?`,
                })
                : say(language, {
                    en: ' Tell me which product you are interested in and I will check it for you.',
                    bn: ' কোন প্রোডাক্টটি নিয়ে আগ্রহী বলুন, আমি দেখে জানিয়ে দিচ্ছি।',
                    banglish: ' Kon product ta niye agrohi bolun, ami dekhe janiye dicchi.',
                });
            return { message_text: say(language, {
                en: `Good timing - ${target} currently has ${claim ? `up to ${claim} off` : 'a running offer'}. The catalog price and live stock still apply.${followUp}`,
                bn: `ভালো সময়ে বলেছেন—${target} এখন ${claim ? `${claim} পর্যন্ত ছাড়` : 'একটি অফার'} চলছে। Catalog দাম ও live stock প্রযোজ্য থাকবে।${followUp}`,
                banglish: `Valo somoye bolechen - ${target} ekhon ${claim ? `${claim} porjonto chhar` : 'ekta offer'} cholche. Catalog dam o live stock projojjo thakbe.${followUp}`,
            }), intent: 'BUSINESS_FACT', memory: lightweightMemory };
        }
        // No invented discounts: the listed price is the price, and the value is stated instead.
        return { message_text: say(language, {
            en: `I understand. ${itemLabel} is already at our listed price${active?.price ? ` of ${money(Number(active.price), 'BDT')}` : ''}, and it comes with cash on delivery so you only pay once it reaches you. If you tell me your budget, I will find the closest option we have.`,
            bn: `বুঝতে পারছি। ${itemLabel} আমাদের listed দামেই${active?.price ? ` (${money(Number(active.price), 'BDT')})` : ''} দেওয়া, আর ক্যাশ অন ডেলিভারি—হাতে পেয়ে তবেই টাকা দেবেন। আপনার বাজেট বললে সেই অনুযায়ী সবচেয়ে কাছের option বের করে দিচ্ছি।`,
            banglish: `Bujhte parchi. ${itemLabel} amader listed dame${active?.price ? ` (${money(Number(active.price), 'BDT')})` : ''} deya, ar cash on delivery - hate peye tarpor taka diben. Apnar budget bolle sei onujayi sobcheye kachher option ber kore dicchi.`,
        }), intent: 'BUSINESS_FACT', memory: lightweightMemory };
    }

    if (kind === 'COMPETITOR') {
        return { message_text: say(language, {
            en: `That is fair. What I can promise is what we control: the stock you see here is live, you pay on delivery, and if anything is wrong our team handles it directly. Tell me which one you were comparing and I will give you the exact price and stock.`,
            bn: `ঠিক আছে, বুঝতে পারছি। আমরা যেটা নিশ্চিত করতে পারি: এখানে যে stock দেখছেন সেটা live, টাকা দেবেন ডেলিভারির সময়, আর কোনো সমস্যা হলে আমাদের team সরাসরি দেখবে। কোনটার সাথে তুলনা করছেন বলুন, আমি exact দাম ও stock বলে দিচ্ছি।`,
            banglish: `Thik ache, bujhte parchi. Amra ja nishchit korte pari: ekhane je stock dekhchen seta live, taka diben delivery-r somoy, ar kono somossa hole amader team sorasori dekhbe. Kon tar sathe tulona korchen bolun, ami exact dam o stock bole dicchi.`,
        }), intent: 'BUSINESS_FACT', memory: lightweightMemory };
    }

    if (kind === 'TRUST') {
        return { message_text: say(language, {
            en: `A fair question. We list only what we actually stock, with the details on the product itself, and you pay only after the parcel reaches you. If anything does not match what I told you, tell us straight away and our team will sort it out.`,
            bn: `প্রশ্নটা যৌক্তিক। আমাদের কাছে যা সত্যিই stock-এ আছে সেটাই listing-এ থাকে, details প্রোডাক্টের সাথেই দেওয়া, আর টাকা দেবেন পার্সেল হাতে পাওয়ার পরেই। আমি যা বলেছি তার সাথে না মিললে সাথে সাথে জানাবেন, আমাদের team ব্যবস্থা নেবে।`,
            banglish: `Proshno ta jouktik. Amader kache ja sotti stock e ache seta-i listing e thake, details product er sathei deya, ar taka diben parcel hate pawar porei. Ami ja bolechi tar sathe na mille sathe sathe janaben, amader team bebostha nebe.`,
        }), intent: 'BUSINESS_FACT', memory: lightweightMemory };
    }

    // URGENCY — answer with the real delivery window, never a promise we cannot keep.
    const inside = Number(fees.insideDhaka ?? 80);
    const outside = Number(fees.outsideDhaka ?? 130);
    return { message_text: say(language, {
        en: `I will do my best. Inside Dhaka parcels usually reach in 1-2 days (delivery ${money(inside, 'BDT')}) and outside Dhaka in 2-4 days (delivery ${money(outside, 'BDT')}). Confirm the order today and I will send it to the courier straight away — tell me your area and I will give you the closest date we can hold to.`,
        bn: `আমি চেষ্টা করব। ঢাকার ভেতরে সাধারণত ১-২ দিনে পৌঁছায় (ডেলিভারি ${money(inside, 'BDT')}), ঢাকার বাইরে ২-৪ দিন (ডেলিভারি ${money(outside, 'BDT')})। আজ order confirm করলে সাথে সাথেই courier-এ দিয়ে দেব—আপনার এলাকা বললে সবচেয়ে কাছের সম্ভাব্য তারিখটা বলে দিচ্ছি।`,
        banglish: `Ami chesta korbo. Dhaka-r vitore sadharonoto 1-2 dine pouchay (delivery ${money(inside, 'BDT')}), Dhaka-r baire 2-4 din (delivery ${money(outside, 'BDT')}). Aj order confirm korle sathe sathei courier e diye debo - apnar elaka bolle sobcheye kachher shomvabbo tarikh ta bole dicchi.`,
    }), intent: 'BUSINESS_FACT', memory: lightweightMemory };
}

/** "apni ki AI?", "apnara ki bot?", "manush naki?" — in every script customers use. */
/**
 * "ok", "hmm", "accha", a lone emoji — the most frequent messages on Messenger and
 * the least worth a model call. Answered with one short line that keeps the door
 * open without nagging.
 */
/**
 * Courtesy turns — "ok", "thanks vai", "Okay vaiya thank you", "assalamu
 * alaikum bhai", "accha thik ache apu" — are the most common messages in a
 * Bangladeshi chat and the least worth a model call. Rather than enumerate every
 * combination, the message is tokenised: if every word is courtesy, it is a
 * courtesy turn, and the strongest signal present decides the reply.
 */
const COURTESY_PHRASES: Array<[RegExp, string]> = [
    [/\bwalaikum\s*(?:as)?salam\b|ওয়ালাইকুম\s*আসসালাম/gi, ' salaam '],
    [/\bassalamu?\s*(?:o\s*)?alaikum\b|assalamualaykum|আসসালামু\s*আলাইকুম/gi, ' salaam '],
    [/\bthank\s*(?:you|u)\b|\bmany\s*thanks\b/gi, ' thanks '],
    [/\bthik\s*(?:ache|ase)\b|ঠিক\s*আছে/gi, ' ack '],
    [/\bkemon\s*(?:achen|acho|ase)\b|কেমন\s*আছেন/gi, ' greeting '],
    [/\bki\s*khobor\b|কি\s*খবর/gi, ' greeting '],
    [/\bgood\s*(?:morning|afternoon|evening|night)\b/gi, ' greeting '],
];
const COURTESY_WORDS: Record<string, 'salaam' | 'thanks' | 'greeting' | 'ack' | 'honorific' | 'filler'> = {
    salaam: 'salaam', salam: 'salaam', সালাম: 'salaam',
    thanks: 'thanks', thank: 'thanks', thnx: 'thanks', thx: 'thanks', tnx: 'thanks', shukriya: 'thanks',
    dhonnobad: 'thanks', dhonyobad: 'thanks', ধন্যবাদ: 'thanks',
    hi: 'greeting', hello: 'greeting', hey: 'greeting', greeting: 'greeting', হ্যালো: 'greeting', হাই: 'greeting',
    ok: 'ack', okay: 'ack', okk: 'ack', okey: 'ack', k: 'ack', hmm: 'ack', hm: 'ack', hmmm: 'ack',
    acha: 'ack', accha: 'ack', achcha: 'ack', ack: 'ack', ji: 'ack', jee: 'ack', hae: 'ack', ha: 'ack', haa: 'ack',
    yes: 'ack', yeah: 'ack', right: 'ack', done: 'ack', fine: 'ack', bujhlam: 'ack', bujhechi: 'ack',
    nice: 'ack', great: 'ack', good: 'ack', shundor: 'ack', sundor: 'ack',
    আচ্ছা: 'ack', হুম: 'ack', জি: 'ack', হ্যাঁ: 'ack', ভালো: 'ack', সুন্দর: 'ack',
    vai: 'honorific', vaia: 'honorific', vaiya: 'honorific', bhai: 'honorific', bhaiya: 'honorific', bhaiyya: 'honorific',
    apu: 'honorific', apa: 'honorific', apuni: 'honorific', bro: 'honorific', brother: 'honorific',
    sir: 'honorific', madam: 'honorific', dada: 'honorific', ভাই: 'honorific', ভাইয়া: 'honorific', আপু: 'honorific', স্যার: 'honorific',
    you: 'filler', u: 'filler', a: 'filler', lot: 'filler', so: 'filler', much: 'filler', very: 'filler',
    amar: 'filler', apnake: 'filler', onek: 'filler', আপনাকে: 'filler', অনেক: 'filler',
};

/** The kind of courtesy this message is, or nothing if it says something else too. */
export function classifyCourtesy(text: string): 'salaam' | 'thanks' | 'greeting' | 'ack' | undefined {
    let normalized = ` ${text.toLowerCase()} `;
    for (const [pattern, token] of COURTESY_PHRASES) normalized = normalized.replace(pattern, token);
    const words = normalized.split(/[^a-zঀ-৿]+/i).filter(Boolean);
    if (!words.length) return undefined;
    const kinds = words.map((word) => COURTESY_WORDS[word]);
    if (kinds.some((kind) => !kind)) return undefined;   // something real was said too
    if (kinds.includes('salaam')) return 'salaam';
    if (kinds.includes('thanks')) return 'thanks';
    if (kinds.includes('greeting')) return 'greeting';
    return kinds.includes('ack') ? 'ack' : undefined;
}

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s‍]+$/u;
/** "pore dekhbo", "ekhon na", "bye" — a polite close, not a dead end. */
const SIGN_OFF = /^(?:pore\s*(?:dekhbo|kotha\s*hobe|janabo)|ekhon\s*na|ekhon\s*lagbe\s*na|kichu\s*na|bye|byee|allah\s*hafez|khoda\s*hafez|tata|later|আপাতত\s*না|পরে\s*দেখব|এখন\s*না|বিদায়|আল্লাহ\s*হাফেজ)[\s!.।]*$/i;

const IDENTITY_QUESTION = /\b(?:are|r)\s*(?:you|u)\s*(?:an?\s*)?(?:ai|a\.i\.?|bot|robot|human|machine|real\s*person)\b|\b(?:apni|apnara|tumi|tomra)\s*(?:ki|kii)\s*(?:ekta\s*)?(?:ai|a\.i\.?|bot|robot|manush|human)\b|\b(?:ai|bot|robot|manush)\s*(?:naki|na\s*ki)\b|\bkotha\s*bolche\s*(?:ke|kew)\b|(?:আপনি|আপনারা|তুমি|তোমরা)\s*কি\s*(?:একটা\s*)?(?:এআই|এ\s*আই|বট|রোবট|মানুষ)|(?:এআই|বট|রোবট|মানুষ)\s*নাকি/i;

/** An order number wherever it appears: quoted alone, after "order", or with a hash. */
export function orderNumberFrom(text: string) {
    const direct = text.match(/\bORD[-_ ]?([A-Z0-9][A-Z0-9-]{3,})\b/i);
    if (direct) return `ORD-${direct[1].replace(/[_ ]/g, '-')}`.toUpperCase();
    const labelled = text.match(/\border\s*(?:id|no\.?|number|#)?\s*[:#-]?\s*([a-z0-9][a-z0-9-]{4,})\b/i)?.[1]
        || text.match(/#\s*([a-z0-9][a-z0-9-]{4,})\b/i)?.[1];
    // "amar order status ta ki?" — the word after "order" is not an order number
    // unless it actually looks like one.
    return labelled && /\d/.test(labelled) ? labelled.toUpperCase() : undefined;
}

/**
 * Every order-status turn is answered here, so none of them reaches the model:
 * a quoted number, the number we remember from this conversation, or the
 * customer's latest order — and a clear ask when we genuinely cannot tell.
 */
async function orderStatusResponse(
    businessId: string,
    text: string,
    language: string,
    entity: Record<string, any>,
    lightweightMemory: Record<string, unknown>,
    customerReference?: DeterministicCustomerReference,
): Promise<DeterministicTurnResponse | null> {
    const quoted = orderNumberFrom(text);

    // A Test AI rehearsal never created a real order; say so instead of hunting for it.
    if (quoted && /^ORD-SANDBOX/i.test(quoted)) {
        return { message_text: say(language, {
            en: `${quoted} came from a test-mode rehearsal, so no real order exists for it. Place the order again outside test mode and I will track it for you.`,
            bn: `${quoted} টেস্ট মোডের একটি রিহার্সাল—এর বিপরীতে আসল কোনো অর্ডার তৈরি হয়নি। টেস্ট মোডের বাইরে অর্ডারটি করলে আমি ট্র্যাক করে জানাব।`,
            banglish: `${quoted} test mode-er ekta rehearsal - er biporite asol kono order toiri hoyni. Test mode-er baire order ta korle ami track kore janabo.`,
        }), intent: 'ORDER_STATUS', memory: lightweightMemory };
    }

    if (!orderQueryable()) return null;
    const remembered = !quoted && typeof entity.lastOrderNumber === 'string' ? String(entity.lastOrderNumber) : undefined;
    const wanted = quoted || remembered;
    // "number: 01632149759" — the mobile number is how most customers identify
    // their order, so it is looked up here instead of costing a model call.
    const phone = !wanted ? phoneFrom(text) : undefined;

    const order = wanted
        ? await Order.findOne({ businessId, orderNumber: wanted }).select('orderNumber status courier createdAt').lean().catch(() => null) as any
        : phone
          ? await orderByPhone(businessId, phone)
          : customerReference?.psid
            ? await Order.findOne({ businessId, psid: customerReference.psid }).sort({ createdAt: -1 }).select('orderNumber status courier createdAt').lean().catch(() => null) as any
            : null;

    if (order) {
        return { message_text: formatOrderStatus(order, language), intent: 'ORDER_STATUS', memory: { ...lightweightMemory, lastOrderNumber: order.orderNumber, awaitingOrderLookup: false } };
    }

    if (phone) {
        return { message_text: say(language, {
            en: `I could not find an order placed with ${phone}. Could you check the number, or send the Order ID (it looks like ORD-XXXXX-XXXX)?`,
            bn: `${phone} দিয়ে করা কোনো অর্ডার পেলাম না। নম্বরটি একবার দেখবেন, নাকি Order ID (ORD-XXXXX-XXXX এমন) দেবেন?`,
            banglish: `${phone} diye kora kono order pelam na. Number ta ekbar dekhben, naki Order ID (ORD-XXXXX-XXXX emon) diben?`,
        }), intent: 'ORDER_STATUS', memory: { ...lightweightMemory, awaitingOrderLookup: true } };
    }

    if (quoted) {
        return { message_text: say(language, {
            en: `I could not find an order with the number ${quoted}. Could you check it once, or send the mobile number you ordered with? I will look it up straight away.`,
            bn: `${quoted} নম্বরের কোনো অর্ডার খুঁজে পেলাম না। নম্বরটি একবার দেখে বলবেন, বা যে মোবাইল নম্বর দিয়ে অর্ডার করেছিলেন সেটি দিন—আমি সাথে সাথে দেখে জানাচ্ছি।`,
            banglish: `${quoted} number-er kono order khuje pelam na. Number ta ekbar dekhe bolben, ba je mobile number diye order korechilen seta din - ami sathe sathe dekhe janachchi.`,
        }), intent: 'ORDER_STATUS', memory: { ...lightweightMemory, awaitingOrderLookup: true } };
    }

    return { message_text: say(language, {
        en: 'Happy to check that for you. Could you send the Order ID (it looks like ORD-XXXXX-XXXX), or the mobile number you ordered with?',
        bn: 'অবশ্যই দেখে দিচ্ছি। Order ID টি (ORD-XXXXX-XXXX এমন) বা যে মোবাইল নম্বর দিয়ে অর্ডার করেছিলেন সেটি দেবেন প্লিজ?',
        banglish: 'Obosshoi dekhe dicchi. Order ID ta (ORD-XXXXX-XXXX emon) ba je mobile number diye order korechilen seta diben please?',
    }), intent: 'ORDER_STATUS', memory: { ...lightweightMemory, awaitingOrderLookup: true } };
}

/** The customer's latest order, found from the mobile number they ordered with. */
async function orderByPhone(businessId: string, phone: string) {
    const byAddress = await Order.findOne({ businessId, 'shippingAddress.phone': phone })
        .sort({ createdAt: -1 }).select('orderNumber status courier createdAt').lean().catch(() => null) as any;
    if (byAddress) return byAddress;
    const customer = await Customer.findOne({ businessId, phone }).select('_id').lean().catch(() => null) as any;
    if (!customer) return null;
    return await Order.findOne({ businessId, customerId: customer._id })
        .sort({ createdAt: -1 }).select('orderNumber status courier createdAt').lean().catch(() => null) as any;
}

function orderQueryable() {
    return mongoose.connection.readyState === 1 || Boolean((Order.findOne as any)?.mock);
}

function formatOrderStatus(order: any, language: string) {
    const stage = order.courier?.status ? String(order.courier.status) : String(order.status || 'pending');
    const label = say(language, {
        en: (courierStatusLabels.en as any)[stage] || courierStatusLabels.en.unknown,
        bn: (courierStatusLabels.bn as any)[stage] || courierStatusLabels.bn.unknown,
        banglish: (courierStatusLabels.banglish as any)[stage] || courierStatusLabels.banglish.unknown,
    });
    const tracking = order.courier?.trackingCode
        ? say(language, {
            en: ` Tracking code: ${order.courier.trackingCode}.`,
            bn: ` ট্র্যাকিং কোড: ${order.courier.trackingCode}।`,
            banglish: ` Tracking code: ${order.courier.trackingCode}.`,
        })
        : '';
    const closing = say(language, {
        en: ' If anything looks wrong, tell me and I will have the team check it.',
        bn: ' কোনো সমস্যা মনে হলে বলবেন, আমি team-কে দিয়ে দেখিয়ে নেব।',
        banglish: ' Kono somossa mone hole bolben, ami team ke diye dekhiye nebo.',
    });
    return say(language, {
        en: `Order ${order.orderNumber} is ${label}.${tracking}${closing}`,
        bn: `আপনার অর্ডার ${order.orderNumber} এখন ${label}।${tracking}${closing}`,
        banglish: `Apnar order ${order.orderNumber} ekhon ${label}.${tracking}${closing}`,
    });
}

async function findProducts(businessId: string, text: string, activeProductId?: string, recentProductIds: string[] = []) {
    const intent = classifyLightweightIntent(text);
    const sku = requestedSku(text);
    if (sku) {
        const exactSkuProduct = await Product.findOne({ businessId, isActive: true, merchantConfirmed: { $ne: false }, $or: [{ slug: sku.toLowerCase() }, { 'variants.sku': sku }, { publicCode: sku.toUpperCase() }, { barcode: sku }] }).select(PRODUCT_CARD_FIELDS).lean();
        if (exactSkuProduct) return [exactSkuProduct];
    }
    // "eta koto?" three turns later still means the product we last quoted.
    if (activeProductId && (followupWords.test(text.trim()) || ['PRODUCT_IMAGE','PRODUCT_STOCK','PRODUCT_VARIANT','PRODUCT_PRICE'].includes(intent))) {
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
    const business = existingBusiness || await Business.findById(businessId).select('phone businessType commerce').lean() as any;
    const commerce = business?.commerce || {};

    if (/\b(?:support|contact|phone|mobile|whatsapp)\s*(?:number|no\b)|\bnumber\s*(?:ta|ti)?\s*(?:den|din|deo|dao|chai)\b|ফোন\s*নাম্বার|নাম্বার/i.test(text) && business?.phone) return language === 'en' ? `You can contact us at ${business.phone}.` : `যোগাযোগের number: ${business.phone}।`;
    const selectors: Array<[RegExp, string[], string[]]> = [
        [/(?:delivery|shipping).*(?:charge|cost|fee|time)|(?:charge|cost|fee).*(?:delivery|shipping)|dhaka.*delivery|delivery.*dhaka|ডেলিভারি/i, ['DELIVERY'], ['delivery_charge','delivery_time','delivery']],
        [/\bcod\b|cash on delivery/i, ['PAYMENT'], ['cod']], [/payment|pay(?:ment)? options?|bkash|bikash|nagad|rocket|upay|ক্যাশ|বিকাশ|নগদ/i, ['PAYMENT'], ['payment']],
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
    if (content && content.length <= 500) return content;

    // Nothing confirmed by the merchant: answer from the same commerce settings the
    // checkout charges from, so the quote and the answer can never disagree.
    if (/\b(?:delivery|shipping)\b.{0,20}\b(?:charge|cost|fee|koto|kotodin|koydin|somoy|time)\b|\b(?:charge|cost|fee)\b.{0,20}\b(?:delivery|shipping)\b|ডেলিভারি.{0,12}(?:চার্জ|খরচ|কত|কতদিন|সময়)/i.test(text)) {
        const inside = Number(commerce?.deliveryFees?.insideDhaka ?? 80);
        const outside = Number(commerce?.deliveryFees?.outsideDhaka ?? 130);
        return say(language, {
            en: `Delivery is ${money(inside, 'BDT')} inside Dhaka and ${money(outside, 'BDT')} outside Dhaka, usually 1-2 days in Dhaka and 2-4 days elsewhere. Tell me your area and I will confirm it exactly.`,
            bn: `ডেলিভারি চার্জ ঢাকার ভেতরে ${money(inside, 'BDT')}, ঢাকার বাইরে ${money(outside, 'BDT')}—ঢাকায় সাধারণত ১-২ দিন, বাইরে ২-৪ দিন। আপনার এলাকা বললে নিশ্চিত করে বলে দিচ্ছি।`,
            banglish: `Delivery charge Dhaka-r vitore ${money(inside, 'BDT')}, baire ${money(outside, 'BDT')} - Dhaka-y sadharonoto 1-2 din, baire 2-4 din. Apnar elaka bolle nishchit kore bole dicchi.`,
        });
    }
    if (/\b(?:bkash|bikash|nagad|rocket|upay|cod|cash on delivery|payment|advance)\b|বিকাশ|নগদ|রকেট|পেমেন্ট|ক্যাশ অন ডেলিভারি/i.test(text)) {
        const methods = (commerce?.paymentMethods || []).filter(Boolean);
        const list = methods.length ? methods.join(', ') : 'Cash on Delivery';
        const cod = /cash on delivery|cod/i.test(list);
        return say(language, {
            en: `We accept ${list}.${cod ? ' With cash on delivery you pay only when the parcel reaches you.' : ''} Shall I place the order for you?`,
            bn: `আমরা ${list} নিই।${cod ? ' ক্যাশ অন ডেলিভারিতে পার্সেল হাতে পাওয়ার পরেই টাকা দেবেন।' : ''} অর্ডারটি করে দেব?`,
            banglish: `Amra ${list} nii.${cod ? ' Cash on delivery te parcel hate pawar porei taka diben.' : ''} Order ta kore debo?`,
        });
    }
    return undefined;
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
        // A browse that lands on one product makes it the product "eta" refers to next.
        memory: { ...lightweightMemory, ...activeProductMemory(cards, {}), recentProductIds: cards.map((item) => item.id) },
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
    if (IDENTITY_QUESTION.test(text)) {
        return { message_text: say(language, {
            en: "I am this shop's automated assistant - I can check prices, stock and place your order right away. A colleague joins in whenever you need one.",
            bn: 'আমি এই দোকানের automated assistant—দাম, stock দেখে অর্ডারটাও করে দিতে পারি। প্রয়োজনে আমাদের একজন প্রতিনিধিও যুক্ত হবেন।',
            banglish: 'Ami ei shop-er automated assistant - dam, stock dekhe order tao kore dite pari. Proyojone amader ekjon representative-o jukto hoben.',
        }), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    }
    const courtesy = classifyCourtesy(text);
    if (courtesy) {
        const business = await Business.findById(businessId).select('name brandVoice').lean();
        // A merchant who wrote their own greeting voice gets to use it.
        if ((courtesy === 'greeting' || courtesy === 'salaam')
            && business?.brandVoice?.tone === 'custom'
            && (business.brandVoice.customTone || business.brandVoice.examples?.length)) return null;

        const shop = business?.name || say(language, { en: 'us', bn: 'আমাদের', banglish: 'amader' });
        if (courtesy === 'thanks') {
            return { message_text: say(language, {
                en: 'You are most welcome. If you need anything else, I am right here.',
                bn: 'আপনাকেও ধন্যবাদ! আর কিছু লাগলে নির্দ্বিধায় বলবেন, আমি আছি।',
                banglish: 'Apnake-o dhonnobad! Ar kichu lagle nirdhidhay bolben, ami achi.',
            }), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
        }
        if (courtesy === 'ack') {
            const viewing = typeof entity.activeProductName === 'string' ? String(entity.activeProductName) : undefined;
            return { message_text: viewing
                ? say(language, {
                    en: `Of course. Tell me whenever you want ${viewing}, and I will place the order for you.`,
                    bn: `জি। ${viewing} নিতে চাইলে বলবেন, আমি অর্ডারটি করে দেব।`,
                    banglish: `Ji. ${viewing} nite chaile bolben, ami order ta kore debo.`,
                })
                : say(language, {
                    en: 'Of course. Tell me what you are looking for and I will find it for you.',
                    bn: 'জি। কী খুঁজছেন বলুন, আমি বের করে দিচ্ছি।',
                    banglish: 'Ji. Ki khujchen bolun, ami ber kore dicchi.',
                }), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
        }
        // A salaam is returned in kind, whatever script it arrived in.
        const opening = courtesy === 'salaam'
            ? say(language, { en: 'Walaikum assalam! ', bn: 'ওয়ালাইকুম আসসালাম! ', banglish: 'Walaikum assalam! ' })
            : '';
        return { message_text: opening + say(language, {
            en: `Welcome to ${shop}. What are you looking for today? I am happy to help you find it.`,
            bn: `${shop}-এ স্বাগতম। আজ কী খুঁজছেন বলুন, আমি খুঁজে দিতে সাহায্য করছি।`,
            banglish: `${shop}-e swagotom. Aj ki khujchen bolun, ami khuje dite help korchi.`,
        }), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    }

    if (SIGN_OFF.test(text.trim())) {
        return { message_text: say(language, {
            en: 'Of course - whenever you are ready, I am right here. Have a good day.',
            bn: 'অবশ্যই—যেকোনো সময় বলবেন, আমি আছি। ভালো থাকবেন।',
            banglish: 'Obosshoi - jekono somoy bolben, ami achi. Valo thakben.',
        }), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    }

    if (EMOJI_ONLY.test(text.trim())) {
        const viewing = typeof entity.activeProductName === 'string' ? String(entity.activeProductName) : undefined;
        return { message_text: viewing
            ? say(language, {
                en: `Of course. Tell me whenever you want ${viewing}, and I will place the order for you.`,
                bn: `জি। ${viewing} নিতে চাইলে বলবেন, আমি অর্ডারটি করে দেব।`,
                banglish: `Ji. ${viewing} nite chaile bolben, ami order ta kore debo.`,
            })
            : say(language, {
                en: 'Of course. Tell me what you are looking for and I will find it for you.',
                bn: 'জি। কী খুঁজছেন বলুন, আমি বের করে দিচ্ছি।',
                banglish: 'Ji. Ki khujchen bolun, ami ber kore dicchi.',
            }), intent: 'GENERAL_CONVERSATION', memory: lightweightMemory };
    }

    // A message that is essentially just a mobile number is the customer
    // identifying their order, whether or not we asked for it a moment ago.
    const carriesPhone = Boolean(phoneFrom(text));
    const barePhoneMessage = carriesPhone && text
        .replace(/(?<!\d)(?:\+?88)?0?1\d{6,9}(?!\d)/, ' ')
        .replace(/(?:number|mobile|phone|amar|my|is|ta|ei|no|nong|নম্বর|মোবাইল|আমার)/gi, ' ')
        .replace(/[^a-zঀ-৿]/gi, '').length <= 6;
    const answeringOrderLookup = (Boolean(entity.awaitingOrderLookup) || barePhoneMessage) && (carriesPhone || Boolean(orderNumberFrom(text)));
    if (intent === 'ORDER_STATUS' || answeringOrderLookup) {
        const answered = await orderStatusResponse(businessId, text, language, entity, lightweightMemory, customerReference);
        if (answered) return answered;
    }

    // "dam beshi", "onno jaygay kom", "vejal na to", "kalke lagbe" are objections,
    // not product names — answering them as a search echoes them back as missing
    // products and loses the sale.
    const objection = await objectionResponse(businessId, text, language, entity, lightweightMemory);
    if (objection) return objection;

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
            return { message_text: productText(intent, cards, language, text), suggested_products: cards, intent, memory: { ...lightweightMemory, ...activeProductMemory(cards, entity), recentProductIds: cards.map((item) => item.id) } };
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
    // Facts the customer states once must outlive the model's short message window.
    const lightweightMemory = { ...extractLightweightMemory(text), ...extractTurnMemory(text), preferredLanguage: language };

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
