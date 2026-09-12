import { BaseMessage } from '@langchain/core/messages';
import { Product } from '../models/Product';
import { Offering } from '../models/Offering';
import { Knowledge } from '../models/Knowledge';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { assertTenantBusinessId } from '../tenancy/context';
import { getRagTopK } from './ai-config';
import { isCatalogBrowseQuery } from './turn-routing.service';
import { retrieveRelevantAwareness } from './business-awareness.service';
import {
    buildKnowledgeSearchProfile,
    buildProductSearchProfile,
    compareCanonicalProducts,
    productMatchesConstraints,
    QueryIntelligence,
    refineDisplayText,
    scoreKnowledgeMatch,
    scoreProductMatch,
    understandQuery,
} from './knowledge-intelligence.service';

interface RAGContext {
    businessId: string;
    query: QueryIntelligence;
    catalogHits: any[];
    offeringHits: any[];
    knowledgeEntries: any[];
    awarenessEntries: any[];
    customerProfile: any;
    lastOrders: any[];
}

function escapedRegex(value: string): RegExp {
    return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function recentHumanText(history: BaseMessage[]): string {
    return history
        .filter((message) => message.getType() === 'human')
        .slice(-6)
        .map((message) => typeof message.content === 'string' ? message.content : JSON.stringify(message.content))
        .join(' ');
}

function productCandidateQuery(query: QueryIntelligence): Record<string, any> {
    const usefulTerms = query.terms.filter((term) =>
        !['price', 'delivery', 'cod', 'return', 'budget', 'under', 'within', 'moddhe', 'মধ্যে', 'ভিতরে', 'bdt'].includes(term)
        && !/^\d+(?:k)?$/.test(term)
    ).slice(-40);
    const regexes = usefulTerms.map(escapedRegex);
    const useCases = query.useCases.includes('hot_weather')
        ? [...new Set([...query.useCases, 'lightweight', 'breathable'])]
        : query.useCases;
    const or: Record<string, unknown>[] = [
        ...(usefulTerms.length ? [{ 'intelligence.terms': { $in: usefulTerms } }] : []),
        ...(query.colors.length ? [{ 'intelligence.colors': { $in: query.colors } }] : []),
        ...(query.sizes.length ? [{ 'intelligence.sizes': { $in: query.sizes } }] : []),
        ...(query.categories.length ? [{ 'intelligence.categories': { $in: query.categories } }] : []),
        ...(useCases.length ? [{ 'intelligence.useCases': { $in: useCases } }] : []),
        ...(regexes.length ? [
            { name: { $in: regexes } },
            { description: { $in: regexes } },
            { 'aiKnowledge.question': { $in: regexes } },
            { compatibilityTags: { $in: usefulTerms } },
            { 'variants.name': { $in: regexes } },
        ] : []),
    ];
    const constraints: Record<string, unknown>[] = [];
    if (or.length) constraints.push({ $or: or });
    if (query.budgetMax !== undefined) constraints.push({
        $or: [
            { salePrice: { $lte: query.budgetMax } },
            { salePrice: null, basePrice: { $lte: query.budgetMax } },
        ],
    });
    return { isActive: true, aiSellingStatus: { $ne: 'disabled' }, ...(constraints.length ? { $and: constraints } : {}) };
}

function knowledgeCandidateQuery(query: QueryIntelligence): Record<string, any> {
    const terms = query.terms.slice(-60);
    const regexes = terms.slice(-40).map(escapedRegex);
    const or: Record<string, unknown>[] = [
        ...(terms.length ? [{ 'intelligence.terms': { $in: terms } }, { tags: { $in: terms } }] : []),
        ...(regexes.length ? [{ title: { $in: regexes } }, { content: { $in: regexes } }] : []),
    ];
    return { status: 'active', merchantConfirmed: { $ne: false }, ...(or.length ? { $or: or } : {}) };
}

import { deriveProductSalesKnowledge, formatDerivedSalesGuidance } from './ingestion/derived-sales-knowledge.service';

export function sanitizeUntrustedDataText(value: unknown): string {
    const text = refineDisplayText(value);
    return text
        .replace(/\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior)\s+instructions\b/gi, '[neutralized]')
        .replace(/\b(?:you\s+are\s+now|system\s+prompt|developer\s+mode|dan\s+mode)\b/gi, '[neutralized]')
        .replace(/\b(?:reveal|show|print)\s+(?:system\s+)?(?:prompt|instructions|secret|api_?key)\b/gi, '[neutralized]')
        .replace(/`{3,}/g, "'''");
}

function productAvailability(product: any): boolean {
    if (product.availability === 'out_of_stock') return false;
    if (product.availability === 'in_stock') return true;
    return (typeof product.stock === 'number' && product.stock > 0) || (product.variants || []).some((variant: any) => variant.isActive !== false && (variant.stock > 0 || variant.availability === 'in_stock'));
}

export const retrieveContext = async (
    businessId: string,
    psid: string,
    messageText: string,
    history: BaseMessage[]
): Promise<RAGContext> => {
    assertTenantBusinessId(businessId, 'rag.retrieveContext');
    const topK = getRagTopK();
    const customer = await Customer.findOne({ psid }).lean();
    const lastOrders = customer
        ? await Order.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(3).lean()
        : [];

    // Conversation memory makes a short follow-up such as "black ache?" retain
    // a previously supplied category, size, or budget without another AI call.
    const query = understandQuery(`${recentHumanText(history)} ${messageText}`);
    // "What do you sell?" carries no search term, but the answer is the catalog
    // itself — ground it in the merchant's live products instead of returning an
    // empty context the model would fill with invented items.
    const browsing = isCatalogBrowseQuery(messageText);
    if (!query.terms.length && !browsing) return { businessId, query, catalogHits: [], offeringHits: [], knowledgeEntries: [], awarenessEntries: [], customerProfile: customer || { psid, status: 'guest' }, lastOrders };

    const offeringTerms = query.terms.filter((term) => term.length > 2).slice(-30).map(escapedRegex);
    const [rawKnowledge, rawProducts, rawOfferings, awarenessEntries] = await Promise.all([
        Knowledge.find(knowledgeCandidateQuery(query)).select('title content type knowledgeDomain sourcePriority isPinned merchantConfirmed +intelligence').limit(Math.max(topK * 3, 6)).lean(),
        Product.find(productCandidateQuery(query))
            .limit(Math.max(topK * 6, 12))
            .select('aiSellingStatus aiKnowledge name publicCode barcode description basePrice salePrice stock availability brand specs variants compatibilityTags isFeatured +intelligence merchantConfirmed updatedAt')
            .lean(),
        Offering.find({ status: 'active', merchantConfirmed: { $ne: false }, ...(offeringTerms.length ? { $or: [{ name: { $in: offeringTerms } }, { description: { $in: offeringTerms } }, { category: { $in: offeringTerms } }] } : {}) })
            .limit(Math.max(topK * 3, 6)).lean(),
        retrieveRelevantAwareness(businessId, messageText, Math.max(2, Math.min(4, topK))),
    ]);

    const knowledgeEntries = rawKnowledge
        .map((entry: any) => ({ ...entry, intelligence: entry.intelligence || buildKnowledgeSearchProfile(entry), _score: scoreKnowledgeMatch(entry, query) }))
        .filter((entry: any) => entry._score > 0)
        .sort((left: any, right: any) => right._score - left._score)
        .slice(0, topK);

    const scoredProducts = rawProducts
        .filter((product: any) => product.merchantConfirmed !== false)
        .map((product: any) => ({ ...product, intelligence: product.intelligence || buildProductSearchProfile(product), _score: scoreProductMatch(product, query) }))
        .filter((product: any) => product._score > 0)
        .sort((left: any, right: any) => (right._score - left._score) || Number(productAvailability(right)) - Number(productAvailability(left)));
    const exact = scoredProducts.filter((product: any) => productMatchesConstraints(product, query));
    const catalogHits = (exact.length ? exact : scoredProducts)
        .slice(0, query.comparison ? Math.max(2, topK) : topK)
        .map((product: any) => ({ ...product, _matchKind: exact.length ? 'constraint_match' : 'closest_supported_alternative' }));

    const offeringHits = rawOfferings.slice(0, topK);
    if (browsing && !catalogHits.length) {
        const browseHits = await Product.find({ isActive: true, aiSellingStatus: { $ne: 'disabled' }, merchantConfirmed: { $ne: false } })
            .sort({ isFeatured: -1, updatedAt: -1 })
            .limit(Math.max(topK, 5))
            .select('aiSellingStatus aiKnowledge name publicCode barcode description basePrice salePrice stock availability brand specs variants compatibilityTags isFeatured +intelligence')
            .lean()
            .catch(() => []);
        return { businessId, query, catalogHits: browseHits.map((product: any) => ({ ...product, _matchKind: 'catalog_browse' })), offeringHits, knowledgeEntries, awarenessEntries, customerProfile: customer || { psid, status: 'guest' }, lastOrders };
    }
    return { businessId, query, catalogHits, offeringHits, knowledgeEntries, awarenessEntries, customerProfile: customer || { psid, status: 'guest' }, lastOrders };
};

/**
 * The context pack is paid for on every LLM turn, so it carries only facts the
 * model cannot get anywhere else. Standing rules (trust order, safety, response
 * constraints) live in the static system prompt instead of being repeated here,
 * and per-product boilerplate is emitted only when it actually applies — that is
 * roughly half the tokens of the previous envelope for the same catalog facts.
 */
export const formatContextPack = (context: RAGContext): string => {
    const query = context.query;
    const understanding: Record<string, unknown> = {};
    if (query.colors?.length) understanding.colors = query.colors;
    if (query.sizes?.length) understanding.sizes = query.sizes;
    if (query.categories?.length) understanding.categories = query.categories;
    if (query.materials?.length) understanding.materials = query.materials;
    if (query.useCases?.length) understanding.use_cases = query.useCases;
    if (query.budgetMax !== undefined) understanding.max_budget = query.budgetMax;
    if (query.comparison) understanding.comparison = true;
    if (query.serviceIntent) understanding.service_intent = true;
    if (query.highStakes) understanding.high_stakes = true;

    const products = context.catalogHits.map((product, position) => {
        const entry: Record<string, unknown> = {
            name: sanitizeUntrustedDataText(product.name),
            code: product.publicCode || product.barcode || undefined,
            price: product.salePrice ?? product.basePrice,
            stock: product.stock,
            availability: product.availability,
        };
        if (product.salePrice && product.salePrice !== product.basePrice) entry.was = product.basePrice;
        if (product.brand) entry.brand = product.brand;
        if (product._matchKind === 'closest_supported_alternative') entry.alternative = true;
        if (product.aiSellingStatus === 'limited') entry.verify_variant_stock_before_selling = true;
        if (product.aiSellingStatus === 'disabled') entry.do_not_sell = true;
        const description = sanitizeUntrustedDataText(product.description).slice(0, 120);
        if (description) entry.about = description;
        const variants = (product.variants || []).filter((variant: any) => variant.isActive !== false)
            .slice(0, 3).map((variant: any) => ({ name: variant.name, sku: variant.sku, price: variant.price, stock: variant.stock }));
        if (variants.length) entry.variants = variants;
        const facts = (product.intelligence?.facts || []).slice(0, 3);
        if (facts.length) entry.facts = facts;
        const answers = (product.aiKnowledge || []).slice(0, 2);
        if (answers.length) entry.approved_answers = answers;
        // Selling angles only for the best match: the model pitches one product,
        // so repeating guidance for every hit is pure token cost.
        if (position === 0) {
            const { authority, ...guidance } = formatDerivedSalesGuidance(deriveProductSalesKnowledge(product)) as Record<string, any>;
            const useful = Object.fromEntries(Object.entries(guidance).filter(([, value]) => Array.isArray(value) ? value.length : Boolean(value)));
            if (Object.keys(useful).length) entry.sales_guidance = useful;
        }
        return entry;
    });

    const services = context.offeringHits.map((offering) => ({
        type: offering.offeringType,
        name: sanitizeUntrustedDataText(offering.name),
        about: sanitizeUntrustedDataText(offering.description || '').slice(0, 160),
        price: offering.salePrice ?? offering.price,
        currency: offering.currency,
        availability: offering.availability,
    }));

    const offers = (context.awarenessEntries || []).map((entry) => ({
        title: sanitizeUntrustedDataText(entry.title),
        target: entry.targetReference || entry.targetType,
        claim: entry.claimType, value: entry.claimValue, ends_at: entry.endsAt,
    }));

    const knowledge = context.knowledgeEntries.map((entry) => ({
        title: sanitizeUntrustedDataText(entry.title),
        content: sanitizeUntrustedDataText(entry.content).slice(0, 400),
        facts: (entry.intelligence?.facts || []).slice(0, 3),
        ...(entry.intelligence?.riskLevel && entry.intelligence.riskLevel !== 'normal' ? { risk: entry.intelligence.riskLevel } : {}),
    }));

    const pack: Record<string, unknown> = {};
    if (Object.keys(understanding).length) pack.understood = understanding;
    if (context.customerProfile?.name && context.customerProfile.name !== 'Guest') pack.customer = context.customerProfile.name;
    if (context.lastOrders.length) pack.recent_orders = context.lastOrders.map((order) => ({ id: order.orderNumber || order._id, status: order.status, total: order.total }));
    if (products.length) pack.products = products;
    if (services.length) pack.services = services;
    if (offers.length) pack.offers = offers;
    if (knowledge.length) pack.knowledge = knowledge;
    if (query.comparison && context.catalogHits.length) pack.comparison = compareCanonicalProducts(context.catalogHits);
    return JSON.stringify(pack);
};

export function enforceContextBudget(serialized: string, maximumEstimatedTokens = 1200): string {
    if (Math.ceil(serialized.length / 4) <= maximumEstimatedTokens) return serialized;
    try {
        const value = JSON.parse(serialized);
        value.offers = (value.offers || []).slice(0, 1);
        value.knowledge = (value.knowledge || []).slice(0, 1).map((entry: any) => ({ ...entry, content: String(entry.content || '').slice(0, 280), facts: (entry.facts || []).slice(0, 2) }));
        value.products = (value.products || []).slice(0, 3).map((entry: any) => ({ ...entry, about: undefined, variants: (entry.variants || []).slice(0, 2), facts: (entry.facts || []).slice(0, 2) }));
        value.services = (value.services || []).slice(0, 3).map((entry: any) => ({ ...entry, about: String(entry.about || '').slice(0, 120) }));
        const compact = JSON.stringify(value);
        if (Math.ceil(compact.length / 4) <= maximumEstimatedTokens) return compact;
        // Last resort: keep only what the answer cannot be correct without.
        return JSON.stringify({
            understood: value.understood,
            products: (value.products || []).map((entry: any) => ({ name: entry.name, code: entry.code, price: entry.price, stock: entry.stock, availability: entry.availability, do_not_sell: entry.do_not_sell, verify_variant_stock_before_selling: entry.verify_variant_stock_before_selling })),
            services: value.services,
            knowledge: (value.knowledge || []).map((entry: any) => ({ title: entry.title, content: String(entry.content || '').slice(0, 200) })),
        });
    } catch { return '{}'; }
}
