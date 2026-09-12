import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from '../agent/prompts';
import { enforceContextBudget, formatContextPack } from './rag.service';
import { classifyLightweightIntent, extractBudget, extractLightweightMemory, parseSearchTerms } from './turn-routing.service';

describe('token optimized routing', () => {
    it.each([
        ['Zeblaze Vibe 7 Pro er price koto?', 'PRODUCT_PRICE'], ['picture deo', 'PRODUCT_IMAGE'], ['stock ache?', 'PRODUCT_STOCK'],
        ['5000 er moddhe smartwatch dekhaw', 'PRODUCT_SEARCH'], ['egular moddhe konta better?', 'PRODUCT_COMPARE'],
        ['delivery charge koto?', 'BUSINESS_FACT'], ['return policy ta details e explain koren', 'KNOWLEDGE'],
        ['SSC 27 science batch fee?', 'PRODUCT_PRICE'], ['Canada student visa eligibility/process ki?', 'KNOWLEDGE'],
        ['ki ki product ache?', 'CATALOG_BROWSE'], ['shob gula product list dekhan', 'CATALOG_BROWSE'],
        ['what do you sell?', 'CATALOG_BROWSE'], ['আপনাদের কি কি আছে?', 'CATALOG_BROWSE'],
        ['সব প্রোডাক্ট দেখান', 'CATALOG_BROWSE'], ['collection ta dekhan', 'CATALOG_BROWSE'],
        ['amar mug lagbe. 1 ta', 'PRODUCT_SEARCH'], ['amar ekta headphone lagbe', 'PRODUCT_SEARCH'],
        ['ekta coffee mug dorkar', 'PRODUCT_SEARCH'], ['support number ta den', 'BUSINESS_FACT'],
    ])('routes %s without an intent LLM call', (message, intent) => expect(classifyLightweightIntent(message)).toBe(intent));

    it('extracts budget and useful search terms deterministically', () => {
        expect(extractBudget('5000 er moddhe smartwatch dekhaw')).toBe(5000);
        expect(parseSearchTerms('Zeblaze Vibe 7 Pro er price koto?')).toEqual(['zeblaze','vibe','pro']);
        // Pronouns and want-verbs are not product names.
        expect(parseSearchTerms('amar mug lagbe. 1 ta')).toEqual(['mug']);
        expect(parseSearchTerms('shob gula product list dekhan')).toEqual([]);
    });

    it('persists compact service-business entities without summarization', () => {
        expect(extractLightweightMemory('Canada student visa niye jante chai')).toMatchObject({ activeCountry: 'Canada', activeVisaType: 'student visa', detectedLanguage: 'banglish' });
        expect(extractLightweightMemory('SSC 27 science batch fee?')).toMatchObject({ activeCourse: 'SSC' });
    });

    it('keeps the per-turn context pack small enough to carry full product facts', () => {
        // Standing rules live in the system prompt; the pack carries only facts,
        // so a typical product turn must stay well inside its budget instead of
        // being truncated (which is how real stock and price used to get cut).
        const product = (name: string, code: string) => ({
            _id: code, name, publicCode: code, description: `${name} in premium finish for daily use.`,
            basePrice: 1200, salePrice: 999, stock: 14, availability: 'in_stock', brand: 'HouseBrand',
            aiSellingStatus: 'active', aiKnowledge: [{ question: 'Dishwasher safe?', answer: 'Yes.' }],
            variants: [{ name: 'White', sku: `${code}-W`, price: 999, stock: 7, isActive: true }],
            intelligence: { facts: ['ceramic', '350ml'], terms: ['mug'] }, _matchKind: 'constraint_match',
        });
        const pack = formatContextPack({
            businessId: 'b1',
            query: { terms: ['mug'], colors: [], sizes: [], categories: [], materials: [], useCases: [], comparison: false } as any,
            catalogHits: [product('Ceramic Coffee Mug', 'CER-9F2A'), product('Travel Mug Steel', 'TRA-1B3D')],
            offeringHits: [], knowledgeEntries: [], awarenessEntries: [],
            customerProfile: { name: 'Guest' }, lastOrders: [],
        } as any);
        expect(Math.ceil(pack.length / 4)).toBeLessThan(350);
        expect(enforceContextBudget(pack, 500)).toBe(pack);   // nothing is dropped at the real cap
        const parsed = JSON.parse(pack);
        expect(parsed.products[0]).toMatchObject({ code: 'CER-9F2A', price: 999, stock: 14 });
        expect(parsed.products[1].sales_guidance).toBeUndefined();   // pitch facts only for the best match
        expect(pack).not.toContain('CANONICAL_CURRENT_PRODUCT');     // constant labels moved to the prompt
    });

    it('keeps the static system prompt compact', () => {
        expect(Math.ceil(SYSTEM_PROMPT.length / 4)).toBeLessThan(400);
        expect(SYSTEM_PROMPT).toMatch(/Name, CODE, price/);      // messenger-ready plain text
        expect(SYSTEM_PROMPT).toMatch(/courteous/i);              // professional salesperson voice
        expect(SYSTEM_PROMPT).not.toContain('EXAMPLE BEHAVIORS');
        expect(SYSTEM_PROMPT).not.toContain('ORDER SUMMARY TEMPLATE');
    });
});
