import axios, { AxiosError, AxiosInstance } from 'axios';
import { CourierCredentials, CourierProviderError } from './types';

export interface SteadfastCreatePayload {
    invoice: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    cod_amount: number;
    note?: string;
    item_description?: string;
    delivery_type?: 0 | 1;
}

export interface SteadfastClient {
    validateCredentials(): Promise<boolean>;
    createOrder(payload: SteadfastCreatePayload): Promise<unknown>;
    getStatus(path: 'cid' | 'invoice' | 'tracking', value: string): Promise<unknown>;
}

function providerError(error: unknown, operation: 'read' | 'create'): never {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        if (status === 401 || status === 403) {
            throw new CourierProviderError('authentication', 'Steadfast credentials were rejected');
        }
        if (status === 404) throw new CourierProviderError('not_found', 'Steadfast delivery was not found');
        if (status === 400 || status === 422) {
            throw new CourierProviderError('validation', 'Steadfast rejected the delivery data');
        }
        const transient = !status || status === 408 || status === 429 || status >= 500;
        throw new CourierProviderError(
            transient ? 'transient' : 'malformed_response',
            transient ? 'Steadfast is temporarily unavailable' : 'Steadfast returned an unexpected response',
            operation === 'read' && transient,
            operation === 'create' && transient,
        );
    }
    throw new CourierProviderError('malformed_response', 'Steadfast operation failed unexpectedly', false, operation === 'create');
}

export class HttpSteadfastClient implements SteadfastClient {
    private readonly http: AxiosInstance;

    constructor(credentials: CourierCredentials) {
        this.http = axios.create({
            baseURL: 'https://portal.steadfast.com.bd/api/v1',
            timeout: 10_000,
            headers: {
                'Api-Key': credentials.apiKey,
                'Secret-Key': credentials.secretKey,
                'Content-Type': 'application/json',
            },
        });
    }

    async validateCredentials() {
        try {
            const response = await this.http.get('/get_balance');
            return response.status === 200 && Number(response.data?.status) === 200;
        } catch (error) {
            providerError(error, 'read');
        }
    }

    async createOrder(payload: SteadfastCreatePayload) {
        try {
            return (await this.http.post('/create_order', payload)).data;
        } catch (error) {
            providerError(error, 'create');
        }
    }

    async getStatus(path: 'cid' | 'invoice' | 'tracking', value: string) {
        try {
            const endpoint = path === 'cid' ? 'status_by_cid' : path === 'tracking' ? 'status_by_trackingcode' : 'status_by_invoice';
            return (await this.http.get(`/${endpoint}/${encodeURIComponent(value)}`)).data;
        } catch (error) {
            providerError(error, 'read');
        }
    }
}
