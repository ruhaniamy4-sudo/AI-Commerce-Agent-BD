/**
 * Proves the connection-health view against a real database: a healthy channel
 * reads as healthy, a lapsed webhook offers the smaller repair, an expired token
 * asks for a reconnect, and nothing is ever claimed that was not actually checked.
 *
 * Run: npm run validate:channel-health
 */
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BusinessChannel } from '../models/BusinessChannel';
import { withTenantContext } from '../tenancy/context';
import metaConnectionRoutes from '../api/meta-connection.routes';

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
        .use('/api', metaConnectionRoutes);

    try {
        await withTenantContext(principal, async () => {
            await BusinessChannel.create({
                businessId, platform: 'facebook', externalId: 'page-1', name: 'Healthy Page',
                status: 'active', connectionStatus: 'CONNECTED', lastVerifiedAt: new Date(), lastInboundAt: new Date(),
                subscription: { subscribed: true, fields: ['messages', 'messaging_postbacks'], verifiedAt: new Date() },
            });
            await BusinessChannel.create({
                businessId, platform: 'whatsapp', externalId: '123456789', name: 'Shop WhatsApp',
                status: 'disabled', connectionStatus: 'CONNECTED', lastVerifiedAt: new Date(),
            });
        });
        await withTenantContext({ ...principal, businessId: otherBusinessId }, async () => {
            await BusinessChannel.create({
                businessId: otherBusinessId, platform: 'facebook', externalId: 'page-other', name: 'Another merchant',
                status: 'active', connectionStatus: 'CONNECTED',
            });
        });

        const response = await request(app).get('/api/integrations/health').expect(200);
        const messenger = response.body.channels.find((entry: any) => entry.channel === 'messenger');
        const whatsapp = response.body.channels.find((entry: any) => entry.channel === 'whatsapp');
        const check = (channel: any, key: string) => channel.checks.find((entry: any) => entry.key === key);

        assert.equal(response.body.channels.length, 2, 'another merchant’s channels must never appear here');

        // ── A healthy Messenger Page ─────────────────────────────────────────
        assert.equal(messenger.state, 'connected');
        assert.equal(check(messenger, 'token').state, 'pass');
        assert.equal(check(messenger, 'webhook').state, 'pass');
        assert.match(check(messenger, 'webhook').detail, /messaging_postbacks/);
        assert.equal(check(messenger, 'traffic').state, 'pass');
        assert.equal(check(messenger, 'ai').state, 'pass');

        // ── WhatsApp: verified token, unreadable webhook, paused AI ──────────
        assert.equal(check(whatsapp, 'token').state, 'pass');
        assert.equal(check(whatsapp, 'webhook').state, 'unknown', 'a webhook we cannot read must never show as healthy');
        assert.equal(check(whatsapp, 'webhook').action, 'configure_webhook');
        assert.equal(check(whatsapp, 'traffic').state, 'warn');
        assert.equal(check(whatsapp, 'ai').action, 'enable_ai');

        // ── A lapsed subscription asks for the smaller repair ────────────────
        await withTenantContext(principal, async () => {
            await BusinessChannel.updateOne(
                { businessId, externalId: 'page-1' },
                { $set: { connectionStatus: 'NEEDS_ATTENTION', 'subscription.subscribed': false, 'subscription.fields': [] } },
            );
        });
        const lapsed = await request(app).get('/api/integrations/health').expect(200);
        const lapsedMessenger = lapsed.body.channels.find((entry: any) => entry.channel === 'messenger');
        assert.equal(lapsedMessenger.state, 'attention');
        assert.equal(check(lapsedMessenger, 'webhook').action, 'resubscribe', 'a dropped subscription must not force a full reconnect');
        assert.equal(check(lapsedMessenger, 'token').state, 'pass', 'the token is still good, so it must not be blamed');

        // ── An expired token is the one case that needs reconnecting ─────────
        await withTenantContext(principal, async () => {
            await BusinessChannel.updateOne(
                { businessId, externalId: 'page-1' },
                { $set: { connectionStatus: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true } },
            );
        });
        const expired = await request(app).get('/api/integrations/health').expect(200);
        const expiredMessenger = expired.body.channels.find((entry: any) => entry.channel === 'messenger');
        assert.equal(check(expiredMessenger, 'token').action, 'reconnect');

        // ── The deployment's own readiness travels with the report ───────────
        assert.equal(typeof response.body.platform.queueReady, 'boolean');
        assert.equal(typeof response.body.platform.messengerReady, 'boolean');
        assert.equal(typeof response.body.platform.whatsappReady, 'boolean');
        assert.ok(!JSON.stringify(response.body).match(/encryptedAccessToken|APP_SECRET|VERIFY_TOKEN/), 'health must never leak credentials');

        console.log('✅ channel health validated: real checks only, right repair per failure, no credentials exposed');
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('❌ channel health validation failed:', error);
    process.exit(1);
});
