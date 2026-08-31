import { BusinessChannel } from '../models/BusinessChannel';
import { requireTenantContext } from '../tenancy/context';
import { decryptMetaAccessToken, redactMetaSecrets } from './meta-credentials.service';
import { MetaGraphError, metaGraph } from './meta-graph.service';
import { assertNormalMetaReplyAllowed, facebookConversationId } from './meta-policy.service';

type Button = { type: string; title: string; payload?: string; url?: string };
type Card = { title: string; subtitle?: string; image_url?: string; buttons?: Button[] };

async function markFailure(channelId: string, error: unknown) {
    const auth = error instanceof MetaGraphError && error.category === 'AUTH_EXPIRED';
    await BusinessChannel.updateOne({ _id: channelId }, { $set: {
        connectionStatus: auth ? 'REAUTHORIZATION_REQUIRED' : 'NEEDS_ATTENTION',
        reauthorizationRequired: auth,
        lastErrorCode: error instanceof MetaGraphError ? error.category : 'SEND_FAILED',
    } });
}

async function callSendAPI(recipientId: string, message: unknown, pageId: string) {
    const principal = requireTenantContext();
    const conversationId = facebookConversationId(pageId, recipientId);
    const channel = await assertNormalMetaReplyAllowed(principal.businessId, pageId, recipientId, conversationId);
    try {
        const safeMessage: any = JSON.parse(JSON.stringify(message));
        if (channel.capabilities?.canUseCommerceCTA === false) {
            const payload = safeMessage?.attachment?.payload;
            const stripBuy = (buttons: any[] = []) => buttons.filter((button) => !(button.type === 'postback' && String(button.payload || '').startsWith('BUY_')));
            if (payload?.buttons) payload.buttons = stripBuy(payload.buttons);
            if (payload?.elements) payload.elements = payload.elements.map((element: any) => ({ ...element, ...(element.buttons ? { buttons: stripBuy(element.buttons) } : {}) }));
        }
        const result = await metaGraph.send(pageId, decryptMetaAccessToken(channel.encryptedAccessToken!), {
            messaging_type: 'RESPONSE', recipient: { id: recipientId }, message: safeMessage,
        });
        await BusinessChannel.updateOne({ _id: channel._id }, { $set: { lastOutboundAt: new Date(), lastErrorCode: undefined } });
        return result;
    } catch (error) {
        await markFailure(channel._id.toString(), error);
        console.error(`Facebook send failed: ${redactMetaSecrets(error)}`);
        throw error;
    }
}

export const sendMessage = (recipientId: string, text: string, pageId: string) =>
    callSendAPI(recipientId, { text: String(text).slice(0, 2000) }, pageId);

export const sendImage = (recipientId: string, imageUrl: string, pageId: string) =>
    callSendAPI(recipientId, { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }, pageId);

export const sendImages = (recipientId: string, imageUrls: string[], pageId: string) =>
    callSendAPI(recipientId, { attachments: imageUrls.slice(0, 30).map((url) => ({ type: 'image', payload: { url, is_reusable: true } })) }, pageId);

export const sendQuickReplies = (recipientId: string, text: string, replies: { title: string; payload: string }[], pageId: string) =>
    callSendAPI(recipientId, {
        text: String(text).slice(0, 2000), quick_replies: replies.slice(0, 13).map((reply) => ({
            content_type: 'text', title: String(reply.title).slice(0, 20), payload: String(reply.payload).slice(0, 1000),
        })),
    }, pageId);

export const sendButtonTemplate = (recipientId: string, text: string, buttons: Button[], pageId: string) =>
    callSendAPI(recipientId, { attachment: { type: 'template', payload: { template_type: 'button', text: String(text).slice(0, 640), buttons: buttons.slice(0, 3) } } }, pageId);

export const sendGenericTemplate = (recipientId: string, elements: Card[], pageId: string) =>
    callSendAPI(recipientId, { attachment: { type: 'template', payload: {
        template_type: 'generic', elements: elements.slice(0, 10).map((element) => ({
            title: String(element.title).slice(0, 80),
            ...(element.subtitle ? { subtitle: String(element.subtitle).slice(0, 80) } : {}),
            ...(element.image_url ? { image_url: element.image_url } : {}),
            ...(element.buttons?.length ? { buttons: element.buttons.slice(0, 3) } : {}),
        })),
    } } }, pageId);

export async function getSenderProfile(senderPsid: string, pageId: string) {
    try {
        const principal = requireTenantContext();
        const channel = await BusinessChannel.findOne({ businessId: principal.businessId, platform: 'facebook', externalId: pageId, connectionStatus: 'CONNECTED' }).select('+encryptedAccessToken');
        if (!channel?.encryptedAccessToken) return null;
        return await metaGraph.profile(senderPsid, decryptMetaAccessToken(channel.encryptedAccessToken));
    } catch (error) {
        console.error(`Facebook profile fetch failed: ${redactMetaSecrets(error)}`);
        return null;
    }
}
