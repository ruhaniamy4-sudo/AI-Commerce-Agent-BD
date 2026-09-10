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

export interface CompactProductCard { id: string; sku?: string; name: string; price: number; currency: string; salePrice?: number; availability: string; stock?: number | null; image?: string; relevantVariant?: { id: string; name: string; price: number; currency: string; availability: string; stock?: number | null; image?: string }; }
export interface DeterministicTurnResponse { message_text: string; suggested_products?: CompactProductCard[]; intent: LightweightIntent; memory?: Record<string, unknown>; }

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

const COLOR_WORDS: Record<string, string> = {
    'black': 'Black', 'kalo': 'Black', 'কালো': 'Black',
    'white': 'White', 'shada': 'White', 'সাদা': 'White',
    'blue': 'Blue', 'nil': 'Blue', 'neel': 'Blue', 'নীল': 'Blue',
    'navy': 'Navy', 'red': 'Red', 'lal': 'Red', 'লাল': 'Red',
    'green': 'Green', 'sobuj': 'Green', 'সবুজ': 'Green',
    'yellow': 'Yellow', 'holud': 'Yellow', 'হলুদ': 'Yellow',
    'grey': 'Grey', 'gray': 'Grey', 'dhusor': 'Grey', 'ধূসর': 'Grey',
    'maroon': 'Maroon', 'মেরুন': 'Maroon',
    'pink': 'Pink', 'golapi': 'Pink', 'গোলাপি': 'Pink',
    'purple': 'Purple', 'beguni': 'Purple', 'বেগুনি': 'Purple',
    'orange': 'Orange', 'komla': 'Orange', 'কমলা': 'Orange',
    'brown': 'Brown', 'badami': 'Brown', 'বাদামি': 'Brown',
    'olive': 'Olive', 'beige': 'Beige',
};

const courierStatusLabels: Record<string, string> = { pending: 'pending courier processing', submitted: 'submitted to Steadfast', in_transit: 'in transit', delivered: 'delivered', cancelled: 'cancelled', returned: 'returned', failed: 'affected by a courier processing issue', unknown: 'awaiting a confirmed courier update' };

function escaped(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function requestedSku(text: string) {
    const explicit = text.match(/\bsku\s*[:#-]?\s*([a-z0-9-]{3,})\b/i)?.[1];
    if (explicit) return explicit;
    const adjacent = text.match(/\b(?:stock|price)\s+([a-z0-9-]{3,})\b/i)?.[1];
    return adjacent && /\d/.test(adjacent) && /-/.test(adjacent) ? adjacent : undefined;
}
function money(amount: number, currency: string) { const symbol = ({ BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹' } as Record<string, string>)[currency]; return symbol ? `${symbol}${amount}` : `${currency} ${amount}`; }
function card(product: any, text = ''): CompactProductCard {
    const terms = parseSearchTerms(text);
    const colorWord = terms.find((word) => COLOR_WORDS[word.toLowerCase()]);
    const color = colorWord ? COLOR_WORDS[colorWord.toLowerCase()].toLowerCase() : undefined;
    const sku = requestedSku(text);
    const variant = sku
        ? (product.variants || []).find((item: any) => String(item.sku).toLowerCase() === sku.toLowerCase())
        : color ? (product.variants || []).find((item: any) => String(item.name || '').toLowerCase().includes(color) || String(item.sku || '').toLowerCase().includes(color)) : undefined;
    const availability = product.aiSellingStatus==='limited' ? (typeof (variant?variant.stock:product.stock)==='number'?((variant?variant.stock:product.stock)>0?'in_stock':'out_of_stock'):'unknown') : variant ? (variant.availability || (typeof variant.stock === 'number' ? (variant.stock > 0 ? 'in_stock' : 'out_of_stock') : 'unknown')) : (product.availability || (typeof product.stock === 'number' ? (product.stock > 0 ? 'in_stock' : 'out_of_stock') : 'unknown'));
    const currency = String(variant?.currency || product.currency || 'BDT').toUpperCase();
    return { id: String(product._id), sku: variant?.sku || product.variants?.[0]?.sku, name: product.name, price: product.salePrice ?? variant?.price ?? product.basePrice, currency, salePrice: product.salePrice, availability, stock: variant ? variant.stock : product.stock, image: variant?.images?.[0] || product.images?.[0], relevantVariant: variant ? { id: variant.variantId, name: variant.name, price: product.salePrice ?? variant.price, currency, availability, stock: variant.stock, image: variant.images?.[0] } : undefined };
}

function productText(intent: LightweightIntent, cards: CompactProductCard[], language: string, text = '') {
    const one = cards[0]; const bn = language !== 'en';
    if (intent === 'PRODUCT_IMAGE') return one.image
        ? (bn ? `${one.name}-এর ছবি দিলাম।` : `Here is ${one.name}.`)
        : (bn ? `${one.name}-এর confirmed ছবি এখনো যোগ করা হয়নি।` : `A confirmed image for ${one.name} has not been added yet.`);
    if (intent === 'PRODUCT_PRICE') {
        const stock = requestedSku(text) && typeof one.stock === 'number' ? (bn ? ` এখন ${one.stock}টা available আছে।` : ` It currently has ${one.stock} in stock.`) : '';
        return bn ? `${one.name}-এর price ${money(one.price, one.currency)}।${stock}` : `${one.name} is ${money(one.price, one.currency)}.${stock}`;
    }
    if (intent === 'PRODUCT_STOCK') {
        if (one.availability === 'out_of_stock') return bn ? `${one.name} এখন out of stock।` : `${one.name} is currently out of stock.`;
        if (one.availability === 'preorder') return bn ? `${one.name} preorder করা যাচ্ছে।` : `${one.name} is available for preorder.`;
        if (one.availability === 'in_stock' && typeof one.stock === 'number') return bn ? `জি, ${one.name} এখন ${one.stock}টা available আছে।` : `${one.name} is in stock (${one.stock} available).`;
        if (one.availability === 'in_stock') return bn ? `জি, ${one.name} in stock আছে। Exact quantity দেওয়া নেই।` : `${one.name} is in stock; an exact quantity is not listed.`;
        return bn ? `${one.name}-এর stock এখনো নিশ্চিত করা হয়নি।` : `${one.name}'s stock has not been confirmed.`;
    }
    if (intent === 'PRODUCT_VARIANT' && one.relevantVariant) { const qty = typeof one.relevantVariant.stock === 'number' ? ` (${one.relevantVariant.stock} in stock)` : ''; return bn ? `${one.name}-এর ${one.relevantVariant.name} variant—${money(one.relevantVariant.price, one.relevantVariant.currency)}${qty}।` : `${one.relevantVariant.name} is ${money(one.relevantVariant.price, one.relevantVariant.currency)}${qty}.`; }
    return bn ? `${cards.length}টা relevant option পেলাম।` : `I found ${cards.length} relevant option${cards.length === 1 ? '' : 's'}.`;
}

function formatOrderStatus(order: any) { const status = order.courier?.status ? courierStatusLabels[order.courier.status] || courierStatusLabels.unknown : order.status; return `Order #${order.orderNumber} is currently ${status}.${order.courier?.trackingCode ? ` Tracking code: ${order.courier.trackingCode}.` : ''}`; }

async function findProducts(businessId: string, text: string, activeProductId?: string, recentProductIds: string[] = []) {
    const intent = classifyLightweightIntent(text);
    const sku = requestedSku(text);
    if (sku) {
        const exactSkuProduct = await Product.findOne({ businessId, isActive: true, merchantConfirmed: { $ne: false }, $or: [{ slug: sku.toLowerCase() }, { 'variants.sku': sku }] }).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images').lean();
        if (exactSkuProduct) return [exactSkuProduct];
    }
    if (activeProductId && (followupWords.test(text.trim()) || ['PRODUCT_IMAGE','PRODUCT_STOCK','PRODUCT_VARIANT'].includes(intent))) {
        const active = await Product.findOne({ _id: activeProductId, businessId, isActive: true, merchantConfirmed: { $ne: false } }).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images').lean();
        if (active) return [active];
    }
    if (intent === 'PRODUCT_COMPARE' && recentProductIds.length) return Product.find({ businessId, _id: { $in: recentProductIds.slice(0, 4) }, isActive: true }).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images specs brand').limit(4).lean();
    const terms = parseSearchTerms(text); if (!terms.length) return [];
    const max = extractBudget(text);
    const searchFilter = { $and: terms.slice(0, 5).map((term) => {
        const pattern = escaped(term);
        return { $or: [
            { name: { $regex: pattern, $options: 'i' } }, { brand: { $regex: pattern, $options: 'i' } },
            { slug: { $regex: pattern, $options: 'i' } }, { aliases: { $regex: pattern, $options: 'i' } },
            { description: { $regex: pattern, $options: 'i' } }, { 'variants.sku': { $regex: pattern, $options: 'i' } },
            { 'variants.name': { $regex: pattern, $options: 'i' } },
            { compatibilityTags: { $regex: pattern, $options: 'i' } }, { 'intelligence.terms': { $regex: pattern, $options: 'i' } },
        ] };
    }) };
    const priceFilter = { $or: [{ salePrice: { $lte: max } }, { salePrice: null, basePrice: { $lte: max } }] };
    return Product.find({ businessId, isActive: true, merchantConfirmed: { $ne: false }, ...(max !== undefined ? { $and: [searchFilter, priceFilter] } : searchFilter) }).select('aiSellingStatus aiKnowledge name basePrice salePrice currency stock availability variants images specs brand categoryId').limit(4).lean();
}

async function stableBusinessFact(businessId: string, text: string, language: string, existingBusiness?: any) {
    const business = existingBusiness || await Business.findById(businessId).select('phone businessType').lean();
    if (/support number|phone|contact number|ফোন|নাম্বার/i.test(text) && business?.phone) return language === 'en' ? `You can contact us at ${business.phone}.` : `যোগাযোগের number: ${business.phone}।`;
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

export async function getDeterministicResponse(businessId: string, text: string, customerReference?: { psid?: string; conversationId?: string }): Promise<string|DeterministicTurnResponse|null> {
    assertTenantBusinessId(businessId, 'deterministic-response');
    const conversation = customerReference?.conversationId ? await Conversation.findOne({ businessId, conversationId: customerReference.conversationId }).select('metadata').lean() : null;
    const entity = conversation?.metadata?.entityState || {};
    const explicitLanguage = detectExplicitLanguagePreference(text);
    const language = resolveConversationLanguage(text, entity.preferredLanguage as ConversationLanguage | undefined);
    const intent = classifyLightweightIntent(text);
    const lightweightMemory = { ...extractLightweightMemory(text), preferredLanguage: language };
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
    if (!['GENERAL_CONVERSATION','KNOWLEDGE','HUMAN_HANDOFF','ORDER_STATUS','BUSINESS_FACT'].includes(intent)) {
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
                    const msg = language === 'en'
                        ? `${active.name} is available in sizes: ${sizeList}.`
                        : `${active.name}-এর available size হলো: ${sizeList}।`;
                    return { message_text: msg, suggested_products: [activeCard], intent: 'PRODUCT_VARIANT', memory: { ...lightweightMemory, activeProductId: String(active._id) } };
                }
                const msg = language === 'en'
                    ? `${active.name} comes in a standard regular size.`
                    : `${active.name}-এর standard/regular size available আছে।`;
                return { message_text: msg, suggested_products: [activeCard], intent: 'PRODUCT_VARIANT', memory: { ...lightweightMemory, activeProductId: String(active._id) } };
            }
        }

        const rawTerms = parseSearchTerms(text);
        const colorWord = rawTerms.find((w) => COLOR_WORDS[w.toLowerCase()]);
        const requestedColor = colorWord ? COLOR_WORDS[colorWord.toLowerCase()] : undefined;
        const coreTerms = colorWord ? rawTerms.filter((w) => w.toLowerCase() !== colorWord.toLowerCase()) : rawTerms;

        const products = await findProducts(businessId, text, entity.activeProductId, entity.recentProductIds || []);
        if (products.length === 1 && products[0].aiSellingStatus === 'disabled') {
            return { message_text: language === 'en' ? 'Sorry, this product is currently unavailable. I can help you find other available products.' : 'দুঃখিত, এই পণ্যটি বর্তমানে পাওয়া যাচ্ছে না। অন্য উপলব্ধ পণ্য খুঁজে পেতে সাহায্য করতে পারি।', intent, memory: lightweightMemory };
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
                const msg = language === 'en'
                    ? `Yes, ${exactMatch.name} (${requestedColor}) is in stock for ${priceFormatted}.`
                    : language === 'bn'
                        ? `জি, ${exactMatch.name} (${requestedColor}) available আছে। দাম ${priceFormatted}।`
                        : `Ji, ${exactMatch.name} (${requestedColor}) available ache. Price ${priceFormatted}।`;
                return {
                    message_text: msg,
                    suggested_products: [exactCard],
                    intent: intent === 'PRODUCT_VARIANT' ? 'PRODUCT_VARIANT' : 'PRODUCT_STOCK',
                    memory: { ...lightweightMemory, activeProductId: String(exactMatch._id), recentProductIds: [String(exactMatch._id)] }
                };
            }
        }

        const cards = activeProducts.map((item) => card(item, text)).slice(0, intent === 'PRODUCT_COMPARE' ? 4 : 3);
        const exact = cards.length === 1 || Boolean(entity.activeProductId && String(cards[0]?.id) === String(entity.activeProductId));
        if (cards.length && (intent === 'PRODUCT_SEARCH' || (exact && ['PRODUCT_PRICE','PRODUCT_STOCK','PRODUCT_IMAGE','PRODUCT_VARIANT'].includes(intent)))) {
            return { message_text: productText(intent, cards, language, text), suggested_products: cards, intent, memory: { ...lightweightMemory, activeProductId: cards.length === 1 ? cards[0].id : entity.activeProductId, recentProductIds: cards.map((item) => item.id) } };
        }
        if (cards.length && ['PRODUCT_PRICE','PRODUCT_STOCK','PRODUCT_IMAGE','PRODUCT_VARIANT'].includes(intent)) {
            return { message_text: language === 'en' ? 'I found a few possible matches. Which product do you mean?' : 'কয়েকটি match পেয়েছি। কোন product-টি জানতে চান?', suggested_products: cards, intent, memory: { ...lightweightMemory, recentProductIds: cards.map((item) => item.id) } };
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
                    const msg = language === 'en'
                        ? `We do not offer ${matchedWord}. As a ${typeLabel}, ${business.name || 'we'} provide ${serviceNames || 'consultation and services'}. Please feel free to ask about our available services.`
                        : `আমাদের এখানে ${matchedWord} নেই—আমরা মূলত ${business.name || 'প্রতিষ্ঠান'} হিসেবে ${typeLabel} সেবা প্রদান করি। আপনি চাইলে আমাদের ${serviceNames ? serviceNames + ' ' : ''}সার্ভিস সম্পর্কে জানতে পারেন।`;
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
                const sameProductWithAlt = (coreProducts || []).find((p: any) =>
                    p.aiSellingStatus !== 'disabled' &&
                    (p.variants || []).some((v: any) => v.isActive !== false && v.availability !== 'out_of_stock' && (typeof v.stock !== 'number' || v.stock > 0))
                );
                if (sameProductWithAlt) {
                    const altVariant = (sameProductWithAlt.variants || []).find((v: any) => v.isActive !== false && v.availability !== 'out_of_stock' && (typeof v.stock !== 'number' || v.stock > 0));
                    if (altVariant) {
                        const altVariantName = altVariant.name || 'alternative';
                        const altCard = card(sameProductWithAlt, altVariantName);
                        const priceFormatted = money(altCard.price, altCard.currency);
                        const msg = language === 'en'
                            ? `${requestedColor} is currently out of stock, but the same design is available in ${altVariantName} (${priceFormatted}).`
                            : language === 'bn'
                                ? `${requestedColor} ভ্যারিয়েন্টটি বর্তমানে available নেই, তবে একই ডিজাইনের ${altVariantName} ভ্যারিয়েন্ট স্টকে আছে (দাম ${priceFormatted})।`
                                : `${requestedColor} ta ekhon available nei, but same design-er ${altVariantName} variant ache (দাম ${priceFormatted})।`;
                        return {
                            message_text: msg,
                            suggested_products: [altCard],
                            intent: 'PRODUCT_VARIANT',
                            memory: { ...lightweightMemory, activeProductId: String(sameProductWithAlt._id), recentProductIds: [String(sameProductWithAlt._id)] }
                        };
                    }
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
                    const msg = language === 'en'
                        ? `${termLabel} is currently not available. However, here are some similar options you might like:`
                        : language === 'bn'
                            ? `${termLabel} বর্তমানে available নেই। তবে similar কিছু option আছে—চাইলে এগুলো দেখতে পারেন:`
                            : `${termLabel} ta currently nei. Tobe similar kichu option ache - chaile egulo dekhte paren:`;
                    return {
                        message_text: msg,
                        suggested_products: similarCards,
                        intent: 'PRODUCT_SEARCH',
                        memory: { ...lightweightMemory, recentProductIds: similarCards.map((c: any) => c.id) }
                    };
                }
            }

            // STEP 4: Polite Out of Stock
            if (rawTerms.length > 0) {
                const termLabel = rawTerms.join(' ');
                const msg = language === 'en'
                    ? `Sorry, ${termLabel} is currently not available in our catalog.`
                    : language === 'bn'
                        ? `দুঃখিত, আমাদের এখানে ${termLabel} বর্তমানে available নেই।`
                        : `Sorry, amader ekhane ${termLabel} currently available nei.`;
                return {
                    message_text: msg,
                    intent: 'PRODUCT_STOCK',
                    memory: lightweightMemory,
                };
            }

            return { message_text: language === 'en' ? 'Which product or service do you mean?' : 'কোন প্রোডাক্ট বা সার্ভিস সম্পর্কে জানতে চান?', intent, memory: lightweightMemory };
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
