import { Router } from 'express';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { createOrderWithStock, OrderCreationError } from '../services/checkout.service';
import { requireAdministrator } from '../auth/middleware';
import { requireTenantContext } from '../tenancy/context';

const router = Router();

// Get all orders with filtering and pagination
router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const status = req.query.status as string;
        const customerId = req.query.customerId as string;
        const psid = req.query.psid as string;
        const search = req.query.search as string;
        const skip = (page - 1) * limit;

        const query: any = {};
        if (status) query.status = status;
        if (customerId) query.customerId = customerId;
        if (psid) query.psid = psid;
        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
                { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
            ];
        }

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('customerId', 'name phone psid')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Order.countDocuments(query),
        ]);

        res.json({
            data: orders,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Create new order
router.post('/orders', async (req, res) => {
    try {
        if (!req.body.customerId || !req.body.items?.length) {
            return res.status(400).json({
                error: 'Customer ID and items are required',
            });
        }
        const order = await createOrderWithStock({
            ...req.body,
            businessId: requireTenantContext().businessId,
        });
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(error instanceof OrderCreationError ? 400 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to create order',
        });
    }
});

// Update order status
router.patch('/orders/:id/status', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Update status and add to history
        order.status = status;
        order.statusHistory.push({
            status,
            timestamp: new Date(),
            note: note || `Status changed to ${status}`,
        });

        // If delivered, set actual delivery date
        if (status === 'delivered') {
            order.actualDeliveryDate = new Date();
        }

        await order.save();

        res.json(order);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Update order details
router.patch('/orders/:id', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const order = await Order.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true,
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Create manual order (admin dashboard)
router.post('/orders/manual', requireAdministrator, async (req, res) => {
    try {
        if (!req.body.customerId || !req.body.items?.length) {
            return res.status(400).json({
                error: 'Customer ID and items are required',
            });
        }
        const order = await createOrderWithStock({
            ...req.body,
            businessId: requireTenantContext().businessId,
            source: 'admin',
            createdBy: req.body.createdBy || 'admin',
        });
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating manual order:', error);
        res.status(error instanceof OrderCreationError ? 400 : 500).json({
            error: error instanceof Error ? error.message : 'Failed to create manual order',
        });
    }
});

// Update payment status with audit trail
router.patch('/orders/:id/payment-status', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus, note } = req.body;

        if (!paymentStatus || !['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
            return res.status(400).json({ error: 'Valid payment status is required' });
        }

        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Update payment status
        const previousStatus = order.paymentStatus;
        order.paymentStatus = paymentStatus;

        // Generate invoice number if payment is confirmed and no invoice exists
        if (paymentStatus === 'paid' && !order.invoiceNumber) {
            const year = new Date().getFullYear();
            const month = String(new Date().getMonth() + 1).padStart(2, '0');
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            order.invoiceNumber = `INV-${year}${month}-${random}`;
        }

        // Add to status history for audit trail
        order.statusHistory.push({
            status: order.status,
            timestamp: new Date(),
            note: note || `Payment status changed from ${previousStatus} to ${paymentStatus}`,
        });

        await order.save();

        res.json(order);
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// Get order analytics
router.get('/orders/analytics', async (req, res) => {
    try {
        const dateRange = req.query.dateRange as string || '30d';

        // Calculate date based on range
        const now = new Date();
        let startDate = new Date();

        switch (dateRange) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setDate(now.getDate() - 30);
        }

        // Aggregate order statistics
        const [
            totalRevenue,
            ordersByStatus,
            ordersByPaymentStatus,
            ordersByShippingMethod,
            recentOrders
        ] = await Promise.all([
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate }, paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: '$shippingMethod', count: { $sum: 1 } } }
            ]),
            Order.find({ createdAt: { $gte: startDate } })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('orderNumber total status paymentStatus createdAt')
                .lean()
        ]);

        res.json({
            revenue: {
                total: totalRevenue[0]?.total || 0,
                period: dateRange,
            },
            ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            ordersByPaymentStatus: ordersByPaymentStatus.reduce((acc: any, item: any) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            ordersByShippingMethod: ordersByShippingMethod.reduce((acc: any, item: any) => {
                acc[item._id || 'standard'] = item.count;
                return acc;
            }, {}),
            recentOrders,
        });
    } catch (error) {
        console.error('Error fetching order analytics:', error);
        res.status(500).json({ error: 'Failed to fetch order analytics' });
    }
});

// Keep this parameterized route after all named /orders routes.
router.get('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const selector = mongoose.Types.ObjectId.isValid(id)
            ? { $or: [{ _id: id }, { orderNumber: id }] }
            : { orderNumber: id };
        const order = await Order.findOne(selector).populate(
            'customerId',
            'name phone email psid language'
        );

        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

export default router;
