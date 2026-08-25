import { Router } from 'express';
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
import { requireTenantContext } from '../tenancy/context';

const router = Router();
router.get('/dashboard/overview', async (_req, res) => {
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
export default router;
