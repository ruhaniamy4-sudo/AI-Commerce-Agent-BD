import { describe, expect, it } from 'vitest';
import { classifyLightweightIntent } from './turn-routing.service';
import { extractLabelledDetails, quantityFrom, quantitySetFrom, quantityIncrementFrom, areaFrom } from './order-flow.service';

/**
 * The ways customers actually write, collected from real chats that fell through
 * to the model. Each one used to cost a full prompt; several also answered wrongly
 * once they were free, so the assertions check what was understood, not just that
 * something came back.
 */

describe('asking for a product', () => {
    const asks = [
        'powerbank needed',
        'power bank please',
        'I am looking for a power bank',
        'do you have power banks?',
        'any power bank available?',
        'need a mug',
        'মগ লাগবে',
        'mug lagbe',
    ];
    for (const text of asks) {
        it(`reads "${text}" as shopping`, () => {
            expect(['PRODUCT_SEARCH', 'PRODUCT_STOCK', 'CATALOG_BROWSE']).toContain(classifyLightweightIntent(text));
        });
    }

    it('does not read a browse as a delivery or order question', () => {
        expect(classifyLightweightIntent('send me the price list')).toBe('CATALOG_BROWSE');
    });
});

describe('how many', () => {
    it('reads a plain count with its counter word', () => {
        expect(quantityFrom('2 pieces')).toBe(2);
        expect(quantityFrom('eta 2 ta nibo')).toBe(2);
        // `\b` is ASCII-only, so "2 টা নিব" used to match nothing and ship one.
        expect(quantityFrom('2 টা নিব')).toBe(2);
        expect(quantityFrom('একটা নিব')).toBe(1);
    });

    it('separates setting a count from adding to it', () => {
        expect(quantitySetFrom('actually make it 3')).toBe(3);
        expect(quantitySetFrom('change quantity to 2')).toBe(2);
        expect(quantitySetFrom('3 ta koren')).toBe(3);
        expect(quantitySetFrom('aro ekta den')).toBeUndefined();
        expect(quantityIncrementFrom('aro ekta den')).toBe(1);
    });

    it('does not read a product code as a count', () => {
        // "CER-CAF6 ta nibo" once ordered six.
        expect(quantityFrom('CER-CAF6 ta nibo')).toBeUndefined();
    });
});

describe('delivery details on one line', () => {
    it('reads name, phone and address separated only by commas', () => {
        const details = extractLabelledDetails('Rafiul Islam Sifat, 01632149759, Agargaon');
        expect(details.fullName).toBe('Rafiul Islam Sifat');
        expect(details.phone).toBe('01632149759');
        expect(details.addressLine1).toBe('Agargaon');
    });

    it('reads the same line written with slashes or dashes', () => {
        expect(extractLabelledDetails('Rafiul Islam / 01632149759 / Mirpur 10, Dhaka')).toMatchObject({
            fullName: 'Rafiul Islam', phone: '01632149759',
        });
        expect(extractLabelledDetails('Rafiul Islam - 01632149759 - Dhanmondi 32')).toMatchObject({
            fullName: 'Rafiul Islam', phone: '01632149759',
        });
    });

    it('reads labels that carry no punctuation', () => {
        expect(extractLabelledDetails('name Rafiul phone 01632149759 address Uttara 7')).toMatchObject({
            fullName: 'Rafiul', phone: '01632149759', addressLine1: 'Uttara 7',
        });
    });

    it('does not carve up a request to reuse the saved address', () => {
        // "ager address e pathan" once produced an address of "e pathan".
        const details = extractLabelledDetails('amar ager address e pathan');
        expect(details.addressLine1).toBeUndefined();
        expect(details.fullName).toBeUndefined();
    });

    it('leaves an ordinary sentence alone', () => {
        expect(extractLabelledDetails('when will I get it?')).toMatchObject({
            fullName: undefined, phone: undefined, addressLine1: undefined,
        });
    });

    it('knows the Dhaka areas written in Bangla', () => {
        expect(areaFrom('আগারগাঁও')).toMatchObject({ city: 'Dhaka' });
        expect(areaFrom('মিরপুর 10')).toMatchObject({ city: 'Dhaka' });
        expect(areaFrom('Agargaon')).toMatchObject({ city: 'Dhaka' });
    });
});

describe('questions that must not become orders', () => {
    const questions = [
        'when will I get it?',
        'can I get it tomorrow?',
        'how many can I order?',
        'how much will 2 pieces cost?',
    ];
    for (const text of questions) {
        it(`keeps "${text}" a question`, () => {
            // Each of these carries a buying verb — "get it", "order", "take" —
            // and a loose pattern once turned them into a fresh checkout.
            expect(classifyLightweightIntent(text)).not.toBe('ORDER_FLOW');
        });
    }
});
