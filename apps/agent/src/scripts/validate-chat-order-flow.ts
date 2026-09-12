/**
 * End-to-end proof that a chat order really moves inventory.
 *
 * The unit tests mock `createOrderWithStock`; this script runs the whole
 * conversation against a real MongoDB replica set (transactions required) and
 * asserts the things a merchant actually cares about: one order, one order
 * number, stock down by exactly the ordered quantity, and no double-charge when
 * the same inbound event is delivered twice.
 *
 * Run: npm run validate:order-flow
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Business } from '../models/Business';
import { Category } from '../models/Category';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from '../services/deterministic-response.service';
import { createOrderWithStock, OrderCreationError } from '../services/checkout.service';

const conversationId = 'validation-order-flow';

async function main() {
    const cluster = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(cluster.getUri());

    const businessId = new mongoose.Types.ObjectId().toString();
    const context = { businessId, userId: 'validation', membershipId: 'validation', role: 'Owner' as const };
    const turn = (text: string, eventIdentifier: string) =>
        withTenantContext(context, () => getDeterministicResponse(businessId, text, { conversationId, psid: 'web-validation', eventIdentifier })) as Promise<any>;

    try {
        await withTenantContext(context, async () => {
            await Business.create({
                _id: businessId, name: 'Validation Store', slug: 'validation-store', ownerUserId: new mongoose.Types.ObjectId(),
                businessType: 'ECOMMERCE', commerce: { paymentMethods: ['Cash on Delivery'], deliveryFees: { insideDhaka: 80, outsideDhaka: 130 } },
            } as any);
            const category = await Category.create({ name: 'Kitchen', slug: 'kitchen' });
            const product = await Product.create({
                name: 'Ceramic Coffee Mug', slug: 'ceramic-coffee-mug', categoryId: category._id,
                basePrice: 600, salePrice: 550, stock: 5, description: 'Stoneware mug', merchantConfirmed: true,
            });
            const customer = await Customer.create({ psid: 'web-validation', name: 'Web User', notes: '' });
            await Conversation.create({
                conversationId, customerId: customer._id, psid: 'web-validation', platform: 'web-widget',
                metadata: { entityState: { activeProductId: String(product._id) } },
            });

            // ── The conversation ────────────────────────────────────────────
            const code = (await Product.findById(product._id))!.publicCode;
            assert.ok(/^[A-Z]{3}-[A-Z0-9]{4,6}$/.test(code), `every product needs a quotable code, got ${code}`);
            const listing = await turn('ki ki mug ache?', 'evt-0');
            assert.ok(listing.message_text.includes(code), 'a product list must show the code the customer can order with');
            assert.ok(!/[*_`#]/.test(listing.message_text), 'replies must be plain text for Messenger and WhatsApp');

            // Ordering by the quoted code, exactly as a customer would.
            const started = await turn(`${code} ta nibo`, 'evt-1');
            assert.equal(started.intent, 'ORDER_FLOW', 'an order intent must enter the checkout flow');
            await turn('Rafiul Islam', 'evt-2');
            await turn('01712345678', 'evt-3');
            const summary = await turn('House 12, Road 5, Dhanmondi, Dhaka', 'evt-4');
            assert.ok(summary.message_text.includes('৳630'), `summary must quote salePrice + delivery, got: ${summary.message_text}`);
            assert.equal(await Order.countDocuments({}), 0, 'no order may exist before the customer confirms');
            assert.equal((await Product.findById(product._id))!.stock, 5, 'stock must not move before confirmation');

            const confirmed = await turn('confirm', 'evt-confirm');

            // ── What the merchant and customer must both be able to rely on ──
            const orders = await Order.find({});
            assert.equal(orders.length, 1, 'exactly one order must be created');
            const order = orders[0];
            assert.ok(/^ORD-/.test(order.orderNumber), `order number must be customer-facing, got ${order.orderNumber}`);
            assert.ok(confirmed.message_text.includes(order.orderNumber), 'the customer must be told the order id');
            assert.equal(confirmed.orderCreated.orderNumber, order.orderNumber);
            assert.equal(order.items[0].unitPriceSnapshot, 550, 'the charged price must equal the quoted sale price');
            assert.equal(order.total, 630, 'total must be items + delivery fee');
            assert.equal(order.deliveryFee, 80, 'a Dhaka address pays the inside-Dhaka fee');
            assert.equal(order.shippingAddress.addressLine1, 'House 12, Road 5, Dhanmondi, Dhaka');
            assert.equal(order.shippingAddress.phone, '01712345678');
            assert.equal(order.shippingAddress.city, 'Dhaka');
            assert.equal(String(order.customerId), String(customer._id), 'the order must belong to this customer');

            assert.equal((await Product.findById(product._id))!.stock, 4, 'stock must drop by the ordered quantity');
            const updatedCustomer = await Customer.findById(customer._id);
            assert.equal(updatedCustomer!.totalOrders, 1);
            assert.equal(updatedCustomer!.addresses[0].addressLine1, 'House 12, Road 5, Dhanmondi, Dhaka');
            assert.equal((await Conversation.findOne({ conversationId }))!.metadata.orderDraft, undefined, 'the draft must be cleared after success');

            // ── A redelivered inbound event must not sell the item twice ─────
            const replay = await createOrderWithStock({
                businessId, customerId: customer._id, psid: 'web-validation',
                items: [{ productId: product._id, quantity: 1 }],
                shippingAddress: { ...order.shippingAddress },
                deliveryFee: 80, idempotencyKey: 'evt-confirm',
            });
            assert.equal(String(replay._id), String(order._id), 'the same event id must return the same order');
            assert.equal(await Order.countDocuments({}), 1, 'a replay must not create a second order');
            assert.equal((await Product.findById(product._id))!.stock, 4, 'a replay must not decrement stock again');

            // ── Overselling must fail loudly, with stock untouched ───────────
            await assert.rejects(
                () => createOrderWithStock({
                    businessId, customerId: customer._id, psid: 'web-validation',
                    items: [{ productId: product._id, quantity: 99 }],
                    shippingAddress: { ...order.shippingAddress }, deliveryFee: 80, idempotencyKey: 'evt-oversell',
                }),
                (error: unknown) => error instanceof OrderCreationError,
                'ordering more than the live stock must be rejected',
            );
            assert.equal((await Product.findById(product._id))!.stock, 4, 'a failed order must leave stock unchanged');
            assert.equal(await Order.countDocuments({}), 1, 'a failed order must not be persisted');
        });
        console.log('✅ chat order flow validated: order id issued, stock adjusted, replays and overselling rejected');
    } finally {
        await mongoose.disconnect();
        await cluster.stop();
    }
}

main().catch((error) => {
    console.error('❌ chat order flow validation failed:', error);
    process.exit(1);
});
