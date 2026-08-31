import { describe, expect, it } from 'vitest';
import { normalizeProductAvailability } from './product-availability';

describe('product availability normalization', () => {
    it.each([
        ['https://schema.org/InStock', undefined, 'in_stock'],
        ['https://schema.org/OutOfStock', undefined, 'out_of_stock'],
        ['Sold Out', undefined, 'out_of_stock'],
        [undefined, 4, 'in_stock'],
        [undefined, 0, 'out_of_stock'],
        [undefined, undefined, 'unknown'],
    ])('maps %s with stock %s to %s', (source, stock, expected) => {
        expect(normalizeProductAvailability(source, stock)).toBe(expected);
    });

    it('never treats missing availability as in stock', () => {
        expect(normalizeProductAvailability(undefined)).toBe('unknown');
    });
});
