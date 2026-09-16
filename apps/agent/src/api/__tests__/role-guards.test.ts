import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import aiUsageRoutes from '../ai-usage.routes';
import billingRoutes from '../billing.routes';
import dashboardRoutes from '../dashboard.routes';
import { AuthenticatedRequest } from '../../auth/middleware';
import { BusinessRole, withTenantContext } from '../../tenancy/context';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import * as access from '../../services/business-ai-access.service';

const businessId = new mongoose.Types.ObjectId().toString();

/** Stands in for `authenticate`, which is mounted ahead of these routers in app.ts. */
function asRole(role: BusinessRole) {
    const app = express().use(express.json());
    app.use((req: AuthenticatedRequest, _res, next) => {
        req.auth = { userId: 'u', businessId, membershipId: 'm', role };
        withTenantContext(req.auth, () => next());
    });
    return app.use('/api', billingRoutes, aiUsageRoutes, dashboardRoutes);
}

describe('role guards on money and analytics', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(1 as never);
        vi.spyOn(access, 'evaluateBusinessAIAccess').mockResolvedValue({ allowed: true, limits: { requests: 100, tokens: null, source: 'plan' }, consumed: 0.1, warnAt: 0.8 });
    });

    it('keeps Staff out of billing, whatever the sidebar shows them', async () => {
        await request(asRole('Staff')).get('/api/billing').expect(403);
        await request(asRole('Staff')).post('/api/billing/checkout').send({ planSlug: 'growth' }).expect(403);
    });

    it('keeps Admins out of billing too — spending money is the Owner’s alone', async () => {
        await request(asRole('Admin')).get('/api/billing').expect(403);
        await request(asRole('Admin')).post('/api/billing/checkout').send({ planSlug: 'growth' }).expect(403);
    });

    it('keeps Staff out of analytics and AI usage', async () => {
        await request(asRole('Staff')).get('/api/ai-usage/summary').expect(403);
        await request(asRole('Staff')).get('/api/dashboard/overview').expect(403);
    });

    it('lets whoever runs the workspace read AI access, so the quota warning reaches them', async () => {
        const admin = await request(asRole('Admin')).get('/api/ai-access').expect(200);
        expect(admin.body).toMatchObject({ allowed: true, warnAt: 0.8 });
        await request(asRole('Owner')).get('/api/ai-access').expect(200);
        // Staff cannot act on a quota, and the banner does not ask them to.
        await request(asRole('Staff')).get('/api/ai-access').expect(403);
    });
});
