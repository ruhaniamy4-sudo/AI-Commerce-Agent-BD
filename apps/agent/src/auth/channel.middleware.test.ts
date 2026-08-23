import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessChannel } from '../models/BusinessChannel';
import { requireTenantContext } from '../tenancy/context';
import { resolvePublicChannel } from './channel.middleware';

describe('web BusinessChannel resolution', () => {
    afterEach(() => vi.restoreAllMocks());

    it('resolves the channel and establishes its business context', async () => {
        const businessId = new mongoose.Types.ObjectId();
        const lean = vi.fn().mockResolvedValue({ businessId });
        const findChannel = vi.spyOn(BusinessChannel, 'findOne').mockReturnValue({ lean } as never);
        const app = express();
        app.get('/public/:channelId/chat', resolvePublicChannel, (_req, res) => {
            res.json({ businessId: requireTenantContext().businessId });
        });

        const response = await request(app).get('/public/storefront/chat').expect(200);

        expect(findChannel).toHaveBeenCalledWith({
            platform: 'web',
            externalId: 'storefront',
            status: 'active',
        });
        expect(response.body.businessId).toBe(businessId.toString());
    });

    it('returns 404 for an unknown channel without creating tenant context', async () => {
        vi.spyOn(BusinessChannel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as never);
        const app = express();
        app.get('/public/:channelId/chat', resolvePublicChannel, (_req, res) => res.sendStatus(204));
        await request(app).get('/public/unknown/chat').expect(404);
    });
});
