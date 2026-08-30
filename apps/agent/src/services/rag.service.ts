import { BaseMessage } from '@langchain/core/messages';
import { Product } from '../models/Product';
import { Knowledge } from '../models/Knowledge';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { assertTenantBusinessId } from '../tenancy/context';
import { getRagTopK } from './ai-config';
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
    knowledgeEntries: any[];
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
    if (!query.terms.length) return { businessId, query, catalogHits: [], knowledgeEntries: [], customerProfile: customer || { psid, status: 'guest' }, lastOrders };

    const [rawKnowledge, rawProducts] = await Promise.all([
        Knowledge.find(knowledgeCandidateQuery(query)).select('+intelligence').limit(Math.max(topK * 4, 12)).lean(),
        Product.find(productCandidateQuery(query))
            .limit(Math.max(topK * 8, 30))
            .select('name description basePrice salePrice stock availability brand specs variants compatibilityTags isFeatured +intelligence merchantConfirmed updatedAt')
            .lean(),
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

    return { businessId, query, catalogHits, knowledgeEntries, customerProfile: customer || { psid, status: 'guest' }, lastOrders };
};

export const formatContextPack = (context: RAGContext): string => JSON.stringify({
    trust_order: [
        'canonical_product_service_inventory',
        'merchant_confirmed_structured_business_information',
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
        description: refineDisplayText(product.description).slice(0, 600),
        price: product.basePrice,
        sale_price: product.salePrice,
        stock: product.stock,
        availability: product.availability,
        brand: product.brand,
        variants: (product.variants || []).filter((variant: any) => variant.isActive !== false).map((variant: any) => ({ name: variant.name, sku: variant.sku, price: variant.price, stock: variant.stock, specs: variant.specs })).slice(0, 20),
        specs: product.specs || {},
        confirmed_attributes: product.intelligence?.facts || [],
        tags: (product.compatibilityTags || []).slice(0, 20),
    })),
    comparison_facts: context.query.comparison ? compareCanonicalProducts(context.catalogHits) : [],
    approved_knowledge: context.knowledgeEntries.map((entry) => ({
        authority: 'APPROVED_KNOWLEDGE',
        type: entry.type,
        title: refineDisplayText(entry.title),
        content: refineDisplayText(entry.content).slice(0, 1200),
        structured_facts: entry.intelligence?.facts || [],
        risk_level: entry.intelligence?.riskLevel || 'normal',
    })),
    response_constraints: {
        factual_constraints_are_exact: true,
        alternatives_must_be_labelled: true,
        supported_interpretations_must_not_be_presented_as_guarantees: true,
        high_stakes_outcomes_must_never_be_guaranteed: true,
    },
}, null, 2);
