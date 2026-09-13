import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntelligenceIntegration, INTELLIGENCE_PROVIDERS, intelligenceProvider } from '../../models/IntelligenceIntegration';
import { withTenantContext } from '../../tenancy/context';

const { verifyCustomerPayment } = vi.hoisted(() => ({ verifyCustomerPayment: vi.fn() }));
vi.mock('../../intelligence/payments', () => ({ verifyCustomerPayment }));
vi.mock('../../auth/middleware', () => ({
    requireAdministrator: (_req: unknown, _res: unknown, next: () => void) => next(),
    authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import integrationRoutes from '../intelligence-integrations.routes';
import paymentRoutes from '../payment-intelligence.routes';

const businessId = new mongoose.Types.ObjectId().toString();
const principal = { businessId, userId: 'u', membershipId: 'm', role: 'Owner' as const };
const app = express()
    .use(express.json())
    .use((req, _res, next) => {
        (req as any).auth = principal;
        withTenantContext(principal, () => next());
    })
    .use('/api', integrationRoutes)
    .use('/api', paymentRoutes);

describe('the provider name is a known adapter, not whatever was in the URL', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('accepts every adapter the schema allows', () => {
        for (const provider of INTELLIGENCE_PROVIDERS) expect(intelligenceProvider(provider)).toBe(provider);
    });

    it('rejects anything else, including near-misses and non-strings', () => {
        for (const value of ['', 'Pathao', 'stripe ', 'paypal', 'pathao;drop', null, undefined, 42, {}, ['stripe']]) {
            expect(intelligenceProvider(value)).toBeUndefined();
        }
    });

    it('does not delete — or query — for a provider that does not exist', async () => {
        const deleteOne = vi.spyOn(IntelligenceIntegration, 'deleteOne');
        const response = await request(app).delete('/api/intelligence/integrations/paypal').expect(404);
        expect(response.body).toMatchObject({ error: 'Unknown provider' });
        // The old route answered "disconnected: true" after a query that could never match.
        expect(deleteOne).not.toHaveBeenCalled();
    });

    it('deletes only the named adapter for the calling business', async () => {
        const deleteOne = vi.spyOn(IntelligenceIntegration, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as never);
        await request(app).delete('/api/intelligence/integrations/redx').expect(200);
        expect(deleteOne).toHaveBeenCalledWith({ businessId, provider: 'redx' });
    });

    it('never starts a payment verification for an unknown provider', async () => {
        const response = await request(app)
            .post('/api/intelligence/payments/paypal/verify')
            .send({ reference: 'abc123' })
            .expect(404);
        expect(response.body).toMatchObject({ error: 'Unknown provider' });
        expect(verifyCustomerPayment).not.toHaveBeenCalled();
    });

    it('passes a known provider through to verification', async () => {
        verifyCustomerPayment.mockResolvedValue({ status: 'paid', verified: true, orderNumber: 'ORD-1' });
        await request(app)
            .post('/api/intelligence/payments/stripe/verify')
            .send({ reference: 'pi_123' })
            .expect(200);
        expect(verifyCustomerPayment).toHaveBeenCalledWith('stripe', 'pi_123');
    });
});
