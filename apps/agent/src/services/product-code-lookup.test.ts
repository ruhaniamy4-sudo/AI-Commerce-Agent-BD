import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveProductCode, Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { findByQuotedCode, productCode } from './product-card';

/**
 * Every product listing ends with "name বা code-টি বললে আমি order-টা করে দিচ্ছি".
 * The code on screen has to be the code the lookup answers to, whether the
 * merchant stored one or `productCode` derived it — a bulk-imported catalog
 * stores one for almost nothing, and quoting the printed code dropped the
 * customer back into "which one did you mean?".
 */

const businessId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId();
// Exactly how a bulk import lands: no publicCode, no barcode.
const imported = { _id: productId, name: 'Power Bank 20000mAh', basePrice: 2600, currency: 'BDT', stock: 28, availability: 'in_stock', variants: [] };

const run = <T>(work: () => Promise<T>) => withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, work);
const storedMiss = () => vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(null) }) } as never);
const derivedHit = (rows: unknown[]) => vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: () => Promise.resolve(rows) }) }) } as never);

afterEach(() => vi.restoreAllMocks());

describe('a customer can order by the code we printed', () => {
    it('resolves a code that was derived at render time', async () => {
        const shown = productCode(imported);
        expect(shown).toBe(deriveProductCode(imported.name, productId));

        storedMiss();
        const find = derivedHit([imported]);
        const found = await run(() => findByQuotedCode(businessId, shown));

        expect(found).toMatchObject({ name: 'Power Bank 20000mAh' });
        // Narrowed by the id suffix the derivation ends in, not a full scan.
        expect(JSON.stringify(find.mock.calls[0][0]).toLowerCase()).toContain(String(productId).slice(-5).toLowerCase());
    });

    it('accepts the code however the customer typed it', async () => {
        storedMiss();
        derivedHit([imported]);
        const found = await run(() => findByQuotedCode(businessId, productCode(imported).toLowerCase()));
        expect(found).toMatchObject({ name: 'Power Bank 20000mAh' });
    });

    it('never answers with a product whose code does not actually match', async () => {
        // Two ids can share a suffix; the full derived code is what confirms it.
        storedMiss();
        derivedHit([{ ...imported, name: 'Smart Watch X2' }]);
        expect(await run(() => findByQuotedCode(businessId, productCode(imported)))).toBeNull();
    });

    it('does not go looking when the code is not one of ours', async () => {
        storedMiss();
        const find = derivedHit([]);
        expect(await run(() => findByQuotedCode(businessId, 'JUSTTEXT'))).toBeNull();
        expect(find).not.toHaveBeenCalled();
    });

    it('takes the stored code first, without the derived lookup', async () => {
        const stored = { ...imported, publicCode: 'POW-2769B' };
        vi.spyOn(Product, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve(stored) }) } as never);
        const find = derivedHit([]);
        expect(await run(() => findByQuotedCode(businessId, 'POW-2769B'))).toMatchObject({ publicCode: 'POW-2769B' });
        expect(find).not.toHaveBeenCalled();
    });
});
