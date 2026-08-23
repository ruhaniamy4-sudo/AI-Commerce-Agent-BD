import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from './deterministic-response.service';

const businessId = new mongoose.Types.ObjectId().toString();
const asTenant = <T>(work: () => T) => withTenantContext({
    businessId,
    userId: 'user',
    membershipId: 'membership',
    role: 'Staff',
}, work);

describe('deterministic responses', () => {
    afterEach(() => vi.restoreAllMocks());

    it('answers an exact order status without an AI request', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            select: () => ({ lean: () => Promise.resolve({ orderNumber: 'ABC123', status: 'shipped' }) }),
        } as never);

        await expect(asTenant(() => getDeterministicResponse(businessId, 'Where is order ABC123?')))
            .resolves.toBe('Order #ABC123 is currently shipped.');
    });

    it('answers exact SKU price and stock from backend data', async () => {
        vi.spyOn(Product, 'findOne').mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve({
                    name: 'Safe Product',
                    basePrice: 1500,
                    stock: 4,
                    variants: [],
                }),
            }),
        } as never);

        await expect(asTenant(() => getDeterministicResponse(businessId, 'price SKU-123')))
            .resolves.toBe('Safe Product is priced at 1500 and currently has 4 unit(s) in stock.');
    });
});
