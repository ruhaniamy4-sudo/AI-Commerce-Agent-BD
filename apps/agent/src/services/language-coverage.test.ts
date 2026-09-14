import { describe, expect, it } from 'vitest';
import { classifyLightweightIntent, detectExplicitLanguagePreference, detectLightweightLanguage, isSpecRefinement, normalizeDigits, parseSearchTerms } from './turn-routing.service';
import { detectConversationLanguage, resolveConversationLanguage } from './conversation-intelligence.service';
import { phoneticallyMatches, termAlternatives, transliterateBangla } from './bangla-terms';
import { termMatchScore } from './product-card';
import { phoneFrom, quantityFrom } from './order-flow.service';

/**
 * Banglish was tuned first and answered for free; English and Bangla fell through
 * to the model for the same questions. These pin down the three things that were
 * actually wrong, so a future edit cannot quietly undo them.
 */

describe('a Bangla keyword has to start a word', () => {
    it('does not read a name as a price question', () => {
        // "ফি" (fee) sits inside "রফিউল", and \b knows nothing about Bangla, so a
        // customer answering with their own name was routed to the price answer
        // and the whole checkout stalled at "what is your name?".
        expect(classifyLightweightIntent('রফিউল ইসলাম')).toBe('GENERAL_CONVERSATION');
        expect(classifyLightweightIntent('নাফিসা আক্তার')).toBe('GENERAL_CONVERSATION');
    });

    it('still matches a keyword that merely carries a suffix', () => {
        // Bangla glues its endings on, so anchoring the start is the only option.
        expect(classifyLightweightIntent('দামটা কত?')).toBe('PRODUCT_PRICE');
        expect(classifyLightweightIntent('ডেলিভারি চার্জ কত?')).toBe('BUSINESS_FACT');
        expect(classifyLightweightIntent('স্টকে আছে?')).toBe('PRODUCT_STOCK');
    });
});

describe('the same question in three languages reaches the same answer', () => {
    const cases: Array<[string, string, string, string]> = [
        ['shopping', 'I need a power bank', 'আমার একটা পাওয়ার ব্যাংক লাগবে', 'PRODUCT_SEARCH'],
        ['browsing', 'show me what products you have got', 'কি কি প্রোডাক্ট আছে?', 'CATALOG_BROWSE'],
        ['delivery area', 'do you deliver to Dhaka?', 'ঢাকায় ডেলিভারি হয়?', 'BUSINESS_FACT'],
        ['delivery time', 'when will I get it?', 'কবে পাবো?', 'BUSINESS_FACT'],
        ['order status', 'what is my order status?', 'আমার অর্ডার স্ট্যাটাস কি?', 'ORDER_STATUS'],
    ];
    for (const [label, english, bangla, expected] of cases) {
        it(`routes ${label} the same way`, () => {
            expect(classifyLightweightIntent(english)).toBe(expected);
            expect(classifyLightweightIntent(bangla)).toBe(expected);
        });
    }

    it('treats a bare measurement as the answer to "which one?"', () => {
        expect(isSpecRefinement('20000 mah')).toBe(true);
        expect(isSpecRefinement('64gb')).toBe(true);
        expect(classifyLightweightIntent('20000 mah')).toBe('PRODUCT_SEARCH');
        // A phone number and a quantity are not specifications.
        expect(isSpecRefinement('01712345678')).toBe(false);
        expect(isSpecRefinement('2 ta')).toBe(false);
    });
});

describe('Bangla numerals are numbers', () => {
    it('reads a phone number written in Bangla digits', () => {
        expect(normalizeDigits('০১৭১২৩৪৫৬৭৮')).toBe('01712345678');
        expect(phoneFrom(normalizeDigits('আমার নাম্বার ০১৭১২৩৪৫৬৭৮'))).toBe('01712345678');
    });

    it('reads a quantity and an address written in Bangla digits', () => {
        expect(quantityFrom(normalizeDigits('২ টা নিব'))).toBe(2);
        expect(normalizeDigits('মিরপুর ১০, ঢাকা')).toBe('মিরপুর 10, ঢাকা');
    });
});

describe('a Bangla word finds a Latin catalog entry', () => {
    it('knows what the shop calls the thing', () => {
        expect(termAlternatives('মগ')).toContain('mug');
        expect(termAlternatives('হেডফোন')).toContain('headphone');
        expect(termAlternatives('ব্যাংক')).toContain('bank');
        expect(termAlternatives('জুতা')).toContain('shoe');
    });

    it('strips the article Bangla attaches to the word', () => {
        expect(termAlternatives('মগটা')).toContain('mug');
        expect(termAlternatives('ঘড়িটি')).toContain('watch');
    });

    it('falls back to how the word sounds when it is not in the vocabulary', () => {
        expect(transliterateBangla('হেডফোন')).toBe('hedfon');
        expect(phoneticallyMatches('Bluetooth Headphones', 'হেডফোন')).toBe(true);
        expect(phoneticallyMatches('Ceramic Mug', 'হেডফোন')).toBe(false);
    });

    it('scores a Latin product against the Bangla the customer typed', () => {
        const product = { name: 'Power Bank 20000mAh', description: 'Fast charging' };
        expect(termMatchScore(product, ['পাওয়ার'])).toBeGreaterThan(0);
        expect(termMatchScore(product, ['ব্যাংক'])).toBeGreaterThan(0);
        expect(termMatchScore(product, ['শাড়ি'])).toBe(0);
    });

    it('leaves English terms exactly as they were', () => {
        expect(termAlternatives('mug')).toEqual(['mug']);
        expect(termMatchScore({ name: 'Ceramic Mug' }, ['mug'])).toBe(3);
    });
});

describe('a Bangla question word is not a product name', () => {
    it('does not search for the question itself', () => {
        // "দুঃখিত, দাম কত এই মুহূর্তে আমাদের কাছে নেই" — the shop apologising for
        // not stocking the words the customer just typed.
        expect(parseSearchTerms('দাম কত?')).toEqual([]);
        expect(parseSearchTerms('স্টকে আছে?')).toEqual([]);
        expect(parseSearchTerms('Hello I need a power bank')).toEqual(['power', 'bank']);
    });
});

describe('the reply stays in the language the customer used', () => {
    it('does not switch to Banglish because a payment brand was named', () => {
        // "can I pay with bKash?" is an English sentence; bKash is just what the
        // service is called. It used to be answered entirely in Banglish.
        expect(detectLightweightLanguage('can I pay with bKash?')).toBe('en');
        expect(detectConversationLanguage('can I pay with bKash?')).toBe('en');
        expect(resolveConversationLanguage('can I pay with bKash?', 'banglish')).toBe('en');
    });

    it('still recognises a genuinely Banglish sentence', () => {
        expect(detectConversationLanguage('bikash e payment kora jabe?')).toBe('banglish');
        expect(detectLightweightLanguage('amar ekta power bank lagbe')).toBe('banglish');
    });
});

describe('naming a language is not the same as asking for it', () => {
    it('does not hear a product question as "reply in English"', () => {
        // The whole instruction half of the pattern was optional, so the bare word
        // "english" anywhere in a sentence returned 'en' and the customer's actual
        // question was replaced by "Sure - I'll reply in English."
        expect(detectExplicitLanguagePreference('do you have an english keyboard?')).toBeUndefined();
        expect(detectExplicitLanguagePreference('english book ache?')).toBeUndefined();
        expect(detectExplicitLanguagePreference('English medium er boi lagbe')).toBeUndefined();
    });

    it('still hears a real request to switch language', () => {
        expect(detectExplicitLanguagePreference('Please explain this in English now')).toBe('en');
        expect(detectExplicitLanguagePreference('english e bolen please')).toBe('en');
        expect(detectExplicitLanguagePreference('english please')).toBe('en');
        expect(detectExplicitLanguagePreference('bangla te bolen')).toBe('bn');
        expect(detectExplicitLanguagePreference('বাংলায় বলুন')).toBe('bn');
        expect(detectExplicitLanguagePreference('banglish e reply koren')).toBe('banglish');
    });

    it('does not read "Bangladesh" as a request for Bangla', () => {
        expect(detectExplicitLanguagePreference('Bangladesh er baire pathan please')).toBeUndefined();
    });
});

describe('a Bangla sentence that quotes a Latin product name is still Bangla', () => {
    it('answers in Bangla rather than dropping to Banglish', () => {
        // 'mixed' is answered in Banglish. Detecting it from the mere presence of a
        // Latin word meant every Bangla customer asking about a Latin catalog entry
        // - which is most of the catalog - got Banglish from that turn onward.
        expect(detectConversationLanguage('Power Bank এর দাম কত?')).toBe('bn');
        expect(detectConversationLanguage('পাওয়ার ব্যাংক টা stock এ আছে কি?')).toBe('bn');
        // A genuinely half-and-half sentence is still mixed.
        expect(detectConversationLanguage('কালো color available?')).toBe('mixed');
    });

    it('keeps a Bangla thread in Bangla when one turn leans Latin', () => {
        expect(resolveConversationLanguage('কালো color available?', 'bn')).toBe('bn');
        // An English thread is not dragged into Bangla by the same sentence.
        expect(resolveConversationLanguage('কালো color available?', 'en')).toBe('mixed');
    });
});
