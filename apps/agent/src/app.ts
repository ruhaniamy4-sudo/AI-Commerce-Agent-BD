import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { llm } from './agent/agent';
import adminRoutes from './api/admin.routes';
import agentRoutes from './api/agent.routes';
import chatRoutes from './api/chat.routes';
import facebookRoutes from './api/facebook.routes';
import metaConnectionRoutes, { metaPublicRouter } from './api/meta-connection.routes';
import googleRoutes from './api/google.routes';
import productsRoutes from './api/products.routes';
import ordersRoutes from './api/orders.routes';
import customersRoutes from './api/customers.routes';
import uploadRoutes from './api/upload.routes';
import authRoutes from './api/auth.routes';
import { authenticate, requireAdministrator } from './auth/middleware';
import { resolvePublicChannel } from './auth/channel.middleware';
import publicRoutes from './api/public.routes';
import aiUsageRoutes from './api/ai-usage.routes';
import courierRoutes from './api/courier.routes';
import onboardingRoutes from './api/onboarding.routes';
import testAiRoutes from './api/test-ai.routes';
import platformAuthRoutes from './api/platform-auth.routes';
import platformAdminRoutes from './api/platform-admin.routes';
import dashboardRoutes from './api/dashboard.routes';
import trainingRoutes from './api/training.routes';
import { authenticatePlatformAdmin } from './auth/middleware';
import { connectMongo } from './db/mongodb';
import { getAgentStatus } from './services/agentManager';
import { warmPromptCache } from './services/systemPrompt.service';
import morgan from 'morgan';
import { ensurePlatformAdmin } from './services/platform-admin-bootstrap.service';
import { getHealthStatus, printDeveloperStatus } from './services/health.service';
import { TEST_AI_API } from '@edutechs/shared';
import crypto from 'node:crypto';

// var morgan = require('morgan');
dotenv.config();
const app = express();
app.disable('etag');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

app.use((req, res, next) => {
    const requestId = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 128);
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

morgan.token('safe-path', (req) => new URL(req.url || '/', 'http://local').pathname);
app.use(morgan(':method :safe-path :status :res[content-length] - :response-time ms'));
const configuredOrigins = [
    ...(process.env.CORS_ORIGINS || '').split(','),
    process.env.DASHBOARD_URL || '',
]
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    },
}));
app.use(express.json({
    limit: '256kb',
    verify(req, _res, buffer) {
        if (req.url?.startsWith('/facebook')) {
            (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
        }
    },
}));

app.get('/', (req, res) => {
    res.send('Edutechs AI Agent Server');
});

app.get('/health', async (_req, res) => {
    const health = await getHealthStatus();
    res.status(health.status === 'ok' ? 200 : 503).json({ ...health, timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/platform-auth', platformAuthRoutes);
app.use('/platform-admin', authenticatePlatformAdmin, platformAdminRoutes);
app.use('/chat', authenticate, chatRoutes);
app.use('/agent', authenticate, requireAdministrator, agentRoutes);
app.use('/facebook', metaPublicRouter);
app.use('/facebook', facebookRoutes);
app.use('/public/:channelId', resolvePublicChannel, publicRoutes);
app.use('/google', authenticate, requireAdministrator, googleRoutes);
app.use('/admin', authenticate, adminRoutes);
app.use('/api', authenticate, productsRoutes, ordersRoutes, customersRoutes, aiUsageRoutes, courierRoutes);
app.use('/api', authenticate, metaConnectionRoutes);
app.use('/api', authenticate, dashboardRoutes);
app.use('/api/training', authenticate, trainingRoutes);
app.use('/onboarding', authenticate, onboardingRoutes);
app.use(TEST_AI_API.base, authenticate, testAiRoutes);
app.use('/api', authenticate, requireAdministrator, uploadRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Route not found', requestId: res.locals.requestId }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unhandled request error', { requestId: res.locals.requestId, message });
    res.status(500).json({ error: 'An unexpected error occurred', requestId: res.locals.requestId });
});
// Connect to MongoDB
connectMongo()
    .then(async () => {
        await ensurePlatformAdmin();
        console.log(
            'Effective LLM Model:',
            (llm as any).modelName || (llm as any).model
        );
        await warmPromptCache();
        await getAgentStatus();
        printDeveloperStatus('Connected');
    })
    .catch((error) => {
        console.error(`MongoDB startup failed: ${error instanceof Error ? error.message : String(error)}`);
        printDeveloperStatus('Unavailable');
    });

export default app;
