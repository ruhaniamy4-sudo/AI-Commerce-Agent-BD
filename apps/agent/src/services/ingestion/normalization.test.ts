import { describe, expect, it } from 'vitest';
import { classifyProductSimilarity, knowledgeFact, normalizeCurrency, productKey } from './normalization';

describe('tenant-local ingestion normalization', () => {
    it('uses SKU and canonical URL as exact product signals', () => {
        expect(classifyProductSimilarity({ name: 'Polo', sku: ' abc 123 ' }, { name: 'Other wording', variants: [{ sku: 'ABC123' }] })).toBe('exact');
        expect(classifyProductSimilarity({ name: 'Polo', canonicalUrl: 'https://shop.test/polo?utm_source=fb' }, { name: 'Polo shirt', canonicalUrl: 'https://shop.test/polo' })).toBe('exact');
        expect(productKey({ name: 'Polo', sku: ' abc 123 ' })).toBe('sku:ABC123');
    });

    it('flags a strong name and price match as probable instead of auto-merging it', () => {
        expect(classifyProductSimilarity(
            { name: 'Premium Black Polo Shirt', price: 1490 },
            { name: 'Premium Black Polo Shirt for Men', basePrice: 1490 },
        )).toBe('probable');
    });

    it('normalizes equivalent Dhaka delivery facts', () => {
        expect(knowledgeFact('Inside Dhaka delivery fee is Tk 70.')).toBe(knowledgeFact('Dhaka delivery charge 70 taka'));
    });

    it('normalizes explicit currency evidence without applying a global symbol', () => {
        expect(normalizeCurrency('BDT')).toBe('BDT');
        expect(normalizeCurrency('৳3,690')).toBe('BDT');
        expect(normalizeCurrency('$19.99')).toBe('USD');
        expect(normalizeCurrency('3690')).toBeUndefined();
    });
});
