import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { assertTenantBusinessId } from '../tenancy/context';

const deliveryIntent = /status|where|track|parcel|delivery|koi|kothay|hoise|অবস্থা|কোথায়|পার্সেল|ডেলিভারি/i;

const courierStatusLabels: Record<string, string> = {
    pending: 'pending courier processing',
    submitted: 'submitted to Steadfast',
    in_transit: 'in transit',
    delivered: 'delivered',
    cancelled: 'cancelled',
    returned: 'returned',
    failed: 'affected by a courier processing issue',
    unknown: 'awaiting a confirmed courier update',
};

function formatOrderStatus(order: any) {
    const status = order.courier?.status ? courierStatusLabels[order.courier.status] || 'awaiting a confirmed courier update' : order.status;
    const tracking = order.courier?.trackingCode ? ` Tracking code: ${order.courier.trackingCode}.` : '';
    return `Order #${order.orderNumber} is currently ${status}.${tracking}`;
}

export async function getDeterministicResponse(businessId: string, text: string, customerReference?: { psid?: string }) {
    assertTenantBusinessId(businessId, 'deterministic-response');
    const orderMatch = text.match(/\border\s*#?\s*([a-z0-9-]{6,})\b/i);
    if (deliveryIntent.test(text) && (orderMatch || customerReference?.psid)) {
        const query = orderMatch
            ? Order.findOne({ orderNumber: orderMatch[1].toUpperCase() })
            : Order.findOne({ psid: customerReference?.psid }).sort({ createdAt: -1 });
        const order = await query.select('orderNumber status courier').lean();
        if (order) return formatOrderStatus(order);
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
