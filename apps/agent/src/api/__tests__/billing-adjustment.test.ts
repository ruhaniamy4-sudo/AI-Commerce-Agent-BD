import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingTransaction } from '../../models/BillingTransaction';

const { writePlatformAudit } = vi.hoisted(() => ({ writePlatformAudit: vi.fn() }));
vi.mock('../../services/platform-audit.service', () => ({ writePlatformAudit }));

import platformAdminRoutes from '../platform-admin.routes';

const adminId = new mongoose.Types.ObjectId().toString();
const businessId = new mongoose.Types.ObjectId().toString();
const app = express()
    .use(express.json())
    // Authentication resolves the admin's permissions, so the stub carries them too:
    // the route is now guarded by `requirePlatformPermission('billing.manage')`.
    .use((req, _res, next) => { (req as any).platformAdmin = { id: adminId, email: 'ops@sellpilot.test', name: 'Ops', role: 'OWNER', permissions: ['*'] }; next(); })
    .use('/platform-admin', platformAdminRoutes);

const post = (body: unknown) => request(app).post('/platform-admin/billing/adjustments').send(body as object);

describe('a hand-booked billing adjustment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        writePlatformAudit.mockResolvedValue(undefined);
        vi.spyOn(BillingTransaction, 'create').mockImplementation((async (doc: any) => ({
            ...doc, _id: new mongoose.Types.ObjectId(),
        })) as never);
    });

    it('books the two kinds an operator is allowed to enter', async () => {
        for (const type of ['ADJUSTMENT', 'REFUND']) {
            const response = await post({ businessId, type, amount: 500, reason: 'Goodwill credit for a late delivery' }).expect(201);
            expect(response.body).toMatchObject({ type, amount: 500, status: 'PAID', currency: 'BDT' });
        }
        expect(BillingTransaction.create).toHaveBeenCalledTimes(2);
    });

    it('refuses a kind the operator may not book by hand', async () => {
        // RENEWAL is a real transaction type, but it belongs to the billing cycle, not to a person.
        await post({ businessId, type: 'RENEWAL', amount: 500, reason: 'Trying to book a renewal by hand' }).expect(400);
        await post({ businessId, type: 'nonsense', amount: 500, reason: 'Trying an invented type entirely' }).expect(400);
        expect(BillingTransaction.create).not.toHaveBeenCalled();
    });

    it('refuses a type that only looks right after coercion', async () => {
        await post({ businessId, type: ['REFUND'], amount: 500, reason: 'A list is not an adjustment type' }).expect(400);
        expect(BillingTransaction.create).not.toHaveBeenCalled();
    });

    it('still requires a business, a reason and a non-negative amount', async () => {
        await post({ type: 'REFUND', amount: 500, reason: 'No business given at all' }).expect(400);
        await post({ businessId, type: 'REFUND', amount: -1, reason: 'A negative amount is not a refund' }).expect(400);
        await post({ businessId, type: 'REFUND', amount: 500 }).expect(400);
        expect(BillingTransaction.create).not.toHaveBeenCalled();
    });

    it('records what was booked, and by whom', async () => {
        await post({ businessId, type: 'REFUND', amount: 250, isTest: true, reason: 'Refunded a duplicate charge' }).expect(201);
        expect(writePlatformAudit).toHaveBeenCalledWith(expect.objectContaining({
            platformAdminId: adminId,
            action: 'MANUAL_BILLING_ADJUSTMENT',
            newValue: expect.objectContaining({ type: 'REFUND', amount: 250, isTest: true }),
            reason: 'Refunded a duplicate charge',
        }));
    });
});
