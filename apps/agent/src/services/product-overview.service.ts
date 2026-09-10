import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { requireTenantContext } from '../tenancy/context';
import { completedSaleFilter } from './product-sales.service';

export async function getProductOverview(sort: 'most_sales' | 'newest') {
    const businessId = new mongoose.Types.ObjectId(requireTenantContext().businessId);
    const result = await Product.aggregate([
        { $match: { isActive: true } },
        { $lookup: {
            from: Order.collection.name,
            let: { productId: '$_id' },
            pipeline: [
                { $match: { businessId, ...completedSaleFilter, $expr: { $in: ['$$productId', '$items.productId'] } } },
                { $unwind: '$items' },
                { $match: { $expr: { $eq: ['$items.productId', '$$productId'] } } },
                { $group: { _id: null, units: { $sum: '$items.quantity' } } },
            ],
            as: 'sales',
        } },
        { $set: { totalSold: { $ifNull: [{ $arrayElemAt: ['$sales.units', 0] }, 0] } } },
        { $project: { name: 1, slug: 1, images: { $slice: ['$images', 1] }, basePrice: 1, salePrice: 1, currency: 1, stock: 1, variants: 1, totalSold: 1, aiSellingStatus: 1, aiSellingReason: 1, isActive: 1, createdAt: 1 } },
        { $facet: {
            topProducts: [{ $sort: sort === 'most_sales' ? { totalSold: -1, createdAt: -1, _id: 1 } : { createdAt: -1, _id: 1 } }, { $limit: 4 }],
            products: [{ $sort: { createdAt: -1, _id: 1 } }, { $limit: 6 }],
            total: [{ $count: 'value' }],
        } },
    ]);
    return { topProducts: result[0].topProducts, products: result[0].products, total: result[0].total[0]?.value || 0 };
}
