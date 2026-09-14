import { describe, expect, it } from 'vitest';
import { classifyCourtesy, openingCourtesy, stripCourtesy } from './courtesy';
import { parseSearchTerms, normalizeDigits } from './turn-routing.service';

describe('politeness never reaches the catalog', () => {
    // The catalog search ANDs its terms. One greeting word left in the list is
    // the difference between two power banks in stock and "sorry, we do not have
    // আসসালামু আলাইকুম পাওয়ারব্যাংক".
    it.each([
        ['আসসালামু আলাইকুম। পাওয়ারব্যাংক আছে?', ['পাওয়ারব্যাংক']],
        ['আসসালামুআলাইকুম পাওয়ার ব্যাংক লাগবে', ['পাওয়ার', 'ব্যাংক']],
        ['assalamu alaikum, power bank ache?', ['power', 'bank']],
        ['assalamualaikum vai power bank ache?', ['power', 'bank']],
        ['নমস্কার ভাই, ইলেকট্রিক কেটলি আছে?', ['ইলেকট্রিক', 'কেটলি']],
        ['শুভ সকাল আপু, স্মার্ট ওয়াচ দেখান', ['স্মার্ট', 'ওয়াচ']],
        ['আদাব, স্মার্ট ওয়াচ এর দাম কত?', ['স্মার্ট', 'ওয়াচ']],
        ['good morning, electric kettle nibo', ['electric', 'kettle']],
        ['hello bhai, power bank ache?', ['power', 'bank']],
        ['কেমন আছেন? মগ আছে?', ['মগ']],
    ])('searches %s for the product alone', (message, expected) => {
        expect(parseSearchTerms(message)).toEqual(expected);
    });

    it('still answers a message that is only politeness as politeness', () => {
        expect(classifyCourtesy('আসসালামু আলাইকুম')).toBe('salaam');
        expect(classifyCourtesy('assalamu alaikum vai')).toBe('salaam');
        expect(classifyCourtesy('নমস্কার')).toBe('greeting');
        expect(classifyCourtesy('শুভ সকাল ভাই')).toBe('greeting');
        expect(classifyCourtesy('ধন্যবাদ ভাই')).toBe('thanks');
        // A greeting wrapped around a real question is not courtesy.
        expect(classifyCourtesy('আসসালামু আলাইকুম। পাওয়ারব্যাংক আছে?')).toBeUndefined();
    });

    it('knows the greeting a real question was wrapped in, so both get answered', () => {
        expect(openingCourtesy('আসসালামু আলাইকুম। পাওয়ারব্যাংক আছে?')).toBe('salaam');
        expect(openingCourtesy('assalamu alaikum vai, power bank ache?')).toBe('salaam');
        expect(openingCourtesy('নমস্কার ভাই, কেটলি আছে?')).toBe('greeting');
        expect(openingCourtesy('good morning, kettle ache?')).toBe('greeting');
        // No greeting at the front means nothing to return.
        expect(openingCourtesy('power bank ache?')).toBeUndefined();
        expect(openingCourtesy('power bank ache? thanks')).toBeUndefined();
    });

    it('leaves words that describe a product rather than address a person', () => {
        // "good", "nice" and "fine" are courtesy in "nice, thanks" but they also
        // describe things, so the stop-word list handles them, not this.
        expect(stripCourtesy('good quality power bank')).toContain('good quality power bank');
        expect(stripCourtesy('vai amar ekta mug lagbe')).not.toMatch(/vai/);
    });
});

describe('which token is the product and which is the count', () => {
    it.each([
        ['২টা পাওয়ারব্যাংক দিন', ['পাওয়ারব্যাংক']],
        ['৩ টা ইলেকট্রিক কেটলি লাগবে', ['ইলেকট্রিক', 'কেটলি']],
        ['পাওয়ারব্যাংক ২টি নিব', ['পাওয়ারব্যাংক']],
        ['2 ta power bank nibo', ['power', 'bank']],
        ['duita mug lagbe', ['mug']],
    ])('reads %s as a count plus a product name', (message, expected) => {
        expect(parseSearchTerms(normalizeDigits(message))).toEqual(expected);
    });

    it('does not mistake a specification for a count', () => {
        // "20000mAh" is how the customer tells two power banks apart.
        expect(parseSearchTerms('power bank 20000mah')).toContain('20000mah');
        expect(parseSearchTerms('64gb memory card')).toContain('64gb');
    });
});
