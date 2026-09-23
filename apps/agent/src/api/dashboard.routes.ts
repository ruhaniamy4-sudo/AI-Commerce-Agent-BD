import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdministrator } from '../auth/middleware';
import { getAgentStatus } from '../services/agentManager';
import { AIUsage } from '../models/AIUsage';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { Conversation } from '../models/Conversation';
import { CourierIntegration } from '../models/CourierIntegration';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { requireTenantContext } from '../tenancy/context';
import { announcementsForBusiness, countUnread } from '../services/platform-announcement.service';
import { resolveFeatureFlags } from '../services/feature-flag.service';
import { effectiveSettings } from '../services/platform-settings.service';

const router = Router();
router.get('/dashboard/overview', requireAdministrator, async (_req, res) => {
    const { businessId } = requireTenantContext(); const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [business, conversations, humanControlled, customers, newCustomers, products, knowledge, ordersByStatus, sales, usage, channels, courier, recentOrders, agentStatus] = await Promise.all([
        Business.findById(businessId).lean(), Conversation.countDocuments({}), Conversation.countDocuments({ controlMode: 'HUMAN_ACTIVE' }), Customer.countDocuments({}), Customer.countDocuments({ createdAt: { $gte: since } }), Product.countDocuments({ isActive: true }), Knowledge.countDocuments({ status: 'active' }),
        Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Order.aggregate([{ $match: { status: { $in: ['confirmed', 'packed', 'shipped', 'delivered', 'completed'] } } }, { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }]),
        AIUsage.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: null, requests: { $sum: 1 }, totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, estimatedCost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } }]),
        BusinessChannel.find({ businessId }).select('platform name status').lean(), CourierIntegration.findOne({ provider: 'steadfast' }).select('status').lean(),
        Order.find({}).select('orderNumber total status createdAt').sort({ createdAt: -1 }).limit(5).lean(), getAgentStatus(),
    ]);
    const statuses = Object.fromEntries(ordersByStatus.map((row: any) => [row._id, row.count]));
    res.json({ business: business ? { name: business.name, onboardingComplete: Boolean(business.onboarding?.completedAt), onboarding: business.onboarding } : null,
        conversations, humanControlled, customers, newCustomers, products, knowledge, orders: statuses, revenue: sales[0]?.revenue || 0, salesOrders: sales[0]?.orders || 0,
        usage: usage[0] || { requests: 0, totalTokens: 0, estimatedCost: 0 }, channels, courier: courier?.status || 'not_configured', recentOrders, agentStatus });
});
/**
 * What the platform is currently telling this workspace: live announcements, the
 * feature flags it resolves to, and the handful of platform settings the merchant
 * dashboard renders. Every member reads it, not just administrators, because a
 * maintenance or billing notice has to reach whoever is working.
 */
router.get('/dashboard/platform-notices', async (_req, res) => {
    const { businessId, userId } = requireTenantContext();
    const [announcements, flags, settings, user] = await Promise.all([
        announcementsForBusiness(businessId),
        resolveFeatureFlags(businessId),
        effectiveSettings(),
        User.collection.findOne({ _id: new mongoose.Types.ObjectId(userId) }, { projection: { announcementsSeenAt: 1 } }),
    ]);
    const publicKeys = ['platform.name', 'platform.support_email', 'platform.status_page_url', 'support.enabled', 'support.chat_url', 'support.onboarding_call_url', 'support.response_sla_hours', 'compliance.privacy_policy_url', 'compliance.terms_url', 'localization.default_locale', 'localization.supported_locales', 'localization.default_timezone', 'subscription.allow_self_serve'];
    res.json({
        announcements,
        unreadCount: countUnread(announcements as Array<{ publishedAt?: Date }>, user?.announcementsSeenAt),
        seenAt: user?.announcementsSeenAt || null,
        flags,
        settings: Object.fromEntries(settings.filter(row => publicKeys.includes(row.key)).map(row => [row.key, row.value])),
    });
});

/** Opening the announcements panel marks everything currently published as read. */
router.post('/dashboard/platform-notices/seen', async (_req, res) => {
    const { userId } = requireTenantContext();
    const seenAt = new Date();
    await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { announcementsSeenAt: seenAt } });
    res.json({ seenAt });
});

export default router;
