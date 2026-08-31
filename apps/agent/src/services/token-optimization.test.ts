import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from '../agent/prompts';
import { classifyLightweightIntent, extractBudget, extractLightweightMemory, parseSearchTerms } from './turn-routing.service';

describe('token optimized routing', () => {
    it.each([
        ['Zeblaze Vibe 7 Pro er price koto?', 'PRODUCT_PRICE'], ['picture deo', 'PRODUCT_IMAGE'], ['stock ache?', 'PRODUCT_STOCK'],
        ['5000 er moddhe smartwatch dekhaw', 'PRODUCT_SEARCH'], ['egular moddhe konta better?', 'PRODUCT_COMPARE'],
        ['delivery charge koto?', 'BUSINESS_FACT'], ['return policy ta details e explain koren', 'KNOWLEDGE'],
        ['SSC 27 science batch fee?', 'PRODUCT_PRICE'], ['Canada student visa eligibility/process ki?', 'KNOWLEDGE'],
    ])('routes %s without an intent LLM call', (message, intent) => expect(classifyLightweightIntent(message)).toBe(intent));

    it('extracts budget and useful search terms deterministically', () => {
        expect(extractBudget('5000 er moddhe smartwatch dekhaw')).toBe(5000);
        expect(parseSearchTerms('Zeblaze Vibe 7 Pro er price koto?')).toEqual(['zeblaze','vibe','pro']);
    });

    it('persists compact service-business entities without summarization', () => {
        expect(extractLightweightMemory('Canada student visa niye jante chai')).toMatchObject({ activeCountry: 'Canada', activeVisaType: 'student visa', detectedLanguage: 'banglish' });
        expect(extractLightweightMemory('SSC 27 science batch fee?')).toMatchObject({ activeCourse: 'SSC' });
    });

    it('keeps the static system prompt compact', () => {
        expect(Math.ceil(SYSTEM_PROMPT.length / 4)).toBeLessThan(400);
        expect(SYSTEM_PROMPT).not.toContain('EXAMPLE BEHAVIORS');
        expect(SYSTEM_PROMPT).not.toContain('ORDER SUMMARY TEMPLATE');
    });
});
