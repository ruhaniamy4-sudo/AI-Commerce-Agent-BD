import { SteadfastClient, SteadfastCreatePayload } from './steadfast.client';
import {
    CourierProvider,
    CourierProviderError,
    CreateDeliveryInput,
    DeliveryIdentifier,
    ShipmentStatus,
} from './types';

export function mapSteadfastStatus(status: unknown): ShipmentStatus {
    const value = String(status || '').trim().toLowerCase().replace(/[ -]+/g, '_');
    if (value === 'in_review') return 'submitted';
    if (['hold', 'cancelled_approval_pending'].includes(value)) return 'pending';
    if (value === 'pending') return 'in_transit';
    if (['picked_up', 'pickup_complete', 'in_transit', 'out_for_delivery', 'delivered_approval_pending'].includes(value)) return 'in_transit';
    if (value === 'delivered') return 'delivered';
    if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
    if (['returned', 'return', 'returned_to_merchant', 'return_completed'].includes(value)) return 'returned';
    if (['failed', 'delivery_failed'].includes(value)) return 'failed';
    return 'unknown';
}

export class SteadfastCourierProvider implements CourierProvider {
    readonly name = 'steadfast' as const;
    constructor(private readonly client: SteadfastClient) {}

    validateCredentials() { return this.client.validateCredentials(); }

    async createDelivery(input: CreateDeliveryInput) {
        const payload: SteadfastCreatePayload = {
            invoice: input.reference,
            recipient_name: input.recipientName,
            recipient_phone: input.recipientPhone,
            recipient_address: input.recipientAddress,
            cod_amount: input.codAmount,
            note: input.note,
            item_description: input.itemDescription,
            delivery_type: input.deliveryType ?? 0,
        };
        const response = await this.client.createOrder(payload) as Record<string, any>;
        const consignment = response?.consignment;
        if (Number(response?.status) !== 200 || !consignment?.consignment_id || !consignment?.tracking_code) {
            throw new CourierProviderError('malformed_response', 'Steadfast did not confirm consignment creation', false, true);
        }
        const rawStatus = String(consignment.status || 'in_review');
        return {
            externalId: String(consignment.invoice || input.reference),
            consignmentId: String(consignment.consignment_id),
            trackingCode: String(consignment.tracking_code),
            status: mapSteadfastStatus(rawStatus),
            rawStatus,
        };
    }

    async getDeliveryStatus(identifier: DeliveryIdentifier) {
        const path = identifier.consignmentId ? 'cid' : identifier.trackingCode ? 'tracking' : identifier.reference ? 'invoice' : null;
        const value = identifier.consignmentId || identifier.trackingCode || identifier.reference;
        if (!path || !value) throw new CourierProviderError('validation', 'A courier delivery identifier is required');
        const response = await this.client.getStatus(path, value) as Record<string, any>;
        if (Number(response?.status) !== 200 || typeof response?.delivery_status !== 'string') {
            throw new CourierProviderError('malformed_response', 'Steadfast returned an invalid status response');
        }
        return { status: mapSteadfastStatus(response.delivery_status), rawStatus: response.delivery_status };
    }
}
