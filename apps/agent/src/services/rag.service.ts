import { BaseMessage } from '@langchain/core/messages';
import { Product } from '../models/Product';
import { Offering } from '../models/Offering';
import { Knowledge } from '../models/Knowledge';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { assertTenantBusinessId } from '../tenancy/context';
import { getRagTopK } from './ai-config';
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
    return { isActive: true, ...(constraints.length ? { $and: constraints } : {}) };
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

function productAvailability(product: any): boolean {
    if (product.availability === 'out_of_stock') return false;
    return product.stock > 0 || (product.variants || []).some((variant: any) => variant.isActive !== false && variant.stock > 0);
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
    if (!query.terms.length) return { businessId, query, catalogHits: [], offeringHits: [], knowledgeEntries: [], awarenessEntries: [], customerProfile: customer || { psid, status: 'guest' }, lastOrders };

    const offeringTerms = query.terms.filter((term) => term.length > 2).slice(-30).map(escapedRegex);
    const [rawKnowledge, rawProducts, rawOfferings, awarenessEntries] = await Promise.all([
        Knowledge.find(knowledgeCandidateQuery(query)).select('title content type knowledgeDomain sourcePriority isPinned merchantConfirmed +intelligence').limit(Math.max(topK * 3, 6)).lean(),
        Product.find(productCandidateQuery(query))
            .limit(Math.max(topK * 6, 12))
            .select('name description basePrice salePrice stock availability brand specs variants compatibilityTags isFeatured +intelligence merchantConfirmed updatedAt')
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
    return { businessId, query, catalogHits, offeringHits, knowledgeEntries, awarenessEntries, customerProfile: customer || { psid, status: 'guest' }, lastOrders };
};

export const formatContextPack = (context: RAGContext): string => JSON.stringify({
    trust_order: [
        'canonical_product_service_inventory',
        'merchant_confirmed_structured_business_information',
        'verified_active_business_awareness',
        'approved_knowledge',
        'safe_conversational_inference',
    ],
    query_understanding: {
        colors: context.query.colors,
        sizes: context.query.sizes,
        categories: context.query.categories,
        materials: context.query.materials,
        use_cases: context.query.useCases,
        maximum_budget: context.query.budgetMax,
        comparison: context.query.comparison,
        service_intent: context.query.serviceIntent,
        high_stakes: context.query.highStakes,
    },
    customer: {
        name: context.customerProfile.name || 'Guest',
        language: context.customerProfile.language || 'en',
        recent_orders: context.lastOrders.map((order) => ({ id: order._id, status: order.status, total: order.total, date: order.createdAt })),
    },
    canonical_catalog_matches: context.catalogHits.map((product) => ({
        authority: 'CANONICAL_CURRENT_PRODUCT',
        match_kind: product._matchKind,
        name: refineDisplayText(product.name),
        description: refineDisplayText(product.description).slice(0, 240),
        price: product.basePrice,
        sale_price: product.salePrice,
        stock: product.stock,
        availability: product.availability,
        brand: product.brand,
        variants: (product.variants || []).filter((variant: any) => variant.isActive !== false).map((variant: any) => ({ name: variant.name, sku: variant.sku, price: variant.price, stock: variant.stock })).slice(0, 4),
        key_facts: (product.intelligence?.facts || []).slice(0, 5),
    })),
    canonical_offering_matches: context.offeringHits.map((offering) => ({
        authority: 'CANONICAL_CURRENT_OFFERING', type: offering.offeringType, name: refineDisplayText(offering.name),
        description: refineDisplayText(offering.description || '').slice(0, 320), category: offering.category,
        price: offering.price, sale_price: offering.salePrice, currency: offering.currency, availability: offering.availability,
        attributes: offering.attributes || {}, canonical_url: offering.canonicalUrl,
    })),
    comparison_facts: context.query.comparison ? compareCanonicalProducts(context.catalogHits) : [],
    current_business_awareness: (context.awarenessEntries || []).map((entry) => ({
        authority: 'VERIFIED_ACTIVE_AWARENESS', type: entry.type, title: entry.title, summary: entry.summary,
        target_type: entry.targetType, target: entry.targetReference, claim_type: entry.claimType, claim_value: entry.claimValue,
        validation: entry.validation, ends_at: entry.endsAt,
    })),
    approved_knowledge: context.knowledgeEntries.map((entry) => ({
        authority: 'APPROVED_KNOWLEDGE',
        type: entry.type,
        title: refineDisplayText(entry.title),
        content: refineDisplayText(entry.content).slice(0, 500),
        structured_facts: (entry.intelligence?.facts || []).slice(0, 5),
        risk_level: entry.intelligence?.riskLevel || 'normal',
    })),
    response_constraints: {
        factual_constraints_are_exact: true,
        alternatives_must_be_labelled: true,
        supported_interpretations_must_not_be_presented_as_guarantees: true,
        high_stakes_outcomes_must_never_be_guaranteed: true,
    },
});

export function enforceContextBudget(serialized: string, maximumEstimatedTokens = 1200): string {
    if (Math.ceil(serialized.length / 4) <= maximumEstimatedTokens) return serialized;
    try {
        const value = JSON.parse(serialized);
        value.current_business_awareness = (value.current_business_awareness || []).slice(0, 1);
        value.approved_knowledge = (value.approved_knowledge || []).slice(0, 1).map((entry: any) => ({ ...entry, content: String(entry.content || '').slice(0, 280), structured_facts: (entry.structured_facts || []).slice(0, 3) }));
        value.canonical_catalog_matches = (value.canonical_catalog_matches || []).slice(0, 3).map((entry: any) => ({ ...entry, description: String(entry.description || '').slice(0, 120), variants: (entry.variants || []).slice(0, 2), key_facts: (entry.key_facts || []).slice(0, 3) }));
        value.canonical_offering_matches = (value.canonical_offering_matches || []).slice(0, 3).map((entry: any) => ({ ...entry, description: String(entry.description || '').slice(0, 180) }));
        const compact = JSON.stringify(value);
        if (Math.ceil(compact.length / 4) <= maximumEstimatedTokens) return compact;
        return JSON.stringify({ query_understanding: value.query_understanding, canonical_catalog_matches: value.canonical_catalog_matches.map((entry: any) => ({ authority: entry.authority, name: entry.name, price: entry.price, sale_price: entry.sale_price, stock: entry.stock, availability: entry.availability, key_facts: entry.key_facts })), canonical_offering_matches: value.canonical_offering_matches, approved_knowledge: value.approved_knowledge, response_constraints: value.response_constraints });
    } catch { return '{}'; }
}
