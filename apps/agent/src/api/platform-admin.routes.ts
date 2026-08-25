import { Router } from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { PlatformAdminAuthenticatedRequest } from '../auth/middleware';
import { AIUsage } from '../models/AIUsage';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { BusinessMember } from '../models/BusinessMember';
import { Conversation } from '../models/Conversation';
import { CourierIntegration } from '../models/CourierIntegration';
import { Customer } from '../models/Customer';
import { ErrorLog } from '../models/ErrorLog';
import { Order } from '../models/Order';
import { User } from '../models/User';

const router = Router();
const safeRegex = (value: unknown) => new RegExp(String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80), 'i');

router.get('/me', (req: PlatformAdminAuthenticatedRequest, res) => res.json(req.platformAdmin));

router.get('/overview', async (_req, res) => {
    const [businesses, activeBusinesses, users, conversations, orders, usage, facebookChannels, courierIntegrations, errors] = await Promise.all([
        Business.collection.countDocuments({}), Business.collection.countDocuments({ status: 'active' }), User.collection.countDocuments({}),
        Conversation.collection.countDocuments({}), Order.collection.countDocuments({}),
        AIUsage.collection.aggregate([{ $group: { _id: null, requests: { $sum: 1 }, totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } }]).toArray(),
        BusinessChannel.collection.countDocuments({ platform: 'facebook', status: 'active' }),
        CourierIntegration.collection.countDocuments({ provider: 'steadfast', status: 'connected' }), ErrorLog.collection.countDocuments({}),
    ]);
    res.json({ businesses, activeBusinesses, users, conversations, orders, aiUsage: usage[0] || { requests: 0, totalTokens: 0, estimatedCost: 0 }, facebookChannels, courierIntegrations, errors });
});

router.get('/businesses', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const match = req.query.search ? { $or: [{ name: safeRegex(req.query.search) }, { slug: safeRegex(req.query.search) }] } : {};
    const pipeline: any[] = [{ $match: match }, { $sort: { createdAt: -1 } }, { $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit },
            { $lookup: { from: BusinessMember.collection.name, let: { bid: '$_id' }, pipeline: [{ $match: { $expr: { $eq: ['$businessId', '$$bid'] } } }, { $lookup: { from: User.collection.name, localField: 'userId', foreignField: '_id', as: 'user' } }, { $project: { role: 1, status: 1, user: { $arrayElemAt: ['$user', 0] } } }], as: 'members' } },
            { $lookup: { from: Conversation.collection.name, localField: '_id', foreignField: 'businessId', pipeline: [{ $count: 'count' }], as: 'conversationCount' } },
            { $lookup: { from: Order.collection.name, localField: '_id', foreignField: 'businessId', pipeline: [{ $count: 'count' }], as: 'orderCount' } },
            { $lookup: { from: Customer.collection.name, localField: '_id', foreignField: 'businessId', pipeline: [{ $count: 'count' }], as: 'customerCount' } },
            { $project: { name: 1, slug: 1, status: 1, businessType: 1, phone: 1, preferredLanguage: 1, currency: 1, onboarding: 1, createdAt: 1,
                members: { $map: { input: '$members', as: 'member', in: { role: '$$member.role', status: '$$member.status', user: { id: '$$member.user._id', name: '$$member.user.name', email: '$$member.user.email' } } } },
                conversations: { $ifNull: [{ $arrayElemAt: ['$conversationCount.count', 0] }, 0] }, orders: { $ifNull: [{ $arrayElemAt: ['$orderCount.count', 0] }, 0] }, customers: { $ifNull: [{ $arrayElemAt: ['$customerCount.count', 0] }, 0] } } }],
        total: [{ $count: 'count' }],
    } }];
    const [result] = await Business.collection.aggregate(pipeline).toArray(); const total = result.total[0]?.count || 0;
    res.json({ data: result.data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.patch('/businesses/:id/status', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !['active', 'suspended'].includes(req.body?.status)) return res.status(400).json({ error: 'Valid business and status are required' });
    const result = await Business.collection.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(req.params.id) }, { $set: { status: req.body.status, updatedAt: new Date() } }, { returnDocument: 'after', projection: { name: 1, slug: 1, status: 1 } });
    if (!result) return res.status(404).json({ error: 'Business not found' }); res.json(result);
});

router.get('/users', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const match = req.query.search ? { $or: [{ name: safeRegex(req.query.search) }, { email: safeRegex(req.query.search) }] } : {};
    const [data, total] = await Promise.all([
        User.collection.aggregate([{ $match: match }, { $sort: { createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
            { $lookup: { from: BusinessMember.collection.name, localField: '_id', foreignField: 'userId', pipeline: [{ $lookup: { from: Business.collection.name, localField: 'businessId', foreignField: '_id', as: 'business' } }, { $project: { role: 1, status: 1, business: { $arrayElemAt: ['$business', 0] } } }], as: 'memberships' } },
            { $project: { name: 1, email: 1, emailVerified: 1, status: 1, createdAt: 1, 'memberships.role': 1, 'memberships.status': 1, 'memberships.business._id': 1, 'memberships.business.name': 1 } }]).toArray(),
        User.collection.countDocuments(match),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.get('/usage', async (_req, res) => {
    const data = await AIUsage.collection.aggregate([{ $group: { _id: '$businessId', requests: { $sum: 1 }, inputTokens: { $sum: { $ifNull: ['$inputTokens', 0] } }, outputTokens: { $sum: { $ifNull: ['$outputTokens', 0] } }, totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } }, { $lookup: { from: Business.collection.name, localField: '_id', foreignField: '_id', as: 'business' } }, { $project: { businessId: '$_id', businessName: { $ifNull: [{ $arrayElemAt: ['$business.name', 0] }, 'Deleted business'] }, requests: 1, inputTokens: 1, outputTokens: 1, totalTokens: 1, estimatedCost: 1 } }, { $sort: { estimatedCost: -1 } }]).toArray();
    res.json(data);
});

router.get('/integrations', async (_req, res) => {
    const [channels, couriers] = await Promise.all([
        BusinessChannel.collection.aggregate([{ $group: { _id: { platform: '$platform', status: '$status' }, count: { $sum: 1 } } }]).toArray(),
        CourierIntegration.collection.aggregate([{ $group: { _id: { provider: '$provider', status: '$status' }, count: { $sum: 1 } } }]).toArray(),
    ]); res.json({ channels, couriers });
});

router.get('/errors', async (_req, res) => {
    const errors = await ErrorLog.collection.find({}, { projection: { type: 1, message: 1, timestamp: 1 } }).sort({ timestamp: -1 }).limit(100).toArray();
    res.json(errors.map(error => ({ ...error, message: String(error.message || '').slice(0, 1000)
        .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
        .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted key]')
        .replace(/(secret|token|password|api[_ -]?key)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]') })));
});

router.get('/health', async (_req, res) => {
    let redis: 'connected' | 'unavailable' = 'unavailable';
    const client = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379, lazyConnect: true, connectTimeout: 1000, maxRetriesPerRequest: 0 });
    try { await client.connect(); redis = await client.ping() === 'PONG' ? 'connected' : 'unavailable'; } catch { redis = 'unavailable'; } finally { client.disconnect(); }
    const mongo = mongoose.connection.readyState === 1 ? 'connected' : 'unavailable';
    const [facebookChannels, steadfastConnections] = await Promise.all([BusinessChannel.collection.countDocuments({ platform: 'facebook', status: 'active' }), CourierIntegration.collection.countDocuments({ provider: 'steadfast', status: 'connected' })]);
    res.json({ api: 'connected', mongo, redis, worker: 'not_observed', openaiConfigured: Boolean(process.env.OPENAI_API_KEY), facebookConfigured: Boolean(process.env.FB_APP_SECRET && process.env.FB_VERIFY_TOKEN), facebookChannels, steadfastConnections });
});

export default router;
