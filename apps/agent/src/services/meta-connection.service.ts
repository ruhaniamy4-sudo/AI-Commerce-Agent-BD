import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { BusinessChannel } from '../models/BusinessChannel';
import { MetaOAuthSession } from '../models/MetaOAuthSession';
import { Business } from '../models/Business';
import { assertMetaOAuthConfigured, META_CORE_PERMISSIONS, META_MESSAGING_WEBHOOK_FIELDS, META_OPTIONAL_CONTENT_PERMISSIONS } from './meta-config.service';
import { decryptMetaAccessToken, encryptMetaAccessToken } from './meta-credentials.service';
import { MetaGraphError, metaGraph } from './meta-graph.service';
import { deriveMetaCapabilities } from './meta-policy.service';

const OAUTH_TTL_MS = 15 * 60 * 1000;

function b64(value: Buffer | string) { return Buffer.from(value).toString('base64url'); }
function sign(value: string, secret: string) { return b64(crypto.createHmac('sha256', secret).update(value).digest()); }

export function createMetaState(sessionId: string, nonce: string, expiresAt: Date) {
    const { appSecret } = assertMetaOAuthConfigured();
    const payload = b64(JSON.stringify({ sid: sessionId, nonce, exp: expiresAt.getTime() }));
    return `${payload}.${sign(payload, appSecret)}`;
}

export function verifyMetaState(state: string) {
    const { appSecret } = assertMetaOAuthConfigured();
    const [payload, supplied] = String(state || '').split('.');
    if (!payload || !supplied) throw new Error('Invalid Meta authorization state');
    const expected = sign(payload, appSecret);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new Error('Invalid Meta authorization state');
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sid: string; nonce: string; exp: number };
    if (!parsed.sid || !parsed.nonce || !parsed.exp || Date.now() > parsed.exp) throw new Error('Meta authorization state expired');
    return parsed;
}

export async function beginMetaConnection(businessId: string, userId: string, includeContent = false) {
    const config = assertMetaOAuthConfigured();
    const expiresAt = new Date(Date.now() + OAUTH_TTL_MS);
    const nonce = crypto.randomBytes(24).toString('base64url');
    const session = await MetaOAuthSession.create({ businessId, userId, nonce, expiresAt, status: 'CONNECTING' });
    const state = createMetaState(session._id.toString(), nonce, expiresAt);
    const scope = [...META_CORE_PERMISSIONS, ...(includeContent ? META_OPTIONAL_CONTENT_PERMISSIONS : [])].join(',');
    const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
    url.searchParams.set('client_id', config.appId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', scope);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('auth_type', 'rerequest');
    return { authorizationUrl: url.toString(), expiresAt };
}

export async function completeMetaOAuthCallback(code: string, state: string) {
    const parsed = verifyMetaState(state);
    const session = await MetaOAuthSession.findById(parsed.sid).select('+pages.encryptedAccessToken');
    if (!session || session.nonce !== parsed.nonce || session.status !== 'CONNECTING' || session.expiresAt.getTime() < Date.now()) throw new Error('Meta authorization session is unavailable');
    const config = assertMetaOAuthConfigured();
    try {
        const short = await metaGraph.exchangeCode(code, config.appId, config.appSecret, config.redirectUri);
        let userToken = short.access_token;
        try { userToken = (await metaGraph.exchangeLongLivedUserToken(short.access_token, config.appId, config.appSecret)).access_token; } catch { /* Some token types cannot be extended; continue with returned token. */ }
        const [identity, pageResult, permissionResult] = await Promise.all([metaGraph.me(userToken), metaGraph.pages(userToken), metaGraph.permissions(userToken)]);
        const permissions = permissionResult.data.filter((item) => item.status === 'granted').map((item) => item.permission);
        session.metaUserId = identity.id;
        session.pages = pageResult.data.map((page) => ({
            choiceId: crypto.randomBytes(12).toString('base64url'), pageId: page.id, name: page.name, category: page.category,
            picture: page.picture?.data?.url, permissions,
            encryptedAccessToken: encryptMetaAccessToken(page.access_token),
        })) as any;
        session.status = 'PAGES_READY';
        await session.save();
        return { sessionId: session._id.toString() };
    } catch (error) {
        session.status = 'FAILED';
        session.errorCode = error instanceof MetaGraphError ? error.category : 'OAUTH_FAILED';
        await session.save();
        throw error;
    }
}

export async function getMetaOAuthSession(businessId: string, userId: string, sessionId: string) {
    const session = await MetaOAuthSession.findOne({ _id: sessionId, businessId, userId, status: 'PAGES_READY', expiresAt: { $gt: new Date() } }).lean();
    if (!session) throw new Error('Meta Page selection session is unavailable');
    return { id: session._id, pages: (session.pages || []).map((page: any) => ({ choiceId: page.choiceId, name: page.name, picture: page.picture, category: page.category })) };
}

export function publicMetaConnection(channel: any) {
    return {
        id: channel._id, pageName: channel.name, pagePicture: channel.pagePicture, pageCategory: channel.pageCategory,
        connectionStatus: channel.connectionStatus, capabilities: channel.capabilities || {},
        connectedAt: channel.connectedAt, lastVerifiedAt: channel.lastVerifiedAt, lastEventAt: channel.lastEventAt,
        lastInboundAt: channel.lastInboundAt, lastOutboundAt: channel.lastOutboundAt,
        reauthorizationRequired: Boolean(channel.reauthorizationRequired), subscription: channel.subscription,
        aiEnabled: channel.status === 'active', lastErrorCode: channel.lastErrorCode,
    };
}

export async function connectSelectedMetaPage(businessId: string, userId: string, sessionId: string, choiceId: string, termsAccepted: boolean) {
    if (!termsAccepted) throw new Error('Meta terms and Page-action acknowledgement are required');
    const session = await MetaOAuthSession.findOne({ _id: sessionId, businessId, userId, status: 'PAGES_READY', expiresAt: { $gt: new Date() } }).select('+pages.encryptedAccessToken');
    if (!session) throw new Error('Meta Page selection session is unavailable');
    const page = (session.pages as any[]).find((item) => item.choiceId === choiceId);
    if (!page?.encryptedAccessToken) throw new Error('Selected Facebook Page is unavailable');
    const pageId = page.pageId;
    const existing = await BusinessChannel.findOne({ platform: 'facebook', externalId: pageId }).lean();
    if (existing && existing.businessId.toString() !== businessId) throw new Error('This Facebook Page is already connected to another business');
    const token = decryptMetaAccessToken(page.encryptedAccessToken);
    const metadata = await metaGraph.page(pageId, token);
    const subscription = await metaGraph.subscribe(pageId, token, META_MESSAGING_WEBHOOK_FIELDS);
    if (!subscription.success) throw new Error('Facebook Page webhook subscription was not confirmed');
    const business = await Business.findById(businessId).select('businessType').lean();
    const capabilities = deriveMetaCapabilities(page.permissions || [], business?.businessType);
    const now = new Date();
    const channel = await BusinessChannel.findOneAndUpdate(
        { platform: 'facebook', externalId: pageId },
        { $set: {
            businessId: new mongoose.Types.ObjectId(businessId), name: metadata.name, pagePicture: metadata.picture?.data?.url,
            pageCategory: metadata.category, encryptedAccessToken: page.encryptedAccessToken, status: business?.businessType === 'CLINIC_SERVICE' ? 'disabled' : 'active', connectionStatus: 'CONNECTED',
            permissions: page.permissions || [], capabilities, connectedAt: now, lastVerifiedAt: now, reauthorizationRequired: false,
            subscription: { subscribed: true, fields: [...META_MESSAGING_WEBHOOK_FIELDS], verifiedAt: now }, authorizedByMetaUserId: session.metaUserId,
            lastErrorCode: undefined,
        } }, { upsert: true, new: true, runValidators: true }
    ).lean();
    session.status = 'COMPLETED';
    await session.save();
    return publicMetaConnection(channel);
}

export async function listMetaConnections(businessId: string) {
    const channels = await BusinessChannel.find({ businessId, platform: 'facebook' }).sort({ createdAt: 1 }).lean();
    return channels.map(publicMetaConnection);
}

async function loadOwnedChannel(businessId: string, connectionId: string) {
    const channel = await BusinessChannel.findOne({ _id: connectionId, businessId, platform: 'facebook' }).select('+encryptedAccessToken');
    if (!channel) throw new Error('Facebook connection not found');
    return channel;
}

export async function verifyMetaConnection(businessId: string, connectionId: string) {
    const channel = await loadOwnedChannel(businessId, connectionId);
    try {
        if (!channel.encryptedAccessToken) throw new Error('Facebook Page token is unavailable');
        const token = decryptMetaAccessToken(channel.encryptedAccessToken);
        const [metadata, subscriptions] = await Promise.all([metaGraph.page(channel.externalId, token), metaGraph.subscriptions(channel.externalId, token)]);
        const fields = subscriptions.data.flatMap((item) => item.subscribed_fields || []);
        const subscribed = META_MESSAGING_WEBHOOK_FIELDS.every((field) => fields.includes(field));
        const status = subscribed ? 'CONNECTED' : 'NEEDS_ATTENTION';
        Object.assign(channel, { name: metadata.name, pagePicture: metadata.picture?.data?.url, pageCategory: metadata.category, lastVerifiedAt: new Date(), connectionStatus: status, reauthorizationRequired: false, subscription: { subscribed, fields, verifiedAt: new Date() }, lastErrorCode: subscribed ? undefined : 'SUBSCRIPTION_MISSING' });
        await channel.save();
        return publicMetaConnection(channel.toObject());
    } catch (error) {
        const auth = error instanceof MetaGraphError && error.category === 'AUTH_EXPIRED';
        channel.connectionStatus = auth ? 'REAUTHORIZATION_REQUIRED' : 'ERROR';
        channel.reauthorizationRequired = auth;
        channel.lastErrorCode = error instanceof MetaGraphError ? error.category : 'VERIFY_FAILED';
        await channel.save();
        throw error;
    }
}

export async function disconnectMetaConnection(businessId: string, connectionId: string) {
    const channel = await loadOwnedChannel(businessId, connectionId);
    if (channel.encryptedAccessToken) {
        try { await metaGraph.unsubscribe(channel.externalId, decryptMetaAccessToken(channel.encryptedAccessToken)); } catch { /* Revoked tokens are already effectively disconnected. */ }
    }
    channel.encryptedAccessToken = undefined;
    channel.connectionStatus = 'DISCONNECTED';
    channel.status = 'disabled';
    channel.reauthorizationRequired = false;
    channel.permissions = [];
    channel.capabilities = {};
    channel.subscription = { subscribed: false, fields: [] };
    await channel.save();
    return publicMetaConnection(channel.toObject());
}

export async function setMetaConnectionAI(businessId: string, connectionId: string, enabled: boolean) {
    const channel = await BusinessChannel.findOne({ _id: connectionId, businessId, platform: 'facebook' });
    if (!channel) throw new Error('Facebook connection not found');
    if (enabled) {
        const business = await Business.findById(businessId).select('businessType').lean();
        if (business?.businessType === 'CLINIC_SERVICE') throw new Error('Automated Messenger replies are restricted for healthcare businesses');
        if (channel.connectionStatus !== 'CONNECTED') throw new Error('Verify or reconnect this Facebook Page before enabling AI');
    }
    channel.status = enabled ? 'active' : 'disabled';
    await channel.save();
    return publicMetaConnection(channel.toObject());
}
