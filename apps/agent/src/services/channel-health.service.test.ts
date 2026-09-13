import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessChannel } from '../models/BusinessChannel';
import { withTenantContext } from '../tenancy/context';
import { getChannelHealth, platformReadiness } from './channel-health.service';

const businessId = new mongoose.Types.ObjectId().toString();
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Owner' }, work);

function mockChannels(channels: any[]) {
    vi.spyOn(BusinessChannel, 'find').mockReturnValue({
        select: () => ({ sort: () => ({ lean: () => Promise.resolve(channels) }) }),
    } as never);
}

const check = (health: any, key: string) => health.checks.find((entry: any) => entry.key === key);

describe('channel health', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reports a healthy Messenger Page as working, with what Meta confirmed', async () => {
        mockChannels([{
            _id: 'c1', platform: 'facebook', name: 'My Shop', status: 'active', connectionStatus: 'CONNECTED',
            subscription: { subscribed: true, fields: ['messages', 'messaging_postbacks'] },
            lastVerifiedAt: new Date(), lastInboundAt: new Date(),
        }]);

        const { channels } = await tenant(() => getChannelHealth(businessId));
        expect(channels[0].state).toBe('connected');
        expect(check(channels[0], 'token').state).toBe('pass');
        expect(check(channels[0], 'webhook').state).toBe('pass');
        expect(check(channels[0], 'webhook').detail).toContain('messaging_postbacks');
        expect(check(channels[0], 'traffic').state).toBe('pass');
    });

    it('calls out a Page that lost its webhook subscription, and offers the smaller repair', async () => {
        mockChannels([{
            _id: 'c1', platform: 'facebook', name: 'My Shop', status: 'active', connectionStatus: 'NEEDS_ATTENTION',
            subscription: { subscribed: false, fields: [] }, lastVerifiedAt: new Date(),
        }]);

        const { channels } = await tenant(() => getChannelHealth(businessId));
        expect(channels[0].state).toBe('attention');
        const webhook = check(channels[0], 'webhook');
        expect(webhook.state).toBe('fail');
        expect(webhook.action).toBe('resubscribe');   // not a full reconnect
        expect(webhook.detail).toMatch(/never reach/i);
    });

    it('asks for a reconnect only when the token itself is rejected', async () => {
        mockChannels([{
            _id: 'c1', platform: 'facebook', name: 'My Shop', status: 'active',
            connectionStatus: 'REAUTHORIZATION_REQUIRED', reauthorizationRequired: true,
            subscription: { subscribed: true, fields: ['messages'] },
        }]);

        const { channels } = await tenant(() => getChannelHealth(businessId));
        expect(check(channels[0], 'token')).toMatchObject({ state: 'fail', action: 'reconnect' });
    });

    it('never claims a WhatsApp webhook is fine when it cannot be read', async () => {
        mockChannels([{
            _id: 'w1', platform: 'whatsapp', name: 'Shop WhatsApp', status: 'active',
            connectionStatus: 'CONNECTED', lastVerifiedAt: new Date(),
        }]);

        const { channels } = await tenant(() => getChannelHealth(businessId));
        const webhook = check(channels[0], 'webhook');
        expect(webhook.state).toBe('unknown');
        expect(webhook.action).toBe('configure_webhook');
        expect(webhook.detail).toMatch(/cannot be read/i);
    });

    it('treats arriving WhatsApp messages as proof the webhook works', async () => {
        mockChannels([{
            _id: 'w1', platform: 'whatsapp', name: 'Shop WhatsApp', status: 'active',
            connectionStatus: 'CONNECTED', lastVerifiedAt: new Date(), lastInboundAt: new Date(),
        }]);

        const { channels } = await tenant(() => getChannelHealth(businessId));
        expect(check(channels[0], 'webhook').state).toBe('pass');
    });

    it('warns when nothing has ever arrived, and when replies are paused', async () => {
        mockChannels([{
            _id: 'w1', platform: 'whatsapp', name: 'Shop WhatsApp', status: 'disabled',
            connectionStatus: 'CONNECTED', lastVerifiedAt: new Date(),
        }]);

        const { channels } = await tenant(() => getChannelHealth(businessId));
        expect(check(channels[0], 'traffic')).toMatchObject({ state: 'warn' });
        expect(check(channels[0], 'traffic').detail).toMatch(/test message/i);
        expect(check(channels[0], 'ai')).toMatchObject({ state: 'warn', action: 'enable_ai' });
    });

    it('says a token is unverified rather than assuming it is good', async () => {
        mockChannels([{ _id: 'w1', platform: 'whatsapp', name: 'Shop', status: 'active', connectionStatus: 'CONNECTED' }]);
        const { channels } = await tenant(() => getChannelHealth(businessId));
        expect(check(channels[0], 'token')).toMatchObject({ state: 'unknown', action: 'verify' });
    });

    it('reports the deployment configuration a channel depends on', () => {
        const ready = platformReadiness({
            WHATSAPP_VERIFY_TOKEN: 'token', WHATSAPP_APP_SECRET: 'secret',
            META_GRAPH_API_VERSION: 'v21.0', FACEBOOK_CREDENTIALS_ENCRYPTION_KEY: 'key',
            PUBLIC_AGENT_URL: 'https://agent.example.com/', REDIS_URL: 'redis://localhost:6379',
        } as NodeJS.ProcessEnv);

        expect(ready.whatsappReady).toBe(true);
        expect(ready.queueReady).toBe(true);
        // The exact URLs the merchant must paste into Meta, without a trailing slash.
        expect(ready.webhooks).toMatchObject({
            messenger: 'https://agent.example.com/facebook',
            whatsapp: 'https://agent.example.com/whatsapp',
        });
    });

    it('flags a deployment that cannot process inbound events at all', () => {
        const ready = platformReadiness({} as NodeJS.ProcessEnv);
        expect(ready.whatsappReady).toBe(false);
        expect(ready.queueReady).toBe(false);
        expect(ready.webhooks).toBeNull();
    });
});
