import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { BusinessChannel } from '../models/BusinessChannel';
import { WhatsAppSignupSession } from '../models/WhatsAppSignupSession';
import { WHATSAPP_WEBHOOK_FIELDS, assertWhatsAppSignupConfigured, getWhatsAppConfig } from './meta-config.service';
import { decryptMetaAccessToken, encryptMetaAccessToken } from './meta-credentials.service';
import { MetaGraphError, WhatsAppNumber, metaGraph } from './meta-graph.service';

const SIGNUP_TTL_MS = 15 * 60 * 1000;

/** What the dashboard needs to open Meta's own signup dialog, and nothing secret. */
export function whatsappSetupOptions() {
    const config = getWhatsAppConfig();
    return {
        guidedAvailable: Boolean(config.appId && config.appSecret && config.configId),
        appId: config.appId || null,
        configId: config.configId || null,
        graphVersion: config.graphVersion,
        webhookUrl: config.publicAgentUrl ? `${config.publicAgentUrl}/whatsapp` : null,
    };
}

export function publicWhatsAppConnection(channel: any) {
    return {
        id: String(channel._id),
        phoneNumberId: channel.externalId,
        wabaId: channel.wabaId,
        name: channel.name,
        displayPhoneNumber: channel.displayPhoneNumber,
        qualityRating: channel.qualityRating,
        platformType: channel.platformType,
        setupMode: channel.setupMode || 'manual',
        connectionStatus: channel.connectionStatus,
        aiEnabled: channel.status === 'active',
        subscription: channel.subscription,
        connectedAt: channel.connectedAt,
        lastEventAt: channel.lastEventAt,
        lastInboundAt: channel.lastInboundAt,
        lastOutboundAt: channel.lastOutboundAt,
        lastVerifiedAt: channel.lastVerifiedAt,
        lastErrorCode: channel.lastErrorCode,
        reauthorizationRequired: Boolean(channel.reauthorizationRequired),
    };
}

/**
 * The account id normally arrives with the signup event. When a browser blocks
 * that message the token itself still names the accounts it was granted for, so
 * the merchant is never asked to go and find an id by hand.
 */
async function resolveWabaId(token: string, supplied: string | undefined, appId: string, appSecret: string) {
    if (/^\d{5,30}$/.test(String(supplied || ''))) return String(supplied);
    const debug = await metaGraph.debugToken(token, appId, appSecret);
    const granted = debug.data.granular_scopes?.find((scope) => scope.scope === 'whatsapp_business_management')
        || debug.data.granular_scopes?.find((scope) => scope.scope === 'whatsapp_business_messaging');
    const target = granted?.target_ids?.[0];
    if (!target) throw new Error('Meta did not return a WhatsApp Business Account for this authorization');
    return String(target);
}

function describeNumber(number: WhatsAppNumber) {
    return {
        phoneNumberId: String(number.id),
        displayPhoneNumber: number.display_phone_number,
        verifiedName: number.verified_name,
        qualityRating: number.quality_rating,
        platformType: number.platform_type,
        codeVerificationStatus: number.code_verification_status,
    };
}

/**
 * Cloud API refuses to send from a number that was never registered against this
 * app. A number kept in the WhatsApp Business app (coexistence) is already
 * registered by Meta and must not be registered again, so it is left alone.
 */
async function registerNumber(phoneNumberId: string, token: string, coexistence: boolean) {
    if (coexistence) return { registered: true, pin: undefined as string | undefined, errorCode: undefined as string | undefined };
    const pin = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    try {
        const result = await metaGraph.registerWhatsAppNumber(phoneNumberId, token, pin);
        if (!result.success) return { registered: false, pin: undefined, errorCode: 'REGISTRATION_REJECTED' };
        return { registered: true, pin, errorCode: undefined };
    } catch (error) {
        return { registered: false, pin: undefined, errorCode: error instanceof MetaGraphError ? `REGISTRATION_${error.code}` : 'REGISTRATION_FAILED' };
    }
}

async function saveConnection(input: {
    businessId: string;
    wabaId: string;
    token: string;
    number: ReturnType<typeof describeNumber>;
    coexistence: boolean;
    subscribed: boolean;
}) {
    const { businessId, wabaId, token, number, coexistence, subscribed } = input;
    const existing = await BusinessChannel.findOne({ platform: 'whatsapp', externalId: number.phoneNumberId }).lean();
    if (existing && String(existing.businessId) !== businessId) {
        throw new Error('This WhatsApp number is already connected to another business');
    }

    const registration = await registerNumber(number.phoneNumberId, token, coexistence);
    const healthy = subscribed && registration.registered;
    const now = new Date();
    const channel = await BusinessChannel.findOneAndUpdate(
        { platform: 'whatsapp', externalId: number.phoneNumberId },
        {
            $set: {
                businessId: new mongoose.Types.ObjectId(businessId),
                wabaId,
                name: number.verifiedName || number.displayPhoneNumber || 'WhatsApp Business',
                displayPhoneNumber: number.displayPhoneNumber,
                qualityRating: number.qualityRating,
                platformType: coexistence ? 'COEXISTENCE' : number.platformType,
                setupMode: 'guided',
                encryptedAccessToken: encryptMetaAccessToken(token),
                // A number that cannot send yet must not answer customers silently.
                status: healthy ? 'active' : 'disabled',
                connectionStatus: healthy ? 'CONNECTED' : 'NEEDS_ATTENTION',
                subscription: { subscribed, fields: [...WHATSAPP_WEBHOOK_FIELDS], verifiedAt: now },
                connectedAt: now,
                lastVerifiedAt: now,
                reauthorizationRequired: false,
                lastErrorCode: healthy ? undefined : registration.errorCode || 'SUBSCRIPTION_MISSING',
                ...(registration.pin ? { encryptedTwoStepPin: encryptMetaAccessToken(`whatsapp-pin:${registration.pin}`) } : {}),
            },
        },
        { upsert: true, new: true, runValidators: true },
    ).lean();
    return publicWhatsAppConnection(channel);
}

/**
 * One call does everything the merchant used to do by hand in Meta for Developers:
 * trade the signup code for a business token, find the account, subscribe this app
 * to its webhooks, and register the number for Cloud API. The merchant is asked
 * something only when the account genuinely holds more than one number.
 */
export async function completeWhatsAppEmbeddedSignup(
    businessId: string,
    userId: string,
    input: { code: string; wabaId?: string; phoneNumberId?: string; coexistence?: boolean },
) {
    const config = assertWhatsAppSignupConfigured();
    if (!input.code || input.code.length < 10) throw new Error('WhatsApp authorization code is missing');
    const coexistence = input.coexistence === true;

    const exchanged = await metaGraph.exchangeEmbeddedSignupCode(input.code, config.appId, config.appSecret);
    const token = exchanged.access_token;
    if (!token) throw new Error('Meta did not return an access token for this authorization');

    const wabaId = await resolveWabaId(token, input.wabaId, config.appId, config.appSecret);
    const [account, numberList] = await Promise.all([
        metaGraph.whatsappAccount(wabaId, token).catch(() => ({ id: wabaId, name: undefined as string | undefined })),
        metaGraph.whatsappNumbers(wabaId, token),
    ]);

    // Webhooks are subscribed on the account, so this happens once however many
    // numbers it holds, and before any number is stored: a connection that cannot
    // receive messages is not a connection.
    let subscribed = false;
    try {
        subscribed = Boolean((await metaGraph.subscribeWhatsApp(wabaId, token)).success);
    } catch (error) {
        if (error instanceof MetaGraphError && error.category === 'AUTH_EXPIRED') throw error;
        subscribed = false;
    }

    const numbers = (numberList.data || []).map(describeNumber);
    if (!numbers.length) throw new Error('This WhatsApp Business Account has no phone number yet');

    const chosen = input.phoneNumberId
        ? numbers.find((number) => number.phoneNumberId === String(input.phoneNumberId))
        : numbers.length === 1 ? numbers[0] : undefined;

    if (chosen) {
        return { connection: await saveConnection({ businessId, wabaId, token, number: chosen, coexistence, subscribed }) };
    }

    const session = await WhatsAppSignupSession.create({
        businessId,
        userId,
        wabaId,
        wabaName: account.name,
        coexistence,
        encryptedAccessToken: encryptMetaAccessToken(token),
        numbers: numbers.map((number) => ({ choiceId: crypto.randomBytes(12).toString('base64url'), ...number })),
        expiresAt: new Date(Date.now() + SIGNUP_TTL_MS),
    });
    return {
        sessionId: String(session._id),
        wabaName: account.name,
        subscribed,
        numbers: (session.numbers as any[]).map((number) => ({
            choiceId: number.choiceId,
            displayPhoneNumber: number.displayPhoneNumber,
            verifiedName: number.verifiedName,
            qualityRating: number.qualityRating,
        })),
    };
}

/** Finishes a signup that had to stop and ask which number to use. */
export async function confirmWhatsAppSignupNumber(businessId: string, userId: string, sessionId: string, choiceId: string) {
    const session = await WhatsAppSignupSession.findOne({ _id: sessionId, businessId, userId, status: 'NUMBERS_READY', expiresAt: { $gt: new Date() } })
        .select('+encryptedAccessToken');
    if (!session) throw new Error('WhatsApp number selection session is unavailable');
    const number = (session.numbers as any[]).find((item) => item.choiceId === choiceId);
    if (!number) throw new Error('Selected WhatsApp number is unavailable');
    if (!session.encryptedAccessToken) throw new Error('WhatsApp authorization is unavailable');

    const token = decryptMetaAccessToken(session.encryptedAccessToken);
    let subscribed = false;
    try { subscribed = Boolean((await metaGraph.whatsappSubscriptions(session.wabaId, token)).data?.length); } catch { subscribed = false; }

    const connection = await saveConnection({
        businessId,
        wabaId: session.wabaId,
        token,
        coexistence: Boolean(session.coexistence),
        subscribed,
        number: {
            phoneNumberId: number.phoneNumberId,
            displayPhoneNumber: number.displayPhoneNumber,
            verifiedName: number.verifiedName,
            qualityRating: number.qualityRating,
            platformType: number.platformType,
            codeVerificationStatus: number.codeVerificationStatus,
        },
    });
    session.status = 'COMPLETED';
    await session.save();
    return connection;
}

/**
 * Confirms with Meta that this app is still subscribed to the account's webhooks.
 * Only a guided connection can be asked: a pasted phone-number token cannot read
 * its own account, which is why that path reports the webhook as unknown.
 */
export async function confirmWhatsAppSubscription(channel: any, token: string) {
    if (!channel.wabaId) return undefined;
    const subscriptions = await metaGraph.whatsappSubscriptions(channel.wabaId, token);
    return { subscribed: Boolean(subscriptions.data?.length), fields: [...WHATSAPP_WEBHOOK_FIELDS], verifiedAt: new Date() };
}

/** A lapsed subscription needs the subscription back, not a whole new authorization. */
export async function resubscribeWhatsAppConnection(businessId: string, connectionId: string) {
    const channel = await BusinessChannel.findOne({ _id: connectionId, businessId, platform: 'whatsapp' }).select('+encryptedAccessToken');
    if (!channel) throw new Error('WhatsApp connection not found');
    if (!channel.wabaId || !channel.encryptedAccessToken) throw new Error('Reconnect this number through guided setup to manage its webhooks');
    const token = decryptMetaAccessToken(channel.encryptedAccessToken);
    const result = await metaGraph.subscribeWhatsApp(channel.wabaId, token);
    if (!result.success) throw new Error('Meta did not confirm the WhatsApp webhook subscription');
    const subscription = await confirmWhatsAppSubscription(channel, token);
    Object.assign(channel, {
        subscription,
        connectionStatus: subscription?.subscribed ? 'CONNECTED' : 'NEEDS_ATTENTION',
        lastErrorCode: subscription?.subscribed ? undefined : 'SUBSCRIPTION_MISSING',
        lastVerifiedAt: new Date(),
    });
    await channel.save();
    return publicWhatsAppConnection(channel.toObject());
}

/**
 * Unsubscribing is an account-wide action, so it only happens once the last
 * number of that account has been disconnected from this business.
 */
export async function releaseWhatsAppAccount(businessId: string, channel: any, token: string) {
    if (!channel.wabaId) return;
    const siblings = await BusinessChannel.countDocuments({
        businessId,
        platform: 'whatsapp',
        wabaId: channel.wabaId,
        _id: { $ne: channel._id },
        connectionStatus: { $ne: 'DISCONNECTED' },
    });
    if (siblings > 0) return;
    try { await metaGraph.unsubscribeWhatsApp(channel.wabaId, token); } catch { /* A revoked token is already disconnected. */ }
}
