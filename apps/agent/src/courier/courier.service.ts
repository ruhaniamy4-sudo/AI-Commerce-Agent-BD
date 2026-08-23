import crypto from 'node:crypto';
import { CourierIntegration, ICourierIntegration } from '../models/CourierIntegration';
import { IOrder, Order } from '../models/Order';
import { assertTenantBusinessId, requireTenantContext } from '../tenancy/context';
import { normalizeBangladeshPhone } from './bangladesh-phone';
import { decryptCourierCredentials, encryptCourierCredentials } from './credentials';
import { HttpSteadfastClient } from './steadfast.client';
import { SteadfastCourierProvider } from './steadfast.provider';
import { CourierProvider, CourierProviderError, CreateDeliveryInput, safeCourierError } from './types';

export class CourierOperationError extends Error {
    constructor(
        message: string,
        public readonly statusCode = 400,
        public readonly code = 'courier_operation_failed',
        public readonly retryable = false,
    ) {
        super(message);
        this.name = 'CourierOperationError';
    }
}

export function serializeCourierIntegration(integration: Partial<ICourierIntegration> | null) {
    return {
        provider: 'steadfast' as const,
        configured: Boolean(integration),
        connected: integration?.status === 'connected',
        status: integration?.status || 'not_configured',
        deliveryType: integration?.settings?.deliveryType ?? 0,
        lastTestedAt: integration?.lastTestedAt,
        lastErrorCode: integration?.lastErrorCode,
    };
}

function providerFromIntegration(integration: ICourierIntegration): CourierProvider {
    const credentials = decryptCourierCredentials(integration.credentialsEncrypted);
    return new SteadfastCourierProvider(new HttpSteadfastClient(credentials));
}

async function configuredIntegration(requireConnected = true) {
    const integration = await CourierIntegration.findOne({ provider: 'steadfast' })
        .select('+credentialsEncrypted');
    if (!integration) throw new CourierOperationError('Steadfast integration is not configured', 409, 'integration_required');
    if (requireConnected && integration.status !== 'connected') {
        throw new CourierOperationError('Steadfast integration is not connected', 409, 'integration_not_connected');
    }
    return integration;
}

export async function getSteadfastIntegrationStatus() {
    const integration = await CourierIntegration.findOne({ provider: 'steadfast' }).lean();
    return serializeCourierIntegration(integration as Partial<ICourierIntegration> | null);
}

export async function configureSteadfastIntegration(input: {
    apiKey: string;
    secretKey: string;
    deliveryType?: 0 | 1;
}, providerOverride?: CourierProvider) {
    const apiKey = String(input.apiKey || '').trim();
    const secretKey = String(input.secretKey || '').trim();
    if (!apiKey || !secretKey) throw new CourierOperationError('API key and secret key are required');
    const credentials = { apiKey, secretKey };
    const encryptedCredentials = encryptCourierCredentials(credentials);
    const provider = providerOverride || new SteadfastCourierProvider(new HttpSteadfastClient(credentials));
    let valid = false;
    try {
        valid = await provider.validateCredentials();
    } catch (error) {
        const safe = safeCourierError(error);
        throw new CourierOperationError(safe.message, 400, safe.code);
    }
    if (!valid) throw new CourierOperationError('Steadfast credentials were rejected', 400, 'authentication');

    const integration = await CourierIntegration.findOneAndUpdate(
        { provider: 'steadfast' },
        {
            provider: 'steadfast',
            status: 'connected',
            credentialsEncrypted: encryptedCredentials,
            settings: { deliveryType: input.deliveryType ?? 0 },
            lastTestedAt: new Date(),
            $unset: { lastErrorCode: 1 },
        },
        { upsert: true, new: true, runValidators: true }
    );
    return serializeCourierIntegration(integration);
}

export async function testSteadfastIntegration(providerOverride?: CourierProvider) {
    const integration = await configuredIntegration(false);
    const provider = providerOverride || providerFromIntegration(integration);
    try {
        const valid = await provider.validateCredentials();
        if (!valid) throw new CourierProviderError('authentication', 'Steadfast credentials were rejected');
        await CourierIntegration.updateOne(
            { _id: integration._id },
            { status: 'connected', lastTestedAt: new Date(), $unset: { lastErrorCode: 1 } }
        );
        return { provider: 'steadfast' as const, connected: true, configured: true };
    } catch (error) {
        const safe = safeCourierError(error);
        await CourierIntegration.updateOne(
            { _id: integration._id },
            { status: 'error', lastTestedAt: new Date(), lastErrorCode: safe.code }
        );
        throw new CourierOperationError(safe.message, 400, safe.code);
    }
}

export async function disconnectSteadfastIntegration() {
    await CourierIntegration.deleteOne({ provider: 'steadfast' });
    return serializeCourierIntegration(null);
}

function bounded(value: unknown, length: number) {
    return String(value || '').trim().slice(0, length);
}

export function mapOrderToSteadfast(order: Pick<IOrder, 'orderNumber' | 'shippingAddress' | 'total' | 'paymentMethod' | 'paymentStatus' | 'items' | 'customerNote'>, deliveryType: 0 | 1): CreateDeliveryInput {
    const address = order.shippingAddress;
    const recipientName = bounded(address?.fullName, 100);
    if (!recipientName) throw new CourierOperationError('Shipping recipient name is required', 400, 'validation');
    const recipientPhone = normalizeBangladeshPhone(address?.phone);
    const recipientAddress = [address?.addressLine1, address?.addressLine2, address?.city, address?.zone, address?.postalCode, address?.country]
        .map((part) => String(part || '').trim()).filter(Boolean).join(', ').slice(0, 250);
    if (!address?.addressLine1 || !address?.city || !address?.zone || !recipientAddress) {
        throw new CourierOperationError('A complete shipping address is required', 400, 'validation');
    }
    const isCashOnDelivery = /cash|cod/i.test(order.paymentMethod) && order.paymentStatus !== 'paid';
    const itemDescription = order.items.map((item) => `${item.productName} x${item.quantity}`).join(', ').slice(0, 250);
    return {
        reference: bounded(order.orderNumber, 100),
        recipientName,
        recipientPhone,
        recipientAddress,
        codAmount: isCashOnDelivery ? Number(order.total) : 0,
        note: bounded(order.customerNote, 480) || undefined,
        itemDescription: itemDescription || undefined,
        deliveryType,
    };
}

export function serializeOrderCourier(courier: IOrder['courier']) {
    if (!courier) return null;
    return {
        provider: courier.provider,
        externalId: courier.externalId,
        consignmentId: courier.consignmentId,
        trackingCode: courier.trackingCode,
        status: courier.status,
        rawStatus: courier.rawStatus,
        creationStatus: courier.creationStatus,
        createdAt: courier.createdAt,
        lastSyncedAt: courier.lastSyncedAt,
        error: courier.error,
    };
}

export async function createCourierDelivery(params: {
    businessId: string;
    orderId: string;
    provider?: CourierProvider;
}) {
    assertTenantBusinessId(params.businessId, 'courier.createDelivery');
    const order = await Order.findById(params.orderId);
    if (!order) throw new CourierOperationError('Order not found', 404, 'not_found');
    if (!['confirmed', 'packed'].includes(order.status)) {
        throw new CourierOperationError('Order must be approved before creating a delivery', 409, 'order_not_approved');
    }
    if (order.courier?.creationStatus === 'created') {
        return { created: false, idempotent: true, courier: serializeOrderCourier(order.courier) };
    }
    if (order.courier?.creationStatus === 'creating' || order.courier?.creationStatus === 'uncertain') {
        throw new CourierOperationError('Courier creation is already in progress or requires status reconciliation', 409, 'creation_in_progress');
    }

    const integration = await configuredIntegration();
    const deliveryInput = mapOrderToSteadfast(order, integration.settings.deliveryType);
    const requestToken = crypto.randomUUID();
    const claimed = await Order.findOneAndUpdate(
        {
            _id: order._id,
            status: { $in: ['confirmed', 'packed'] },
            $or: [
                { 'courier.creationStatus': { $exists: false } },
                { 'courier.creationStatus': 'failed' },
            ],
        },
        {
            $set: {
                courier: {
                    provider: 'steadfast',
                    externalId: order.orderNumber,
                    status: 'pending',
                    creationStatus: 'creating',
                    requestToken,
                },
            },
        },
        { new: true }
    );
    if (!claimed) {
        const current = await Order.findById(order._id);
        if (current?.courier?.creationStatus === 'created') {
            return { created: false, idempotent: true, courier: serializeOrderCourier(current.courier) };
        }
        throw new CourierOperationError('Courier creation is already in progress', 409, 'creation_in_progress');
    }

    const provider = params.provider || providerFromIntegration(integration);
    try {
        const delivery = await provider.createDelivery(deliveryInput);
        const now = new Date();
        const updated = await Order.findOneAndUpdate(
            { _id: order._id, 'courier.requestToken': requestToken, 'courier.creationStatus': 'creating' },
            {
                $set: {
                    'courier.externalId': delivery.externalId,
                    'courier.consignmentId': delivery.consignmentId,
                    'courier.trackingCode': delivery.trackingCode,
                    'courier.status': delivery.status,
                    'courier.rawStatus': delivery.rawStatus,
                    'courier.creationStatus': 'created',
                    'courier.createdAt': now,
                    'courier.lastSyncedAt': now,
                    trackingNumber: delivery.trackingCode,
                },
                $unset: { 'courier.error': 1 },
            },
            { new: true }
        );
        if (!updated) {
            throw new CourierProviderError('transient', 'Courier confirmation could not be saved', false, true);
        }
        return { created: true, idempotent: false, courier: serializeOrderCourier(updated.courier) };
    } catch (error) {
        const safe = safeCourierError(error);
        await Order.updateOne(
            { _id: order._id, 'courier.requestToken': requestToken },
            {
                $set: {
                    'courier.creationStatus': safe.outcomeUnknown ? 'uncertain' : 'failed',
                    'courier.status': 'failed',
                    'courier.error': { code: safe.code, message: safe.message, at: new Date() },
                },
            }
        );
        throw new CourierOperationError(safe.message, safe.code === 'validation' ? 400 : 502, safe.code);
    }
}

export async function syncCourierDelivery(params: {
    businessId: string;
    orderId: string;
    provider?: CourierProvider;
}) {
    assertTenantBusinessId(params.businessId, 'courier.syncDelivery');
    const order = await Order.findById(params.orderId);
    if (!order) throw new CourierOperationError('Order not found', 404, 'not_found');
    if (!order.courier?.externalId) throw new CourierOperationError('Order has no courier delivery', 409, 'delivery_required');
    const integration = await configuredIntegration();
    const provider = params.provider || providerFromIntegration(integration);
    try {
        const result = await provider.getDeliveryStatus({
            consignmentId: order.courier.consignmentId,
            trackingCode: order.courier.trackingCode,
            reference: order.courier.externalId,
        });
        const now = new Date();
        const set: Record<string, unknown> = {
            'courier.status': result.status,
            'courier.rawStatus': result.rawStatus,
            'courier.lastSyncedAt': now,
            'courier.creationStatus': 'created',
        };
        const update: Record<string, unknown> = { $set: set, $unset: { 'courier.error': 1 } };
        if (result.status === 'delivered' && order.status !== 'delivered' && order.status !== 'completed') {
            set.status = 'delivered';
            set.actualDeliveryDate = now;
            update.$push = { statusHistory: { status: 'delivered', timestamp: now, note: 'Steadfast confirmed delivery' } };
        }
        const updated = await Order.findOneAndUpdate({ _id: order._id }, update, { new: true });
        return { courier: serializeOrderCourier(updated?.courier), orderStatus: updated?.status };
    } catch (error) {
        const safe = safeCourierError(error);
        await Order.updateOne(
            { _id: order._id },
            { $set: { 'courier.error': { code: safe.code, message: safe.message, at: new Date() } } }
        );
        throw new CourierOperationError(safe.message, safe.code === 'not_found' ? 404 : 502, safe.code, safe.retryable);
    }
}

export function currentTenantBusinessId() {
    return requireTenantContext().businessId;
}
