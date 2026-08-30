import crypto from 'node:crypto';

export type FactConfidence = 'confirmed' | 'supported';

export interface StructuredFact {
    subject: string;
    predicate: string;
    value: string | number | boolean;
    unit?: string;
    confidence: FactConfidence;
}

export interface SearchProfile {
    profileVersion: number;
    searchableText: string;
    terms: string[];
    colors: string[];
    sizes: string[];
    materials: string[];
    categories: string[];
    useCases: string[];
    facts: StructuredFact[];
    riskLevel: 'normal' | 'high';
    sourceHash: string;
}

export interface QueryIntelligence {
    normalizedText: string;
    terms: string[];
    colors: string[];
    sizes: string[];
    categories: string[];
    materials: string[];
    useCases: string[];
    budgetMax?: number;
    comparison: boolean;
    serviceIntent?: { country?: string; visaType?: string; studyLevel?: string };
    highStakes: boolean;
}

const CONCEPTS: Record<string, string[]> = {
    black: ['black', 'কালো', 'কালা', 'kalo', 'kala'],
    white: ['white', 'সাদা', 'shada', 'sada'],
    blue: ['blue', 'নীল', 'nil', 'navy'],
    red: ['red', 'লাল', 'lal'],
    green: ['green', 'সবুজ', 'shobuj', 'sobuj'],
    shirt: ['shirt', 'shirts', 'শার্ট', 'sart'],
    tshirt: ['tshirt', 't shirt', 'tee', 'টি শার্ট', 'টি-শার্ট', 'গেঞ্জি', 'genji'],
    backpack: ['backpack', 'bag', 'ব্যাকপ্যাক', 'ব্যাগ', 'back pack'],
    price: ['price', 'দাম', 'dam', 'koto', 'কত'],
    delivery: ['delivery', 'shipping', 'ডেলিভারি', 'ডেলিভারি চার্জ', 'ডেলিভারি খরচ'],
    cod: ['cod', 'cash on delivery', 'ক্যাশ অন ডেলিভারি'],
    return: ['return', 'exchange', 'refund', 'রিটার্ন', 'এক্সচেঞ্জ', 'ফেরত'],
    water_resistant: ['water resistant', 'water-resistant', 'পানি প্রতিরোধী', 'pani resistant'],
    hot_weather: ['hot weather', 'summer', 'গরম', 'gorom', 'গরমে', 'gorom e'],
    lightweight: ['lightweight', 'light weight', 'হালকা', 'halka'],
    breathable: ['breathable', 'বাতাস চলাচল', 'air flow'],
    canada: ['canada', 'কানাডা'],
    study: ['study', 'student', 'education', 'পড়াশোনা', 'পড়াশোনা', 'স্টুডেন্ট'],
    masters: ['masters', 'master', 'msc', 'মাস্টার্স'],
    visa: ['visa', 'ভিসা'],
};

const COLOR_KEYS = ['black', 'white', 'blue', 'red', 'green'];
const CATEGORY_KEYS = ['shirt', 'tshirt', 'backpack'];
const MATERIALS = ['cotton', 'linen', 'silk', 'leather', 'polyester', 'denim', 'কটন', 'লিনেন', 'সিল্ক', 'লেদার'];
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'please', 'ache', 'আছে', 'ki', 'কি', 'ta', 'টা', 'er', 'এর', 'jonno', 'জন্য', 'dekhaw', 'দেখাও', 'kichu', 'কিছু']);

export function refineDisplayText(value: unknown): string {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function cleanText(value: unknown): string {
    return refineDisplayText(value)
        .toLowerCase()
        .replace(/৳|tk\.?|taka/gi, ' bdt ')
        .replace(/[^\p{L}\p{N}.\-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
    const normalizedPhrase = cleanText(phrase);
    return normalizedPhrase.length > 0 && (` ${text} `).includes(` ${normalizedPhrase} `);
}

function presentConcepts(text: string, allowed?: string[]): string[] {
    return Object.entries(CONCEPTS)
        .filter(([key, aliases]) => (!allowed || allowed.includes(key)) && aliases.some((alias) => containsPhrase(text, alias)))
        .map(([key]) => key);
}

function expandConcepts(text: string): string[] {
    const terms = new Set(text.split(' ').filter((term) => term.length > 1 && !STOP_WORDS.has(term)));
    for (const [concept, aliases] of Object.entries(CONCEPTS)) {
        if (aliases.some((alias) => containsPhrase(text, alias))) {
            terms.add(concept);
            aliases.map(cleanText).filter((alias) => !alias.includes(' ')).forEach((alias) => terms.add(alias));
        }
    }
    return [...terms].slice(0, 120);
}

function extractSizes(text: string): string[] {
    const sizes = new Set<string>();
    for (const match of text.matchAll(/(?:^|\s)(xxxl|xxl|xl|xs|s|m|l)(?:\s|$)/gi)) sizes.add(match[1].toUpperCase());
    for (const match of text.matchAll(/(?:^|\s)(?:size\s*)?(\d{2,3})(?=\s|$)/gi)) sizes.add(match[1]);
    return [...sizes];
}

function extractMaterials(text: string): string[] {
    const found = MATERIALS.filter((material) => containsPhrase(text, material));
    return [...new Set(found.map((material) => ({ কটন: 'cotton', লিনেন: 'linen', সিল্ক: 'silk', লেদার: 'leather' }[material] || material)))];
}

function extractUseCases(text: string): string[] {
    const useCases = new Set<string>();
    if (presentConcepts(text).includes('hot_weather')) useCases.add('hot_weather');
    if (presentConcepts(text).includes('lightweight')) useCases.add('lightweight');
    if (presentConcepts(text).includes('breathable')) useCases.add('breathable');
    if (/casual|ক্যাজুয়াল|office|অফিস|travel|ভ্রমণ/i.test(text)) {
        for (const value of ['casual', 'office', 'travel']) if (containsPhrase(text, value)) useCases.add(value);
    }
    return [...useCases];
}

function numberValue(value: string): number {
    return Number(value.replace(/,/g, ''));
}

export function parseBudget(textValue: unknown): number | undefined {
    const text = String(textValue ?? '').normalize('NFKC').toLowerCase().replace(/৳|tk\.?|taka/gi, ' bdt ').replace(/\s+/g, ' ').trim();
    const thousand = text.match(/(?:budget\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
    if (thousand) return Math.round(Number(thousand[1]) * 1000);
    const bounded = text.match(/(?:budget|under|within|মধ্যে|moddhe|ভিতরে)[^\d]{0,12}(\d[\d,]*)|(?:\d[\d,]*)[^\d]{0,12}(?:মধ্যে|moddhe|under)/i);
    if (bounded) {
        const raw = bounded[1] || text.match(/\d[\d,]*/)?.[0];
        return raw ? numberValue(raw) : undefined;
    }
    return undefined;
}

function deliveryFacts(text: string): StructuredFact[] {
    const facts: StructuredFact[] = [];
    const inside = text.match(/(?:inside(?: dhaka)?|within dhaka|dhaka city|dhakar moddhe|ঢাকার মধ্যে|ঢাকার ভিতরে)[^\d]{0,30}(\d[\d,]*)\s*(?:bdt)?/i);
    const outside = text.match(/(?:outside(?: dhaka)?|dhakar baire|ঢাকার বাইরে)[^\d]{0,30}(\d[\d,]*)\s*(?:bdt)?/i);
    const eta = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(business\s*)?(day|days|দিন|diner?)/i);
    if (inside) facts.push({ subject: 'delivery_inside_dhaka', predicate: 'charge', value: numberValue(inside[1]), unit: 'BDT', confidence: 'confirmed' });
    if (outside) facts.push({ subject: 'delivery_outside_dhaka', predicate: 'charge', value: numberValue(outside[1]), unit: 'BDT', confidence: 'confirmed' });
    if (eta) facts.push({ subject: 'delivery', predicate: 'estimated_time', value: `${eta[1]}-${eta[2]} ${eta[3] ? 'business ' : ''}days`, confidence: 'confirmed' });
    if (/\bcod\b|cash on delivery|ক্যাশ অন ডেলিভারি/i.test(text)) facts.push({ subject: 'payment', predicate: 'cod_available', value: !/(?:no|not|unavailable|নেই)\s+(?:cod|cash on delivery)/i.test(text), confidence: 'confirmed' });
    return facts;
}

function serviceFacts(text: string): StructuredFact[] {
    const facts: StructuredFact[] = [];
    const concepts = presentConcepts(text);
    if (concepts.includes('canada')) facts.push({ subject: 'service', predicate: 'country', value: 'Canada', confidence: 'confirmed' });
    if (concepts.includes('study')) facts.push({ subject: 'service', predicate: 'visa_type', value: 'student', confidence: 'confirmed' });
    if (concepts.includes('masters')) facts.push({ subject: 'service', predicate: 'study_level', value: 'masters', confidence: 'confirmed' });
    const serviceFee = text.match(/service fee[^\d]{0,20}(\d[\d,]*)\s*(?:bdt)?/i);
    const officialFee = text.match(/(?:official|government) fee[^\d]{0,20}(\d[\d,]*)\s*(?:bdt)?/i);
    const timeline = text.match(/(?:processing|process|timeline)[^\d]{0,20}(\d+)\s*[-–]\s*(\d+)\s*(days?|weeks?|months?)/i);
    if (serviceFee) facts.push({ subject: 'service', predicate: 'merchant_fee', value: numberValue(serviceFee[1]), unit: 'BDT', confidence: 'confirmed' });
    if (officialFee) facts.push({ subject: 'service', predicate: 'official_fee', value: numberValue(officialFee[1]), unit: 'BDT', confidence: 'confirmed' });
    if (timeline) facts.push({ subject: 'service', predicate: 'stated_timeline', value: `${timeline[1]}-${timeline[2]} ${timeline[3]}`, confidence: 'confirmed' });
    return facts;
}

function sourceHash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify({ profileVersion: 1, value })).digest('hex');
}

export function buildProductSearchProfile(product: Record<string, any>): SearchProfile {
    const source = {
        name: product.name,
        description: product.description,
        brand: product.brand,
        specs: product.specs,
        compatibilityTags: product.compatibilityTags,
        variants: (product.variants || []).map((variant: any) => ({ name: variant.name, specs: variant.specs })),
    };
    const text = cleanText(JSON.stringify(source));
    const colors = presentConcepts(text, COLOR_KEYS);
    const categories = presentConcepts(text, CATEGORY_KEYS);
    const materials = extractMaterials(text);
    const sizes = extractSizes(text);
    const useCases = extractUseCases(text);
    const facts: StructuredFact[] = [
        ...colors.map((value) => ({ subject: 'product', predicate: 'color', value, confidence: 'confirmed' as const })),
        ...sizes.map((value) => ({ subject: 'product', predicate: 'size', value, confidence: 'confirmed' as const })),
        ...materials.map((value) => ({ subject: 'product', predicate: 'material', value, confidence: 'confirmed' as const })),
        ...useCases.map((value) => ({ subject: 'product', predicate: 'use_case', value, confidence: 'confirmed' as const })),
    ];
    return { profileVersion: 1, searchableText: text, terms: expandConcepts(text), colors, sizes, materials, categories, useCases, facts, riskLevel: 'normal', sourceHash: sourceHash(source) };
}

export function buildKnowledgeSearchProfile(entry: Record<string, any>): SearchProfile {
    const source = { title: entry.title, content: entry.content, tags: entry.tags, type: entry.type };
    const text = cleanText(JSON.stringify(source));
    const highRisk = /visa|ভিসা|legal|আইন|medical|চিকিৎসা|loan|investment|finance|eligib|যোগ্যতা/i.test(text);
    return {
        profileVersion: 1,
        searchableText: text,
        terms: expandConcepts(text),
        colors: [], sizes: [], materials: [], categories: [], useCases: extractUseCases(text),
        facts: [...deliveryFacts(text), ...serviceFacts(text)],
        riskLevel: highRisk ? 'high' : 'normal',
        sourceHash: sourceHash(source),
    };
}

export function understandQuery(value: unknown): QueryIntelligence {
    const normalizedText = cleanText(value);
    const concepts = presentConcepts(normalizedText);
    const visa = concepts.includes('visa') || concepts.includes('study') || concepts.includes('canada');
    return {
        normalizedText,
        terms: expandConcepts(normalizedText),
        colors: concepts.filter((value) => COLOR_KEYS.includes(value)),
        sizes: extractSizes(normalizedText),
        categories: concepts.filter((value) => CATEGORY_KEYS.includes(value)),
        materials: extractMaterials(normalizedText),
        useCases: extractUseCases(normalizedText),
        budgetMax: parseBudget(value),
        comparison: /compare|comparison|difference|different|পার্থক্য|তফাৎ|difference ki|differ/i.test(normalizedText),
        serviceIntent: visa ? {
            country: concepts.includes('canada') ? 'Canada' : undefined,
            visaType: concepts.includes('study') || concepts.includes('masters') ? 'student' : undefined,
            studyLevel: concepts.includes('masters') ? 'masters' : undefined,
        } : undefined,
        highStakes: visa || /legal|medical|financial|loan|investment|আইন|চিকিৎসা/i.test(normalizedText),
    };
}

export function productMatchesConstraints(product: Record<string, any>, query: QueryIntelligence): boolean {
    const profile = product.intelligence || buildProductSearchProfile(product);
    const price = product.salePrice ?? product.basePrice;
    if (query.budgetMax !== undefined && (!Number.isFinite(price) || price > query.budgetMax)) return false;
    if (query.colors.length && !query.colors.some((color) => profile.colors?.includes(color))) return false;
    if (query.sizes.length && !query.sizes.some((size) => profile.sizes?.includes(size))) return false;
    if (query.categories.length && !query.categories.some((category) => profile.categories?.includes(category))) return false;
    if (query.materials.length && !query.materials.some((material) => profile.materials?.includes(material))) return false;
    // A comfort/hot-weather request only matches when the merchant supplied a relevant
    // use-case/feature such as lightweight or breathable. Material alone is not a benefit claim.
    if (query.useCases.includes('hot_weather') && !['hot_weather', 'lightweight', 'breathable'].some((useCase) => profile.useCases?.includes(useCase))) return false;
    return true;
}

export function scoreProductMatch(product: Record<string, any>, query: QueryIntelligence): number {
    const profile = product.intelligence || buildProductSearchProfile(product);
    const terms = new Set(profile.terms || []);
    let score = query.terms.filter((term) => terms.has(term)).length;
    score += query.colors.filter((value) => profile.colors?.includes(value)).length * 5;
    score += query.sizes.filter((value) => profile.sizes?.includes(value)).length * 5;
    score += query.categories.filter((value) => profile.categories?.includes(value)).length * 4;
    score += query.materials.filter((value) => profile.materials?.includes(value)).length * 3;
    score += query.useCases.filter((value) => profile.useCases?.includes(value)).length * 4;
    if (product.stock > 0 || (product.variants || []).some((variant: any) => variant.isActive !== false && variant.stock > 0)) score += 1;
    return score;
}

export function scoreKnowledgeMatch(entry: Record<string, any>, query: QueryIntelligence): number {
    const profile = entry.intelligence || buildKnowledgeSearchProfile(entry);
    const terms = new Set(profile.terms || []);
    return query.terms.filter((term) => terms.has(term)).length + (entry.isPinned ? 2 : 0) + (entry.sourcePriority === 'high' ? 1 : 0);
}

export function compareCanonicalProducts(products: Record<string, any>[]): Array<{ field: string; products: Array<{ name: string; value: unknown }> }> {
    const selected = products.slice(0, 3);
    if (selected.length < 2) return [];
    const fields: Array<[string, (product: Record<string, any>) => unknown]> = [
        ['price', (product) => product.salePrice ?? product.basePrice],
        ['stock', (product) => product.stock],
        ['availability', (product) => product.availability],
        ['materials', (product) => (product.intelligence || buildProductSearchProfile(product)).materials],
        ['colors', (product) => (product.intelligence || buildProductSearchProfile(product)).colors],
        ['sizes', (product) => (product.intelligence || buildProductSearchProfile(product)).sizes],
    ];
    return fields.map(([field, read]) => ({ field, products: selected.map((product) => ({ name: refineDisplayText(product.name), value: read(product) })) }))
        .filter((difference) => new Set(difference.products.map((product) => JSON.stringify(product.value))).size > 1);
}
