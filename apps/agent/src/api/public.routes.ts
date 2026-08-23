import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import chatRoutes from './chat.routes';

const router = Router({ mergeParams: true });

router.use('/chat', chatRoutes);

router.get('/products', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query: Record<string, unknown> = { isActive: true };
    if (req.query.search) query.$text = { $search: String(req.query.search) };
    if (req.query.categoryId) query.categoryId = req.query.categoryId;
    const [data, total] = await Promise.all([
        Product.find(query).sort({ isFeatured: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Product.countDocuments(query),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.get('/products/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    const identity = mongoose.Types.ObjectId.isValid(identifier) ? { _id: identifier } : { slug: identifier };
    const product = await Product.findOne({ ...identity, isActive: true }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
});

router.get('/categories', async (_req, res) => {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    res.json(categories);
});

export default router;
