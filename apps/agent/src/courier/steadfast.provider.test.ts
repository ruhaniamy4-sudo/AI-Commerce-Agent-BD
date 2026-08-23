import { describe, expect, it, vi } from 'vitest';
import { SteadfastClient } from './steadfast.client';
import { mapSteadfastStatus, SteadfastCourierProvider } from './steadfast.provider';

describe('Steadfast status mapping', () => {
    it.each([
        ['delivered', 'delivered'],
        ['pending', 'in_transit'],
        ['out_for_delivery', 'in_transit'],
        ['returned_to_merchant', 'returned'],
        ['cancelled', 'cancelled'],
        ['something_new', 'unknown'],
    ] as const)('maps %s to %s', (raw, normalized) => {
        expect(mapSteadfastStatus(raw)).toBe(normalized);
    });

    it('requires provider confirmation fields before reporting creation success', async () => {
        const client: SteadfastClient = {
            validateCredentials: vi.fn().mockResolvedValue(true),
            createOrder: vi.fn().mockResolvedValue({ status: 200, message: 'ok' }),
            getStatus: vi.fn(),
        };
        const provider = new SteadfastCourierProvider(client);
        await expect(provider.createDelivery({
            reference: 'ORD-123456', recipientName: 'Customer', recipientPhone: '01712345678',
            recipientAddress: 'Dhaka', codAmount: 500,
        })).rejects.toMatchObject({ kind: 'malformed_response' });
    });

    it('returns confirmed consignment and tracking data', async () => {
        const client: SteadfastClient = {
            validateCredentials: vi.fn().mockResolvedValue(true),
            createOrder: vi.fn().mockResolvedValue({
                status: 200,
                consignment: { consignment_id: 1424107, invoice: 'ORD-123456', tracking_code: '15BAEB8A', status: 'in_review' },
            }),
            getStatus: vi.fn(),
        };
        const provider = new SteadfastCourierProvider(client);
        await expect(provider.createDelivery({
            reference: 'ORD-123456', recipientName: 'Customer', recipientPhone: '01712345678',
            recipientAddress: 'Dhaka', codAmount: 500,
        })).resolves.toEqual({
            externalId: 'ORD-123456', consignmentId: '1424107', trackingCode: '15BAEB8A',
            status: 'submitted', rawStatus: 'in_review',
        });
    });
});
