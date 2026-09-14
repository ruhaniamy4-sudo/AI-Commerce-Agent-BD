import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenantContext } from '../../tenancy/context';
import whatsappRoutes from '../whatsapp.routes';
import {
    completeWhatsAppEmbeddedSignup,
    confirmWhatsAppSignupNumber,
    resubscribeWhatsAppConnection,
    whatsappSetupOptions,
} from '../../services/whatsapp-connection.service';

vi.mock('../../services/whatsapp-connection.service', () => ({
    whatsappSetupOptions: vi.fn(),
    completeWhatsAppEmbeddedSignup: vi.fn(),
    confirmWhatsAppSignupNumber: vi.fn(),
    resubscribeWhatsAppConnection: vi.fn(),
    confirmWhatsAppSubscription: vi.fn(),
    releaseWhatsAppAccount: vi.fn(),
    publicWhatsAppConnection: (channel: any) => ({ id: String(channel._id) }),
}));

const businessId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId().toString();

const app = express()
    .use(express.json())
    .use((req, _res, next) => {
        (req as any).auth = { businessId, userId, membershipId: 'm', role: 'Owner' };
        withTenantContext({ businessId, userId, membershipId: 'm', role: 'Owner' }, () => next());
    })
    .use('/api', whatsappRoutes);

describe('WhatsApp guided setup endpoints', () => {
    beforeEach(() => {
        vi.mocked(whatsappSetupOptions).mockReturnValue({
            guidedAvailable: true, appId: 'app-id', configId: 'config-id',
            graphVersion: 'v26.0', webhookUrl: 'https://agent.example.com/whatsapp',
        });
        vi.mocked(completeWhatsAppEmbeddedSignup).mockReset();
        vi.mocked(confirmWhatsAppSignupNumber).mockReset();
        vi.mocked(resubscribeWhatsAppConnection).mockReset();
    });

    it('tells the dashboard what this deployment can offer, without any secret', async () => {
        const response = await request(app).get('/api/integrations/whatsapp/setup').expect(200);
        expect(response.body).toMatchObject({ guidedAvailable: true, appId: 'app-id', configId: 'config-id' });
        expect(JSON.stringify(response.body)).not.toMatch(/secret|token/i);
    });

    it('forwards only the one-time code, and answers with the finished connection', async () => {
        vi.mocked(completeWhatsAppEmbeddedSignup).mockResolvedValue({ connection: { phoneNumberId: '55501' } } as never);

        const response = await request(app)
            .post('/api/integrations/whatsapp/connect')
            .send({ code: 'signup-code', wabaId: '900900', phoneNumberId: '55501', coexistence: true })
            .expect(200);

        expect(completeWhatsAppEmbeddedSignup).toHaveBeenCalledWith(businessId, userId, {
            code: 'signup-code', wabaId: '900900', phoneNumberId: '55501', coexistence: true,
        });
        expect(response.body).toMatchObject({ connection: { phoneNumberId: '55501' } });
    });

    it('treats anything but an explicit true as the ordinary flow', async () => {
        vi.mocked(completeWhatsAppEmbeddedSignup).mockResolvedValue({ connection: {} } as never);
        await request(app).post('/api/integrations/whatsapp/connect').send({ code: 'signup-code' }).expect(200);
        expect(completeWhatsAppEmbeddedSignup).toHaveBeenCalledWith(businessId, userId, {
            code: 'signup-code', wabaId: undefined, phoneNumberId: undefined, coexistence: false,
        });
    });

    // The confirm path sits next to /:id/verify, so it is worth proving which one wins.
    it('routes the number choice to confirmation, not to a channel id', async () => {
        vi.mocked(confirmWhatsAppSignupNumber).mockResolvedValue({ phoneNumberId: '55502' } as never);

        const response = await request(app)
            .post('/api/integrations/whatsapp/connect/confirm')
            .send({ sessionId: 'session-1', choiceId: 'choice-1' })
            .expect(200);

        expect(confirmWhatsAppSignupNumber).toHaveBeenCalledWith(businessId, userId, 'session-1', 'choice-1');
        expect(response.body).toMatchObject({ connection: { phoneNumberId: '55502' } });
    });

    it('repairs a webhook subscription in place', async () => {
        vi.mocked(resubscribeWhatsAppConnection).mockResolvedValue({ id: 'channel-1' } as never);
        await request(app).post('/api/integrations/whatsapp/channel-1/resubscribe').expect(200);
        expect(resubscribeWhatsAppConnection).toHaveBeenCalledWith(businessId, 'channel-1');
    });

    it('reports a number another business already owns as a conflict', async () => {
        vi.mocked(completeWhatsAppEmbeddedSignup).mockRejectedValue(new Error('This WhatsApp number is already connected to another business'));
        const response = await request(app).post('/api/integrations/whatsapp/connect').send({ code: 'signup-code' }).expect(409);
        expect(response.body.error).toMatch(/already connected to another business/i);
    });

    it('reports an expired number-choice session as gone rather than as a bad request', async () => {
        vi.mocked(confirmWhatsAppSignupNumber).mockRejectedValue(new Error('WhatsApp number selection session is unavailable'));
        await request(app).post('/api/integrations/whatsapp/connect/confirm').send({ sessionId: 'x', choiceId: 'y' }).expect(404);
    });
});
