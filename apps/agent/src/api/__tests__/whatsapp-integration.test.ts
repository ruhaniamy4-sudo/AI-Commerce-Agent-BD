import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { BusinessChannel } from '../../models/BusinessChannel';
import { withTenantContext } from '../../tenancy/context';
import whatsappRoutes from '../whatsapp.routes';

vi.mock('../../services/meta-credentials.service', () => ({
    encryptMetaAccessToken: (token: string) => `enc:${token}`,
    decryptMetaAccessToken: (token: string) => token.replace('enc:', ''),
}));

const businessId = new mongoose.Types.ObjectId().toString();
const channelId = new mongoose.Types.ObjectId().toString();

const app = express()
    .use(express.json())
    .use((req, _res, next) => {
        (req as any).auth = { businessId, userId: 'u', membershipId: 'm', role: 'Owner' };
        withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Owner' }, () => next());
    })
    .use('/api', whatsappRoutes);

describe('WhatsApp integration management', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        process.env.META_GRAPH_API_VERSION = 'v21.0';
    });

    it('lists a connection with everything the merchant needs to judge it', async () => {
        vi.spyOn(BusinessChannel, 'find').mockReturnValue({
            select: () => ({ sort: () => ({ lean: () => Promise.resolve([{
                _id: channelId, externalId: '123456789', name: 'SellPilot Store', connectionStatus: 'CONNECTED',
                status: 'active', lastInboundAt: new Date('2026-09-13T09:00:00Z'), reauthorizationRequired: false,
            }]) }) }),
        } as never);

        const response = await request(app).get('/api/integrations/whatsapp').expect(200);
        expect(response.body.channels[0]).toMatchObject({
            id: channelId,
            phoneNumberId: '123456789',
            name: 'SellPilot Store',
            connectionStatus: 'CONNECTED',
            aiEnabled: true,
            reauthorizationRequired: false,
        });
        // The stored token must never travel to the dashboard.
        expect(JSON.stringify(response.body)).not.toMatch(/encryptedAccessToken|enc:/);
    });

    it('re-checks the token with Meta and records the result', async () => {
        const channel: any = {
            _id: channelId, externalId: '123456789', name: 'Old name', encryptedAccessToken: 'enc:token',
            connectionStatus: 'NEEDS_ATTENTION', reauthorizationRequired: true, save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(BusinessChannel, 'findOne').mockReturnValue({ select: () => Promise.resolve(channel) } as never);
        vi.spyOn(axios, 'get').mockResolvedValue({ data: { id: '123456789', display_phone_number: '+880 1712 345678', verified_name: 'SellPilot Store' } } as never);

        const response = await request(app).post(`/api/integrations/whatsapp/${channelId}/verify`).expect(200);
        expect(response.body).toMatchObject({ verified: true, name: 'SellPilot Store' });
        expect(channel.connectionStatus).toBe('CONNECTED');
        expect(channel.reauthorizationRequired).toBe(false);
        expect(channel.save).toHaveBeenCalled();
    });

    it('marks the connection as needing attention when Meta rejects the token', async () => {
        const channel: any = {
            _id: channelId, externalId: '123456789', encryptedAccessToken: 'enc:expired',
            connectionStatus: 'CONNECTED', save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(BusinessChannel, 'findOne').mockReturnValue({ select: () => Promise.resolve(channel) } as never);
        vi.spyOn(axios, 'get').mockRejectedValue({ response: { data: { error: { code: 190 } } } } as never);

        const response = await request(app).post(`/api/integrations/whatsapp/${channelId}/verify`).expect(502);
        expect(response.body.error).toMatch(/token may have expired/i);
        expect(channel.connectionStatus).toBe('NEEDS_ATTENTION');
        expect(channel.lastErrorCode).toBe('190');
    });

    it('refuses to enable AI on a number that is not verified', async () => {
        const channel: any = { _id: channelId, connectionStatus: 'NEEDS_ATTENTION', status: 'disabled', save: vi.fn() };
        vi.spyOn(BusinessChannel, 'findOne').mockResolvedValue(channel as never);

        const response = await request(app).patch(`/api/integrations/whatsapp/${channelId}/ai`).send({ enabled: true }).expect(409);
        expect(response.body.error).toMatch(/verify/i);
        expect(channel.save).not.toHaveBeenCalled();
    });

    it('pauses AI without dropping the connection', async () => {
        const channel: any = { _id: channelId, connectionStatus: 'CONNECTED', status: 'active', save: vi.fn().mockResolvedValue(undefined) };
        vi.spyOn(BusinessChannel, 'findOne').mockResolvedValue(channel as never);

        const response = await request(app).patch(`/api/integrations/whatsapp/${channelId}/ai`).send({ enabled: false }).expect(200);
        expect(response.body).toMatchObject({ aiEnabled: false });
        expect(channel.status).toBe('disabled');
    });

    it('removes the stored token when the merchant disconnects', async () => {
        const update = vi.spyOn(BusinessChannel, 'findOneAndUpdate').mockResolvedValue({ _id: channelId } as never);
        await request(app).delete(`/api/integrations/whatsapp/${channelId}`).expect(200);

        const [, changes] = update.mock.calls[0] as any[];
        expect(changes.$unset).toMatchObject({ encryptedAccessToken: '' });
        expect(changes.$set).toMatchObject({ connectionStatus: 'DISCONNECTED', status: 'disabled' });
    });

    it('reports a missing connection instead of pretending it acted', async () => {
        vi.spyOn(BusinessChannel, 'findOneAndUpdate').mockResolvedValue(null as never);
        await request(app).delete(`/api/integrations/whatsapp/${channelId}`).expect(404);
    });
});
