import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CourierIntegration } from '../models/CourierIntegration';
import { Order } from '../models/Order';
import { withTenantContext } from '../tenancy/context';
import {
    configureSteadfastIntegration,
    createCourierDelivery,
    mapOrderToSteadfast,
    syncCourierDelivery,
} from './courier.service';
import { CourierProvider, CourierProviderError } from './types';

const businessA = new mongoose.Types.ObjectId().toString();
const businessB = new mongoose.Types.ObjectId().toString();
const orderId = new mongoose.Types.ObjectId().toString();
const asBusinessA = <T>(work: () => T) => withTenantContext({
    businessId: businessA, userId: 'owner', membershipId: 'membership', role: 'Owner',
}, work);

const baseOrder = () => ({
    _id: new mongoose.Types.ObjectId(orderId),
    orderNumber: 'ORD-ABC123',
    status: 'confirmed',
    total: 1200,
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'pending',
    shippingAddress: {
        fullName: 'Raisa Ahmed', phone: '+8801712345678', addressLine1: 'House 1',
        city: 'Dhaka', zone: 'Dhanmondi', country: 'Bangladesh',
    },
    items: [{ productName: 'Backpack', quantity: 1 }],
    courier: undefined,
});

function connectedIntegration() {
    vi.spyOn(CourierIntegration, 'findOne').mockReturnValue({
        select: () => Promise.resolve({ _id: new mongoose.Types.ObjectId(), status: 'connected', settings: { deliveryType: 0 }, credentialsEncrypted: 'unused' }),
    } as never);
}

function provider(overrides: Partial<CourierProvider> = {}): CourierProvider {
    return {
        name: 'steadfast',
        validateCredentials: vi.fn().mockResolvedValue(true),
        createDelivery: vi.fn().mockResolvedValue({
            externalId: 'ORD-ABC123', consignmentId: '1424107', trackingCode: 'TRACK123', status: 'submitted', rawStatus: 'in_review',
        }),
        getDeliveryStatus: vi.fn().mockResolvedValue({ status: 'in_transit', rawStatus: 'pending' }),
        ...overrides,
    };
}

describe('courier delivery workflow', () => {
    beforeEach(() => { process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY = 'test-only-courier-key-with-32-characters'; });
    afterEach(() => vi.restoreAllMocks());

    it('deterministically maps approved order data without AI', () => {
        const mapped = mapOrderToSteadfast(baseOrder() as never, 0);
        expect(mapped).toMatchObject({
            reference: 'ORD-ABC123', recipientPhone: '01712345678', codAmount: 1200,
            recipientName: 'Raisa Ahmed', deliveryType: 0,
        });
    });

    it('rejects missing phone or address before calling Steadfast', () => {
        const order = baseOrder();
        order.shippingAddress.phone = '';
        expect(() => mapOrderToSteadfast(order as never, 0)).toThrow('valid Bangladesh');
        order.shippingAddress.phone = '01712345678';
        order.shippingAddress.addressLine1 = '';
        expect(() => mapOrderToSteadfast(order as never, 0)).toThrow('complete shipping address');
    });

    it('creates one delivery for an approved valid order and saves confirmed identifiers', async () => {
        const courierProvider = provider();
        connectedIntegration();
        vi.spyOn(Order, 'findById').mockResolvedValue(baseOrder() as never);
        vi.spyOn(Order, 'findOneAndUpdate')
            .mockResolvedValueOnce({ ...baseOrder(), courier: { creationStatus: 'creating' } } as never)
            .mockResolvedValueOnce({ ...baseOrder(), courier: {
                provider: 'steadfast', externalId: 'ORD-ABC123', consignmentId: '1424107', trackingCode: 'TRACK123',
                status: 'submitted', rawStatus: 'in_review', creationStatus: 'created', requestToken: 'token',
            } } as never);

        const result = await asBusinessA(() => createCourierDelivery({ businessId: businessA, orderId, provider: courierProvider }));
        expect(result).toMatchObject({ created: true, idempotent: false, courier: { consignmentId: '1424107' } });
        expect(courierProvider.createDelivery).toHaveBeenCalledTimes(1);
    });

    it('does not create a second consignment for an already-created order', async () => {
        const courierProvider = provider();
        vi.spyOn(Order, 'findById').mockResolvedValue({
            ...baseOrder(), courier: { provider: 'steadfast', externalId: 'ORD-ABC123', status: 'submitted', creationStatus: 'created' },
        } as never);
        const result = await asBusinessA(() => createCourierDelivery({ businessId: businessA, orderId, provider: courierProvider }));
        expect(result).toMatchObject({ created: false, idempotent: true });
        expect(courierProvider.createDelivery).not.toHaveBeenCalled();
    });

    it('rejects unapproved orders before provider access', async () => {
        const courierProvider = provider();
        vi.spyOn(Order, 'findById').mockResolvedValue({ ...baseOrder(), status: 'pending' } as never);
        await expect(asBusinessA(() => createCourierDelivery({ businessId: businessA, orderId, provider: courierProvider })))
            .rejects.toMatchObject({ code: 'order_not_approved' });
        expect(courierProvider.createDelivery).not.toHaveBeenCalled();
    });

    it('marks timeout outcomes uncertain without claiming success or retrying inline', async () => {
        const courierProvider = provider({
            createDelivery: vi.fn().mockRejectedValue(new CourierProviderError('transient', 'Steadfast is temporarily unavailable', false, true)),
        });
        connectedIntegration();
        vi.spyOn(Order, 'findById').mockResolvedValue(baseOrder() as never);
        vi.spyOn(Order, 'findOneAndUpdate').mockResolvedValue({ ...baseOrder(), courier: { creationStatus: 'creating' } } as never);
        const update = vi.spyOn(Order, 'updateOne').mockResolvedValue({ acknowledged: true } as never);
        await expect(asBusinessA(() => createCourierDelivery({ businessId: businessA, orderId, provider: courierProvider })))
            .rejects.toMatchObject({ code: 'transient' });
        expect(courierProvider.createDelivery).toHaveBeenCalledTimes(1);
        expect(update.mock.calls[0][1]).toMatchObject({ $set: { 'courier.creationStatus': 'uncertain', 'courier.status': 'failed' } });
    });

    it('fails closed before querying an order from another tenant context', async () => {
        const find = vi.spyOn(Order, 'findById');
        await expect(asBusinessA(() => createCourierDelivery({ businessId: businessB, orderId, provider: provider() })))
            .rejects.toThrow('mismatch');
        expect(find).not.toHaveBeenCalled();
    });

    it('does not sync a Business B order from Business A context', async () => {
        const find = vi.spyOn(Order, 'findById');
        await expect(asBusinessA(() => syncCourierDelivery({ businessId: businessB, orderId, provider: provider() })))
            .rejects.toThrow('mismatch');
        expect(find).not.toHaveBeenCalled();
    });

    it('syncs real courier state and only maps confirmed delivery to the commerce order', async () => {
        connectedIntegration();
        const courierProvider = provider({ getDeliveryStatus: vi.fn().mockResolvedValue({ status: 'delivered', rawStatus: 'delivered' }) });
        vi.spyOn(Order, 'findById').mockResolvedValue({ ...baseOrder(), courier: {
            provider: 'steadfast', externalId: 'ORD-ABC123', consignmentId: '1424107', status: 'in_transit', creationStatus: 'created',
        } } as never);
        const update = vi.spyOn(Order, 'findOneAndUpdate').mockResolvedValue({ ...baseOrder(), status: 'delivered', courier: {
            provider: 'steadfast', externalId: 'ORD-ABC123', status: 'delivered', creationStatus: 'created',
        } } as never);
        await asBusinessA(() => syncCourierDelivery({ businessId: businessA, orderId, provider: courierProvider }));
        expect(update.mock.calls[0][1]).toMatchObject({
            $set: { status: 'delivered', 'courier.status': 'delivered' },
            $push: { statusHistory: { status: 'delivered' } },
        });
    });

    it('rejects invalid credentials safely and never writes them', async () => {
        const courierProvider = provider({ validateCredentials: vi.fn().mockRejectedValue(new CourierProviderError('authentication', 'Steadfast credentials were rejected')) });
        const write = vi.spyOn(CourierIntegration, 'findOneAndUpdate');
        await expect(asBusinessA(() => configureSteadfastIntegration({ apiKey: 'key', secretKey: 'secret' }, courierProvider)))
            .rejects.toMatchObject({ code: 'authentication', message: 'Steadfast credentials were rejected' });
        expect(write).not.toHaveBeenCalled();
    });
});
