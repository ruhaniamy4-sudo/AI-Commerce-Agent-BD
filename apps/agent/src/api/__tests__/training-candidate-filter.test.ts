import { describe, expect, it } from 'vitest';
import { candidateFilter } from '../training.routes';

describe('training candidate review filters', () => {
    it.each(['in_stock', 'out_of_stock', 'unknown'])('scopes the %s availability filter to normalized candidate availability', (availability) => {
        expect(candidateFilter({ kind: 'product', availability })).toMatchObject({ kind: 'product', 'payload.availability': availability });
    });

    it('combines search, category, status, and availability for filtered selection', () => {
        const filter = candidateFilter({ kind: 'product', search: 'Kurti', category: 'Women', status: 'ready', availability: 'in_stock' });
        expect(filter).toMatchObject({ kind: 'product', status: 'ready', 'payload.category': 'Women', 'payload.availability': 'in_stock' });
        expect(filter.$or).toHaveLength(2);
    });

    it('maps the merchant Approved filter to the existing imported state', () => {
        expect(candidateFilter({ status: 'approved' })).toMatchObject({ status: 'imported' });
    });

    it('limits bulk approval to ready candidates so hidden failed or out-of-stock records are not included', () => {
        expect(candidateFilter({ kind: 'product', availability: 'in_stock' }, { approvable: true })).toEqual({ kind: 'product', 'payload.availability': 'in_stock', status: 'ready' });
    });
});
