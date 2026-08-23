import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { assertTenantBusinessId } from '../tenancy/context';

export async function getDeterministicResponse(businessId: string, text: string) {
    assertTenantBusinessId(businessId, 'deterministic-response');
    const orderMatch = text.match(/\border\s*#?\s*([a-z0-9-]{6,})\b/i);
    if (orderMatch && /status|where|track|অবস্থা/i.test(text)) {
        const order = await Order.findOne({ orderNumber: orderMatch[1].toUpperCase() }).select('orderNumber status').lean();
        if (order) return `Order #${order.orderNumber} is currently ${order.status}.`;
    }

    const skuMatch = text.match(/\b(?:sku|stock|price)\s*[:#-]?\s*([a-z0-9-]{3,})\b/i);
    if (skuMatch && /stock|available|availability|price|cost|আছে|দাম/i.test(text)) {
        const product = await Product.findOne({
            $or: [{ slug: skuMatch[1].toLowerCase() }, { 'variants.sku': skuMatch[1] }],
            isActive: true,
        }).select('name basePrice stock variants').lean();
        if (product) {
            const variant = product.variants?.find((item: any) => item.sku.toLowerCase() === skuMatch[1].toLowerCase());
            const availableStock = variant?.stock ?? product.stock;
            const price = variant?.price ?? product.basePrice;
            if (/price|cost|দাম/i.test(text)) {
                return `${product.name} is priced at ${price} and currently has ${availableStock} unit(s) in stock.`;
            }
            return `${product.name} currently has ${availableStock} unit(s) in stock.`;
        }
    }
    return null;
}
