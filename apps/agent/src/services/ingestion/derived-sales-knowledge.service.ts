/**
 * derived-sales-knowledge.service.ts
 *
 * Grounded, deterministic sales learning layer.
 *
 * COST CONTRACT:
 * - ZERO LLM calls during derivation
 * - ZERO DB calls (pure functions)
 * - Strict prohibition on fabricated claims:
 *     No invented discounts, scarcity, bestsellers, reviews, popularity, or performance promises.
 */

export interface DerivedProductSalesKnowledge {
    suitableIntents: string[];
    relevantCustomerNeeds: string[];
    factualSellingAngles: string[];
    likelyComparisonDimensions: string[];
    complementaryCategories: string[];
    factualObjectionHandling: Array<{ objectionType: 'price' | 'delivery' | 'quality' | 'compatibility'; responsePoint: string }>;
    whenNotToRecommend: string[];
}

const CROSS_SELL_RULES: Array<{ match: RegExp; complements: string[] }> = [
    { match: /\b(?:panjabi|punjabi|পাঞ্জাবি)\b/i, complements: ['Pajama', 'Koti / Waistcoat', 'Nagla Shoes'] },
    { match: /\b(?:shirt|tshirt|t-shirt|শার্ট|টি-শার্ট)\b/i, complements: ['Chinos', 'Denim Jeans', 'Trousers', 'Belt'] },
    { match: /\b(?:saree|sharee|শাড়ি)\b/i, complements: ['Blouse Piece', 'Petticoat', 'Jewelry'] },
    { match: /\b(?:kurti|kamiz|salwar|কামিজ|কুর্তি)\b/i, complements: ['Leggings', 'Dupatta / Orna', 'Palazzo'] },
    { match: /\b(?:laptop|notebook|কম্পিউটার)\b/i, complements: ['Laptop Backpack', 'Wireless Mouse', 'Laptop Stand'] },
    { match: /\b(?:phone|smartphone|mobile|ফোন)\b/i, complements: ['Fast Charger', 'Tempered Glass', 'Back Cover'] },
    { match: /\b(?:backpack|bag|ব্যাগ)\b/i, complements: ['Rain Cover', 'Pouch / Organizer', 'Water Bottle'] },
    { match: /\b(?:shoes?|sneakers?|জুতা)\b/i, complements: ['Socks', 'Shoe Care Cleaner'] },
];

/**
 * Derives compact, factual sales knowledge from canonical product fields and specs.
 * Pure deterministic function.
 */
export function deriveProductSalesKnowledge(
    product: {
        name: string;
        description?: string;
        category?: string;
        basePrice?: number;
        salePrice?: number;
        currency?: string;
        specs?: Record<string, unknown>;
        variants?: Array<{ name: string; sku?: string; price?: number; specs?: Record<string, unknown> }>;
        brand?: string;
        warrantyMonths?: number;
        isReturnable?: boolean;
        returnDays?: number;
        availability?: string;
        stock?: number | null;
    },
    businessContext?: {
        insideDhakaDelivery?: number;
        outsideDhakaDelivery?: number;
        codAvailable?: boolean;
    }
): DerivedProductSalesKnowledge {
    const fullText = `${product.name} ${product.category || ''} ${product.description || ''} ${JSON.stringify(product.specs || {})}`.toLowerCase();

    // 1. Suitable customer intents
    const suitableIntents: string[] = [];
    if (/casual|daily|regular|daily wear|ক্যাজুয়াল/i.test(fullText)) suitableIntents.push('Casual daily wear');
    if (/office|formal|work|professional|focus|meeting|অফিস/i.test(fullText)) suitableIntents.push('Office & professional work');
    if (/commut|travel|tour|trip|ভ্রমণ/i.test(fullText)) suitableIntents.push('Commute & travel');
    if (/workout|sport|gym|run|fitness|exercise|দৌড়/i.test(fullText)) suitableIntents.push('Workouts & active sports');
    if (/eid|puja|festive|party|wedding|অনুষ্ঠান|উৎসব/i.test(fullText)) suitableIntents.push('Festive / special occasion');
    if (/summer|hot weather|breathable|গরম/i.test(fullText)) suitableIntents.push('Warm / summer weather');
    if (/winter|warm|fleece|jacket|শীত/i.test(fullText)) suitableIntents.push('Cold / winter weather');
    if (/gift|present|উপহার/i.test(fullText)) suitableIntents.push('Gift purchase');
    if (!suitableIntents.length) suitableIntents.push('General commerce inquiry');

    // 2. Relevant customer needs (strictly grounded in stated attributes)
    const relevantCustomerNeeds: string[] = [];
    if (/anc|noise cancel|quiet|noise isolation/i.test(fullText)) relevantCustomerNeeds.push('Noise isolation / quiet listening');
    if (/battery|playback|playtime|hour/i.test(fullText)) relevantCustomerNeeds.push('Long battery endurance');
    if (/cotton|linen|কটন|লিনেন/i.test(fullText)) relevantCustomerNeeds.push('Natural breathable fabric');
    if (/water resistant|water-resistant|waterproof|ipx|পানি প্রতিরোধী/i.test(fullText)) relevantCustomerNeeds.push('Moisture / water resistance');
    if (/lightweight|light weight|হালকা/i.test(fullText)) relevantCustomerNeeds.push('Lightweight comfortable carry');
    if (/durable|premium|heavy duty/i.test(fullText)) relevantCustomerNeeds.push('Long-lasting build quality');
    if (product.warrantyMonths && product.warrantyMonths > 0) relevantCustomerNeeds.push(`Official ${product.warrantyMonths}-month warranty peace of mind`);
    if (product.isReturnable !== false) relevantCustomerNeeds.push(`${product.returnDays || 7}-day return/exchange security`);

    // 3. Factual selling angles (derived strictly from confirmed specs, never fabricated)
    const factualSellingAngles: string[] = [];
    if (product.brand) factualSellingAngles.push(`Authentic ${product.brand} product`);
    if (product.specs) {
        for (const [key, value] of Object.entries(product.specs).slice(0, 4)) {
            if (value && typeof value === 'string' && value.length < 50) {
                factualSellingAngles.push(`${key}: ${value}`);
            }
        }
    }
    if (product.variants?.length && product.variants.length > 1) {
        factualSellingAngles.push(`${product.variants.length} available options to fit customer preferences`);
    }

    // 4. Comparison dimensions
    const likelyComparisonDimensions: string[] = [
        `Price: ${product.salePrice ?? product.basePrice ?? 'N/A'} ${product.currency || 'BDT'}`,
    ];
    if (product.specs?.Material || product.specs?.Fabric) {
        likelyComparisonDimensions.push(`Material: ${String(product.specs.Material || product.specs.Fabric)}`);
    }
    if (product.warrantyMonths) {
        likelyComparisonDimensions.push(`Warranty: ${product.warrantyMonths} Months`);
    }
    if (product.specs) {
        for (const key of Object.keys(product.specs)) {
            if (!likelyComparisonDimensions.some((d) => d.toLowerCase().startsWith(key.toLowerCase()))) {
                likelyComparisonDimensions.push(key);
            }
        }
    }

    // 5. Complementary categories for cross-sell (deterministic matching)
    const complementaryCategories: string[] = [];
    for (const rule of CROSS_SELL_RULES) {
        if (rule.match.test(fullText)) {
            complementaryCategories.push(...rule.complements);
            break;
        }
    }

    // 6. Factual objection handling
    const factualObjectionHandling: Array<{ objectionType: 'price' | 'delivery' | 'quality' | 'compatibility'; responsePoint: string }> = [];

    // Price objection: grounded in material, specs, or warranty
    const price = product.salePrice ?? product.basePrice;
    if (price) {
        const qualityAnchor = product.specs?.Material || product.brand || 'catalog specifications';
        const warrantyAnchor = product.warrantyMonths ? ` backed by ${product.warrantyMonths}-month warranty` : '';
        factualObjectionHandling.push({
            objectionType: 'price',
            responsePoint: `Grounded in ${qualityAnchor}${warrantyAnchor}; verify if customer needs budget alternatives.`,
        });
    }

    // Delivery objection: grounded in business delivery context if known
    if (businessContext?.insideDhakaDelivery !== undefined) {
        factualObjectionHandling.push({
            objectionType: 'delivery',
            responsePoint: `Inside Dhaka ৳${businessContext.insideDhakaDelivery}${businessContext.outsideDhakaDelivery ? `, outside Dhaka ৳${businessContext.outsideDhakaDelivery}` : ''}${businessContext.codAvailable ? ' with Cash on Delivery available' : ''}.`,
        });
    }

    // 7. When NOT to recommend (crucial guardrail against bad AI sales behavior)
    const whenNotToRecommend: string[] = [];
    if (product.availability === 'out_of_stock' || (typeof product.stock === 'number' && product.stock === 0)) {
        whenNotToRecommend.push('Item is currently OUT OF STOCK. Never accept orders or promise immediate fulfillment.');
    }
    if (price) {
        whenNotToRecommend.push(`Do not recommend if customer explicitly sets maximum budget below ${price} ${product.currency || 'BDT'}.`);
    }
    if (/wireless|bluetooth/i.test(fullText) && /earbuds|headphones|audio/i.test(fullText)) {
        whenNotToRecommend.push('Not recommended for professional zero-latency studio monitoring requiring wired connections.');
    }
    if (/summer|hot weather/i.test(fullText) && /wool|fleece|heavy jacket/i.test(fullText)) {
        whenNotToRecommend.push('Do not recommend for hot summer conditions.');
    }

    return {
        suitableIntents: [...new Set(suitableIntents)].slice(0, 6),
        relevantCustomerNeeds: [...new Set(relevantCustomerNeeds)].slice(0, 6),
        factualSellingAngles: [...new Set(factualSellingAngles)].slice(0, 6),
        likelyComparisonDimensions: likelyComparisonDimensions.slice(0, 6),
        complementaryCategories: [...new Set(complementaryCategories)].slice(0, 4),
        factualObjectionHandling: factualObjectionHandling.slice(0, 3),
        whenNotToRecommend: whenNotToRecommend.slice(0, 4),
    };
}

/**
 * Formats derived sales guidance into a compact string representation for RAG context (≤80 tokens).
 */
export function formatDerivedSalesGuidance(knowledge: DerivedProductSalesKnowledge): Record<string, unknown> {
    return {
        authority: 'DERIVED_SALES_GUIDANCE',
        intents: knowledge.suitableIntents,
        key_angles: knowledge.factualSellingAngles,
        cross_sell: knowledge.complementaryCategories,
        when_not_to_recommend: knowledge.whenNotToRecommend,
    };
}

export const deriveFactualSalesKnowledge = deriveProductSalesKnowledge;

