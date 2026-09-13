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
        assert.deepEqual(inbox.body.counts, { all: 3, messenger: 1, whatsapp: 1, web: 1, test: 1, needsAttention: 1 });

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

        console.log('✅ inbox validated: one list per channel, sandbox separated, empty threads hidden, customer and handler shown');
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('❌ inbox validation failed:', error);
    process.exit(1);
});
