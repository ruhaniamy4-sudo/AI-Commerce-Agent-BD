export type CourierProviderName = 'steadfast';
export type ShipmentStatus = 'pending' | 'submitted' | 'in_transit' | 'delivered' | 'cancelled' | 'returned' | 'failed' | 'unknown';
export type CourierErrorKind = 'validation' | 'authentication' | 'not_found' | 'transient' | 'malformed_response' | 'unsupported';

export interface CourierCredentials { apiKey: string; secretKey: string }

export interface CreateDeliveryInput {
    reference: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    codAmount: number;
    note?: string;
    itemDescription?: string;
    deliveryType?: 0 | 1;
}

export interface CreatedDelivery {
    externalId: string;
    consignmentId: string;
    trackingCode: string;
    status: ShipmentStatus;
    rawStatus: string;
}

export interface DeliveryIdentifier {
    consignmentId?: string;
    trackingCode?: string;
    reference?: string;
}

export interface DeliveryStatusResult {
    status: ShipmentStatus;
    rawStatus: string;
}

export interface CourierProvider {
    readonly name: CourierProviderName;
    validateCredentials(): Promise<boolean>;
    createDelivery(input: CreateDeliveryInput): Promise<CreatedDelivery>;
    getDeliveryStatus(identifier: DeliveryIdentifier): Promise<DeliveryStatusResult>;
    cancelDelivery?(identifier: DeliveryIdentifier): Promise<DeliveryStatusResult>;
}

export class CourierProviderError extends Error {
    constructor(
        public readonly kind: CourierErrorKind,
        message: string,
        public readonly retryable = false,
        public readonly outcomeUnknown = false,
    ) {
        super(message);
        this.name = 'CourierProviderError';
    }
}

export function safeCourierError(error: unknown) {
    if (error instanceof CourierProviderError) {
        return { code: error.kind, message: error.message, retryable: error.retryable, outcomeUnknown: error.outcomeUnknown };
    }
    return { code: 'courier_error', message: 'Courier operation failed', retryable: false, outcomeUnknown: false };
}
