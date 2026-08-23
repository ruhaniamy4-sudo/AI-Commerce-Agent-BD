import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

import { llm } from './agent/agent';
import adminRoutes from './api/admin.routes';
import agentRoutes from './api/agent.routes';
import chatRoutes from './api/chat.routes';
import facebookRoutes from './api/facebook.routes';
import googleRoutes from './api/google.routes';
import productsRoutes from './api/products.routes';
import ordersRoutes from './api/orders.routes';
import customersRoutes from './api/customers.routes';
import uploadRoutes from './api/upload.routes';
import authRoutes from './api/auth.routes';
import { authenticate, requireAdministrator } from './auth/middleware';
import { resolvePublicChannel } from './auth/channel.middleware';
import publicRoutes from './api/public.routes';
import { connectMongo } from './db/mongodb';
import { getAgentStatus } from './services/agentManager';
import { warmPromptCache } from './services/systemPrompt.service';
import morgan from 'morgan';

// var morgan = require('morgan');
dotenv.config();
const app = express();

app.use(morgan('tiny'));
const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
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
    verify(req, _res, buffer) {
        if (req.url?.startsWith('/facebook')) {
            (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
        }
    },
}));

app.get('/', (req, res) => {
    res.send('Edutechs AI Agent Server');
});

app.get('/health', (_req, res) => {
    const mongoStates: Record<number, string> = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };
    const mongo = mongoStates[mongoose.connection.readyState] || 'unknown';
    res.status(mongo === 'connected' ? 200 : 503).json({
        status: mongo === 'connected' ? 'ok' : 'degraded',
        service: 'agent',
        mongo,
        timestamp: new Date().toISOString(),
    });
});

app.use('/auth', authRoutes);
app.use('/chat', authenticate, chatRoutes);
app.use('/agent', authenticate, requireAdministrator, agentRoutes);
app.use('/facebook', facebookRoutes);
app.use('/public/:channelId', resolvePublicChannel, publicRoutes);
app.use('/google', authenticate, requireAdministrator, googleRoutes);
app.use('/admin', authenticate, adminRoutes);
app.use('/api', authenticate, productsRoutes, ordersRoutes, customersRoutes);
app.use('/api', authenticate, requireAdministrator, uploadRoutes);
// Connect to MongoDB
connectMongo()
    .then(async () => {
        console.log(
            'Effective LLM Model:',
            (llm as any).modelName || (llm as any).model
        );
        await warmPromptCache();
        await getAgentStatus();
    })
    .catch(console.error);

export default app;
