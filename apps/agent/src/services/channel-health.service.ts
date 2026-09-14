import { BusinessChannel } from '../models/BusinessChannel';
import { getRedisConfig } from '../config/runtime';
import { getMetaConfig } from '../services/meta-config.service';

/**
 * Why a channel is or is not working, in the terms a merchant can act on.
 *
 * Every check reports only what we can actually establish: a token Meta accepted,
 * a webhook subscription Meta confirmed, a message that really arrived. Anything
 * we cannot verify from here is reported as unknown with the place to look,
 * rather than shown as a green tick.
 */
export type CheckState = 'pass' | 'warn' | 'fail' | 'unknown';

export interface HealthCheck {
    key: string;
    label: string;
    state: CheckState;
    detail: string;
    /** What the dashboard should offer to fix it. */
    action?: 'verify' | 'reconnect' | 'resubscribe' | 'enable_ai' | 'configure_webhook';
}

export interface ChannelHealth {
    channel: 'messenger' | 'whatsapp';
    id: string;
    name: string;
    state: 'connected' | 'attention' | 'disconnected' | 'idle';
    checks: HealthCheck[];
    lastInboundAt?: Date;
    lastOutboundAt?: Date;
    lastVerifiedAt?: Date;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function tokenCheck(channel: any): HealthCheck {
    if (channel.reauthorizationRequired || channel.connectionStatus === 'REAUTHORIZATION_REQUIRED') {
        return { key: 'token', label: 'Access token', state: 'fail', detail: 'Meta no longer accepts the stored token. Reconnect to issue a new one.', action: 'reconnect' };
    }
    if (channel.connectionStatus === 'DISCONNECTED') {
        return { key: 'token', label: 'Access token', state: 'fail', detail: 'This channel is disconnected. Connect it again to resume.', action: 'reconnect' };
    }
    if (channel.connectionStatus === 'ERROR') {
        return { key: 'token', label: 'Access token', state: 'fail', detail: `Meta returned an error${channel.lastErrorCode ? ` (${channel.lastErrorCode})` : ''}. Verify to see the current state.`, action: 'verify' };
    }
    if (!channel.lastVerifiedAt) {
        return { key: 'token', label: 'Access token', state: 'unknown', detail: 'Stored but not verified with Meta yet.', action: 'verify' };
    }
    return { key: 'token', label: 'Access token', state: 'pass', detail: `Accepted by Meta on ${new Date(channel.lastVerifiedAt).toLocaleString()}.` };
}

function trafficCheck(channel: any): HealthCheck {
    if (channel.lastInboundAt) {
        const stale = Date.now() - new Date(channel.lastInboundAt).getTime() > THIRTY_DAYS;
        return {
            key: 'traffic',
            label: 'Customer messages',
            state: stale ? 'warn' : 'pass',
            detail: `Last message received ${new Date(channel.lastInboundAt).toLocaleString()}.${stale ? ' Nothing in the last 30 days.' : ''}`,
        };
    }
    return {
        key: 'traffic',
        label: 'Customer messages',
        state: 'warn',
        detail: 'No customer message has reached SellPilot yet. Send yourself a test message to confirm the webhook.',
    };
}

function aiCheck(channel: any): HealthCheck {
    return channel.status === 'active'
        ? { key: 'ai', label: 'Automated replies', state: 'pass', detail: 'The AI answers new messages on this channel.' }
        : { key: 'ai', label: 'Automated replies', state: 'warn', detail: 'AI replies are paused. Your team answers from the inbox.', action: 'enable_ai' };
}

function messengerHealth(channel: any): ChannelHealth {
    const subscribed = channel.subscription?.subscribed;
    const webhook: HealthCheck = subscribed
        ? { key: 'webhook', label: 'Webhook subscription', state: 'pass', detail: `Meta confirmed the Page is subscribed${channel.subscription?.fields?.length ? ` to ${channel.subscription.fields.join(', ')}` : ''}.` }
        : channel.subscription
          ? { key: 'webhook', label: 'Webhook subscription', state: 'fail', detail: 'The Page is not subscribed to Messenger events, so messages never reach SellPilot.', action: 'resubscribe' }
          : { key: 'webhook', label: 'Webhook subscription', state: 'unknown', detail: 'Not checked yet. Verify to ask Meta directly.', action: 'verify' };

    const checks = [tokenCheck(channel), webhook, trafficCheck(channel), aiCheck(channel)];
    return {
        channel: 'messenger',
        id: String(channel._id),
        name: channel.name,
        state: overallState(channel, checks),
        checks,
        lastInboundAt: channel.lastInboundAt,
        lastOutboundAt: channel.lastOutboundAt,
        lastVerifiedAt: channel.lastVerifiedAt,
    };
}

function whatsappHealth(channel: any): ChannelHealth {
    // Meta exposes the webhook subscription on the WhatsApp Business Account. A
    // guided connection holds that account's token and can be asked directly; a
    // pasted phone-number token cannot, so arriving messages are the only proof.
    const webhook: HealthCheck = channel.wabaId
        ? channel.subscription?.subscribed
            ? { key: 'webhook', label: 'Webhook delivery', state: 'pass', detail: 'Meta confirms this app is subscribed to the account, so messages reach SellPilot.' }
            : { key: 'webhook', label: 'Webhook delivery', state: 'fail', detail: 'Meta is not sending this account to SellPilot. Restoring the subscription fixes it.', action: 'resubscribe' }
        : channel.lastInboundAt
            ? { key: 'webhook', label: 'Webhook delivery', state: 'pass', detail: 'Messages are arriving, so the webhook is configured correctly.' }
            : { key: 'webhook', label: 'Webhook delivery', state: 'unknown', detail: 'Cannot be read from here. Set the callback URL below in Meta, then send a test message.', action: 'configure_webhook' };

    const checks = [tokenCheck(channel), webhook, trafficCheck(channel), aiCheck(channel)];
    return {
        channel: 'whatsapp',
        id: String(channel._id),
        name: channel.name,
        state: overallState(channel, checks),
        checks,
        lastInboundAt: channel.lastInboundAt,
        lastOutboundAt: channel.lastOutboundAt,
        lastVerifiedAt: channel.lastVerifiedAt,
    };
}

function overallState(channel: any, checks: HealthCheck[]): ChannelHealth['state'] {
    if (channel.connectionStatus === 'DISCONNECTED') return 'disconnected';
    if (checks.some((check) => check.state === 'fail')) return 'attention';
    return channel.connectionStatus === 'CONNECTED' ? 'connected' : 'attention';
}

/** Configuration the whole deployment needs before any channel can work. */
export function platformReadiness(env: NodeJS.ProcessEnv = process.env) {
    const meta = getMetaConfig();
    const publicUrl = (env.PUBLIC_AGENT_URL || '').replace(/\/+$/, '');
    return {
        messengerReady: Boolean(meta.appId && meta.appSecret && meta.verifyToken && publicUrl && meta.dashboardUrl),
        // WhatsApp runs on the same Meta app as Messenger, so a deployment that set
        // only the Facebook values is configured, not broken.
        whatsappReady: Boolean(
            (env.WHATSAPP_VERIFY_TOKEN || env.FB_VERIFY_TOKEN)
            && (env.WHATSAPP_APP_SECRET || env.FB_APP_SECRET)
            && (env.META_GRAPH_API_VERSION || env.FB_GRAPH_API_VERSION)
            && env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY,
        ),
        /** Guided setup additionally needs the Embedded Signup configuration id. */
        whatsappGuidedReady: Boolean(
            (env.WHATSAPP_APP_ID || env.FB_APP_ID)
            && (env.WHATSAPP_APP_SECRET || env.FB_APP_SECRET)
            && env.WHATSAPP_CONFIG_ID
            && env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY,
        ),
        // Inbound events are processed through the queue; without Redis they never run.
        queueReady: Boolean(getRedisConfig(env)),
        webhooks: publicUrl
            ? { messenger: `${publicUrl}/facebook`, whatsapp: `${publicUrl}/whatsapp` }
            : null,
    };
}

export async function getChannelHealth(businessId: string) {
    const channels = await BusinessChannel.find({ businessId, platform: { $in: ['facebook', 'whatsapp'] } })
        .select('name platform status connectionStatus reauthorizationRequired subscription lastErrorCode lastVerifiedAt lastEventAt lastInboundAt lastOutboundAt')
        .sort({ createdAt: 1 })
        .lean();

    return {
        platform: platformReadiness(),
        channels: channels.map((channel: any) => (channel.platform === 'whatsapp' ? whatsappHealth(channel) : messengerHealth(channel))),
    };
}
