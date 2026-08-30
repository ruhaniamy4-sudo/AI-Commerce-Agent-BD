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

    it('answers a Banglish parcel question from real courier data without an AI request or invented ETA', async () => {
        vi.spyOn(Order, 'findOne').mockReturnValue({
            sort: () => ({
                select: () => ({ lean: () => Promise.resolve({
                    orderNumber: 'ORD-ABC123', status: 'confirmed',
                    courier: { status: 'in_transit', trackingCode: 'TRACK123' },
                }) }),
            }),
        } as never);

        const response = await asTenant(() => getDeterministicResponse(businessId, 'amar parcel koi?', { psid: 'customer-1' }));
        expect(response).toBe('Order #ORD-ABC123 is currently in transit. Tracking code: TRACK123.');
        expect(response).not.toMatch(/ETA|arrive|tomorrow/i);
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
            .resolves.toBe('Safe Product is ৳1500, with 4 currently in stock.');
    });

    it('answers a direct AI identity question truthfully without claiming to be human', async () => {
        const response = await asTenant(() => getDeterministicResponse(businessId, 'Are you an AI or human?'));
        expect(response).toContain('automated SellPilot assistant');
        expect(response).not.toMatch(/I am human|human employee/i);
    });
});
