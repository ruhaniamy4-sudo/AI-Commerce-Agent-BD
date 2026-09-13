/**
 * Proves the merchant inbox against a real database: every connected channel
 * lands in one list, Test AI rehearsals stay on their own tab, threads with no
 * messages are never listed, and each row carries the customer, the channel and
 * who owes the reply.
 *
 * Run: npm run validate:inbox
 */
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { saveMessage } from '../services/memory.service';
import { withTenantContext } from '../tenancy/context';
import adminRoutes from '../api/admin.routes';

async function main() {
    const server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());

    const businessId = new mongoose.Types.ObjectId().toString();
    const otherBusinessId = new mongoose.Types.ObjectId().toString();
    const principal = { businessId, userId: 'validation', membershipId: 'validation', role: 'Owner' as const };
    const app = express()
        .use(express.json())
        .use((req, _res, next) => {
            (req as any).auth = principal;
            withTenantContext(principal, () => next());
        })
        .use('/api', adminRoutes);

    try {
        await withTenantContext(principal, async () => {
            const rafi = await Customer.create({ psid: 'fb:1', name: 'Rafiul Islam', phone: '01712345678', notes: '' });
            const mim = await Customer.create({ psid: 'wa:880171', name: 'Mim Akter', phone: '01812345678', notes: '' });

            await Conversation.create({
                conversationId: 'fb_page_1', customerId: rafi._id, psid: 'fb-psid-1', platform: 'facebook',
                messageCount: 8, lastMessagePreview: 'kalke pabo to?', lastMessageAt: new Date('2026-09-13T09:00:00Z'),
                controlMode: 'AI_ACTIVE',
            });
            await Conversation.create({
                conversationId: 'wa_555_880171', customerId: mim._id, psid: '880171', platform: 'whatsapp',
                messageCount: 4, lastMessagePreview: 'order ta kobe pabo?', lastMessageAt: new Date('2026-09-13T10:00:00Z'),
                controlMode: 'HUMAN_ACTIVE', needsHumanHandoff: true,
            });
            await Conversation.create({
                conversationId: 'web_1', platform: 'web-widget', psid: 'web-1',
                messageCount: 2, lastMessagePreview: 'dam koto?', lastMessageAt: new Date('2026-09-13T08:00:00Z'),
            });
            await Conversation.create({
                conversationId: 'test_sandbox_1', platform: 'manual', metadata: { testMode: true },
                messageCount: 20, lastMessagePreview: 'ORD-SANDBOX-1 test mode', lastMessageAt: new Date('2026-09-13T11:00:00Z'),
            });
            // The empty threads that used to fill the merchant's screen.
            await Conversation.create({ conversationId: 'empty_1', platform: 'manual', metadata: { testMode: true }, messageCount: 0 });
            await Conversation.create({ conversationId: 'empty_2', platform: 'facebook', messageCount: 0 });
        });

        // Another merchant's thread must never appear in this inbox.
        await withTenantContext({ ...principal, businessId: otherBusinessId }, async () => {
            await Conversation.create({
                conversationId: 'fb_other', platform: 'facebook', messageCount: 5,
                lastMessagePreview: 'another merchant', lastMessageAt: new Date(),
            });
        });

        // ── The default inbox: real customers only ───────────────────────────
        const inbox = await request(app).get('/api/conversations').expect(200);
        const listed = inbox.body.data.map((row: any) => row.conversationId);
        assert.deepEqual(listed.sort(), ['fb_page_1', 'wa_555_880171', 'web_1'], `default inbox must show only real threads, got ${listed}`);
        assert.ok(!listed.includes('test_sandbox_1'), 'Test AI rehearsals must not bury real customers');
        assert.ok(!listed.some((id: string) => id.startsWith('empty')), 'threads with no messages must never be listed');
        assert.ok(!listed.includes('fb_other'), 'another business must never leak into this inbox');

        // ── Each row carries what the merchant needs at a glance ─────────────
        const whatsapp = inbox.body.data.find((row: any) => row.conversationId === 'wa_555_880171');
        assert.equal(whatsapp.channel, 'whatsapp');
        assert.equal(whatsapp.customer.name, 'Mim Akter');
        assert.equal(whatsapp.customer.phone, '01812345678');
        assert.equal(whatsapp.controlMode, 'HUMAN_ACTIVE');
        assert.equal(whatsapp.needsHumanHandoff, true);
        assert.equal(whatsapp.lastMessage, 'order ta kobe pabo?');
        assert.equal(whatsapp.messageCount, 4);
        assert.equal(inbox.body.data.find((row: any) => row.conversationId === 'fb_page_1').channel, 'messenger');
        assert.equal(inbox.body.data.find((row: any) => row.conversationId === 'web_1').channel, 'web');

        // Most recent first, so the newest customer is never buried.
        assert.equal(inbox.body.data[0].conversationId, 'wa_555_880171');

        // ── Tabs ─────────────────────────────────────────────────────────────
        assert.deepEqual(inbox.body.counts, { all: 3, messenger: 1, whatsapp: 1, web: 1, test: 1, needsAttention: 1, unread: 0 });

        const messengerTab = await request(app).get('/api/conversations?channel=messenger').expect(200);
        assert.deepEqual(messengerTab.body.data.map((row: any) => row.conversationId), ['fb_page_1']);

        const testTab = await request(app).get('/api/conversations?channel=test').expect(200);
        assert.deepEqual(testTab.body.data.map((row: any) => row.conversationId), ['test_sandbox_1'], 'the Test AI tab keeps the rehearsals reachable');

        const waiting = await request(app).get('/api/conversations?state=needs_attention').expect(200);
        assert.deepEqual(waiting.body.data.map((row: any) => row.conversationId), ['wa_555_880171']);

        const aiHandled = await request(app).get('/api/conversations?state=ai').expect(200);
        assert.ok(aiHandled.body.data.every((row: any) => row.controlMode === 'AI_ACTIVE'));

        // ── Search finds people, not just message text ───────────────────────
        const byName = await request(app).get('/api/conversations?search=Mim').expect(200);
        assert.deepEqual(byName.body.data.map((row: any) => row.conversationId), ['wa_555_880171'], 'searching a customer name must find their thread');
        const byPhone = await request(app).get('/api/conversations?search=01712345678').expect(200);
        assert.deepEqual(byPhone.body.data.map((row: any) => row.conversationId), ['fb_page_1']);
        const byMessage = await request(app).get('/api/conversations?search=kalke').expect(200);
        assert.deepEqual(byMessage.body.data.map((row: any) => row.conversationId), ['fb_page_1']);

        // ── Unread: a customer message waits, our own reply does not ─────────
        const quiet = await request(app).get('/api/conversations/pulse').expect(200);
        assert.equal(quiet.body.unread, 0);

        await withTenantContext(principal, async () => {
            await saveMessage(businessId, 'fb_page_1', 'user', 'vaiya ekta update den?');
        });
        const afterCustomer = await request(app).get('/api/conversations/pulse').expect(200);
        assert.equal(afterCustomer.body.unread, 1, 'a customer message must mark the thread unread');
        assert.notEqual(afterCustomer.body.version, quiet.body.version, 'the pulse version must move when something happens');

        const unreadTab = await request(app).get('/api/conversations?state=unread').expect(200);
        assert.deepEqual(unreadTab.body.data.map((row: any) => row.conversationId), ['fb_page_1']);
        assert.equal(unreadTab.body.data[0].unread, true, 'the row itself must say it is unread');

        await withTenantContext(principal, async () => {
            await saveMessage(businessId, 'fb_page_1', 'assistant', 'Jee vaiya, kalke pathabo.');
        });
        const afterOurReply = await request(app).get('/api/conversations/pulse').expect(200);
        assert.equal(afterOurReply.body.unread, 1, 'our own reply must never clear the unread mark on its own');

        // ── Opening the thread is what clears it ─────────────────────────────
        const read = await request(app).post('/api/conversations/fb_page_1/read').expect(200);
        assert.equal(read.body.unread, false);
        assert.ok(read.body.lastReadAt, 'reading a thread must record when it happened');
        const afterRead = await request(app).get('/api/conversations/pulse').expect(200);
        assert.equal(afterRead.body.unread, 0);
        assert.notEqual(afterRead.body.version, afterOurReply.body.version, 'clearing unread must repaint the inbox');

        const stillListed = await request(app).get('/api/conversations?state=unread').expect(200);
        assert.equal(stillListed.body.data.length, 0);
        await request(app).post('/api/conversations/does_not_exist/read').expect(404);

        // ── Context beside the thread ────────────────────────────────────────
        const rafi = await withTenantContext(principal, async () => (await Customer.findOne({ psid: 'fb:1' }).lean()) as any);
        await withTenantContext(principal, async () => {
            await Order.create({
                businessId, customerId: rafi._id, conversationId: 'fb_page_1', orderNumber: 'ORD-TEST-1',
                items: [{ productId: new mongoose.Types.ObjectId(), productName: 'Ceramic Mug', sku: 'CER-CAF6', quantity: 2, unitPriceSnapshot: 450, subtotal: 900 }],
                subtotal: 900, total: 900, status: 'confirmed', paymentMethod: 'cash_on_delivery',
                shippingAddress: { fullName: 'Rafiul Islam', phone: '01712345678', addressLine1: 'Road 5, Dhanmondi', city: 'Dhaka', zone: 'Dhanmondi' },
            });
            await Conversation.updateOne({ conversationId: 'fb_page_1' }, {
                $set: { 'metadata.orderDraft': {
                    stage: 'AWAITING_ADDRESS', updatedAt: new Date().toISOString(), fullName: 'Rafiul Islam', phone: '01712345678',
                    items: [{ productId: 'p1', code: 'CER-CAF6', name: 'Ceramic Mug', unitPrice: 450, currency: 'BDT', quantity: 3 }],
                } },
            });
        });

        const context = await request(app).get('/api/conversations/fb_page_1/context').expect(200);
        assert.equal(context.body.customer.name, 'Rafiul Islam');
        assert.equal(context.body.customer.phone, '01712345678');
        assert.equal(context.body.stats.orders, 1);
        assert.equal(context.body.stats.spent, 900);
        assert.equal(context.body.recentOrders[0].orderNumber, 'ORD-TEST-1');
        assert.equal(context.body.recentOrders[0].items, 2, 'the panel counts units, not line entries');
        assert.equal(context.body.draft.stage, 'AWAITING_ADDRESS');
        assert.equal(context.body.draft.total, 1350, 'the in-progress basket must total what the customer was quoted');
        assert.equal(context.body.draft.items[0].code, 'CER-CAF6');

        // A thread with no customer yet must still answer, not fail.
        const empty = await request(app).get('/api/conversations/web_1/context').expect(200);
        assert.equal(empty.body.customer, null);
        assert.equal(empty.body.stats.orders, 0);
        assert.deepEqual(empty.body.recentOrders, []);
        assert.equal(empty.body.draft, null);

        // Another merchant's thread is not reachable by id.
        await request(app).get('/api/conversations/fb_other/context').expect(404);

        console.log('✅ inbox validated: one list per channel, sandbox separated, empty threads hidden, unread tracked, context beside the thread');
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('❌ inbox validation failed:', error);
    process.exit(1);
});
