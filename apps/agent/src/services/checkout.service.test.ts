import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Order } from '../models/Order';
import { Customer } from '../models/Customer';
import { Product } from '../models/Product';
import { createOrderWithStock } from './checkout.service';
import { withTenantContext } from '../tenancy/context';

describe('order creation and stock safety', () => {
    const session = {
        withTransaction: vi.fn(async (work: () => Promise<void>) => work()),
        endSession: vi.fn(async () => undefined),
    };
    const customerId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const businessId = new mongoose.Types.ObjectId().toString();
    const asTenant = <T>(work: () => T) => withTenantContext({
        businessId,
        userId: new mongoose.Types.ObjectId().toString(),
        membershipId: new mongoose.Types.ObjectId().toString(),
        role: 'Owner',
    }, work);

    beforeEach(() => {
        vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
        vi.spyOn(Customer, 'findById').mockReturnValue({
            session: vi.fn().mockResolvedValue({ _id: customerId }),
        } as never);
        vi.spyOn(Product, 'findOne').mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: productId,
                name: 'Baseline Product',
                slug: 'baseline-product',
                basePrice: 500,
                stock: 5,
                variants: [],
            }),
        } as never);
        vi.spyOn(Customer, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
        vi.spyOn(Order.prototype, 'save').mockImplementation(async function () {
            await this.validate();
            return this;
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it('generates an order number before required-field validation', async () => {
        const order = new Order({
            customerId,
            items: [{
                productId,
                productName: 'Baseline Product',
                sku: 'BASE-1',
                quantity: 1,
                unitPriceSnapshot: 500,
                subtotal: 500,
            }],
            subtotal: 500,
            deliveryFee: 0,
            discount: 0,
            total: 500,
            shippingAddress: {
                fullName: 'Test Customer',
                phone: '01700000000',
                addressLine1: 'Test address',
                city: 'Dhaka',
                zone: 'Dhaka North',
                country: 'Bangladesh',
            },
            paymentMethod: 'Cash on Delivery',
        });

        await asTenant(() => order.validate());
        expect(order.orderNumber).toMatch(/^ORD-/);
    });

    it('normalizes items and decrements stock exactly once on success', async () => {
        vi.spyOn(Product, 'findOneAndUpdate').mockResolvedValue({ _id: productId } as never);

        const order = await asTenant(() => createOrderWithStock({
            businessId,
            customerId,
            items: [{ productId, quantity: 2 }],
            shippingAddress: {
                fullName: 'Test Customer',
                phone: '01700000000',
                addressLine1: 'Test address',
                city: 'Dhaka',
                zone: 'Dhaka North',
                country: 'Bangladesh',
            },
        }));

        expect(Product.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(order.items[0].productName).toBe('Baseline Product');
        expect(order.items[0].subtotal).toBe(1000);
        expect(order.total).toBe(1000);
        expect(Order.prototype.save).toHaveBeenCalledTimes(1);
    });

    it('does not create an order when the conditional stock update fails', async () => {
        vi.spyOn(Product, 'findOneAndUpdate').mockResolvedValue(null);

        await expect(asTenant(() => createOrderWithStock({
            businessId,
            customerId,
            items: [{ productId, quantity: 99 }],
            shippingAddress: {
                fullName: 'Test Customer',
                phone: '01700000000',
                addressLine1: 'Test address',
                city: 'Dhaka',
                zone: 'Dhaka North',
                country: 'Bangladesh',
            },
        }))).rejects.toThrow('Insufficient stock');

        expect(Order.prototype.save).not.toHaveBeenCalled();
        expect(Customer.updateOne).not.toHaveBeenCalled();
    });
});
