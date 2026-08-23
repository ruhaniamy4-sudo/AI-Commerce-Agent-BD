import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';

// Mocks must be hoisted
const { mockQueueAdd, mockWebHookEvent, mockBusinessChannel, mockLogError } = vi.hoisted(() => {
    return {
        mockQueueAdd: vi.fn(),
        mockWebHookEvent: { findOne: vi.fn(), create: vi.fn() },
        mockBusinessChannel: { findOne: vi.fn() },
        mockLogError: vi.fn()
    };
});

vi.mock('../../services/queue.service', () => ({
    webhookQueue: {
        add: mockQueueAdd
    }
}));

vi.mock('../../models/WebhookEvent', () => ({
    WebhookEvent: mockWebHookEvent
}));

vi.mock('../../models/BusinessChannel', () => ({
    BusinessChannel: mockBusinessChannel,
}));

vi.mock('../../services/error.service', () => ({
    logError: mockLogError
}));

describe('Facebook Webhook API', () => {
    let app: any;

    beforeEach(async () => {
        vi.resetModules(); // Clear module cache
        // Set Env
        process.env.FB_APP_SECRET = 'test_secret';
        process.env.FB_VERIFY_TOKEN = 'test_token';
        process.env.NODE_ENV = 'production'; // Enforce signature verify

        // Dynamic import
        const express = (await import('express')).default;
        const facebookRouter = (await import('../facebook.routes')).default;

        app = express();
        app.use(express.json({
            verify(req, _res, buffer) {
                (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
            },
        }));
        app.use('/webhook', facebookRouter);

        vi.clearAllMocks();
        mockBusinessChannel.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({ businessId: { toString: () => '507f1f77bcf86cd799439011' } }),
        });
    });

    it('GET /webhook returns challenge if token matches', async () => {
        const response = await request(app)
            .get('/webhook')
            .query({
                'hub.mode': 'subscribe',
                'hub.verify_token': 'test_token',
                'hub.challenge': '123456'
            });

        expect(response.status).toBe(200);
        expect(response.text).toBe('123456');
    });

    it('GET /webhook returns 403 if token invalid', async () => {
        const response = await request(app)
            .get('/webhook')
            .query({
                'hub.mode': 'subscribe',
                'hub.verify_token': 'wrong_token',
                'hub.challenge': '123456'
            });

        expect(response.status).toBe(403);
    });

    it('POST /webhook rejects invalid signature', async () => {
        const response = await request(app)
            .post('/webhook')
            .set('x-hub-signature-256', `sha256=invalid`)
            .send({});

        expect(response.status).toBe(403);
    });

    it('POST /webhook accepts requests with valid signature and queues job', async () => {
        const payload = {
            object: 'page',
            entry: [{
                id: 'page_1',
                messaging: [{
                    sender: { id: 'user_1' },
                    message: { text: 'Hello', mid: 'mid_123' }
                }]
            }]
        };

        const signature = crypto
            .createHmac('sha256', 'test_secret')
            .update(JSON.stringify(payload))
            .digest('hex');

        mockWebHookEvent.findOne.mockResolvedValue(null); // No duplicate

        const response = await request(app)
            .post('/webhook')
            .set('x-hub-signature-256', `sha256=${signature}`)
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.text).toBe('EVENT_RECEIVED');
        expect(mockQueueAdd).toHaveBeenCalledWith('process-facebook-event', expect.objectContaining({
            businessId: '507f1f77bcf86cd799439011',
            psid: 'user_1',
            message: 'Hello'
        }));
        expect(mockWebHookEvent.create).toHaveBeenCalled();
    });

    it('POST /webhook ignores duplicate events', async () => {
        const payload = {
            object: 'page',
            entry: [{
                id: 'page_1',
                messaging: [{
                    sender: { id: 'user_1' },
                    message: { text: 'Hello again', mid: 'mid_duplicate' }
                }]
            }]
        };
        const signature = crypto
            .createHmac('sha256', 'test_secret')
            .update(JSON.stringify(payload))
            .digest('hex');
        mockWebHookEvent.create.mockRejectedValue({ code: 11000 });

        const response = await request(app)
            .post('/webhook')
            .set('x-hub-signature-256', `sha256=${signature}`)
            .send(payload);

        expect(response.status).toBe(200);
        expect(mockWebHookEvent.create).toHaveBeenCalledTimes(1);
        expect(mockQueueAdd).not.toHaveBeenCalled();
    });
});
