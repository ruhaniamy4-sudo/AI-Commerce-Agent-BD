import { BusinessChannel, IBusinessChannel } from '../models/BusinessChannel';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Business } from '../models/Business';

export const META_WINDOW_MS = 24 * 60 * 60 * 1000;
const OPT_OUT = /\b(stop|unsubscribe|opt[ -]?out|cancel messages|do not message|don't message|do not contact|don't contact)\b|(?:বন্ধ|মেসেজ বন্ধ|আর মেসেজ)/i;
const OPT_IN = /\b(start|subscribe|opt[ -]?in|resume messages)\b|(?:শুরু|মেসেজ চালু)/i;
const PAYMENT_SECRET = /\b(?:cvv|cvc|pin|otp|one[ -]?time password|card password)\b|\b(?:\d[ -]*?){13,19}\b/i;

export function isOptOutMessage(text: string) { return OPT_OUT.test(String(text || '').trim()); }
export function isOptInMessage(text: string) { return OPT_IN.test(String(text || '').trim()); }
export function containsPaymentCredential(text: string) { return PAYMENT_SECRET.test(String(text || '')); }

export function deriveMetaCapabilities(permissions: string[], businessType?: string) {
    const granted = new Set(permissions);
    const healthcareRestricted = businessType === 'CLINIC_SERVICE';
    const digitalGoodsCommerceRestricted = businessType === 'SAAS' || businessType === 'EDTECH';
    return {
        canReceiveMessages: granted.has('pages_manage_metadata'),
        canReplyNormally: granted.has('pages_messaging') && !healthcareRestricted,
        canSendProductMedia: granted.has('pages_messaging') && !healthcareRestricted,
        canReadPageMetadata: granted.has('pages_show_list'),
        canReadPageContent: granted.has('pages_read_engagement'),
        canReadComments: false,
        canReplyToComments: false,
        canUseMarketingMessages: false,
        canIngestPageContent: granted.has('pages_read_engagement'),
        canUseCustomerAttachments: !healthcareRestricted,
        requiresAppReview: true,
        requiresAdvancedAccess: true,
        requiresReauthorization: false,
        healthcareRestricted,
        digitalGoodsCommerceRestricted,
        canUseCommerceCTA: !healthcareRestricted && !digitalGoodsCommerceRestricted,
    };
}

export function facebookConversationId(pageId: string, psid: string) {
    return `fb_${pageId}_${psid}`;
}

export async function recordMetaInbound(businessId: string, pageId: string, psid: string, conversationId: string, text: string) {
    const now = new Date();
    const optedOut = isOptOutMessage(text) ? true : isOptInMessage(text) ? false : undefined;
    await Conversation.updateOne({ conversationId }, { $set: { platformPageId: pageId, 'metadata.facebook.lastCustomerInteractionAt': now } });
    const customerUpdate: Record<string, unknown> = { lastMessageAt: now, channelPageId: pageId, 'metadata.facebook.lastCustomerInteractionAt': now };
    if (optedOut !== undefined) customerUpdate.optedOut = optedOut;
    await Customer.updateOne({ psid }, { $set: customerUpdate });
    await BusinessChannel.updateOne({ businessId, platform: 'facebook', externalId: pageId }, { $set: { lastInboundAt: now, lastEventAt: now } });
    return { optedOut };
}

export async function assertNormalMetaReplyAllowed(businessId: string, pageId: string, psid: string, conversationId?: string) {
    const channel = await BusinessChannel.findOne({ businessId, platform: 'facebook', externalId: pageId, status: 'active', connectionStatus: 'CONNECTED' }).select('+encryptedAccessToken');
    if (!channel?.encryptedAccessToken || !channel.permissions.includes('pages_messaging')) throw new Error('Facebook Page connection is not ready for messaging');
    const business = await Business.findById(businessId).select('businessType').lean();
    if (business?.businessType === 'CLINIC_SERVICE') throw new Error('Automated Messenger replies are disabled for healthcare businesses');
    const customer = await Customer.findOne({ psid }).select('optedOut').lean();
    if (customer?.optedOut) throw new Error('Customer has opted out of Messenger replies');
    const conversation = conversationId ? await Conversation.findOne({ conversationId }).select('metadata').lean() : await Conversation.findOne({ psid, platformPageId: pageId }).sort({ lastMessageAt: -1 }).select('metadata').lean();
    const last = conversation?.metadata?.facebook?.lastCustomerInteractionAt;
    if (!last || Date.now() - new Date(last).getTime() > META_WINDOW_MS) throw new Error('Facebook 24-hour messaging window is closed');
    return channel;
}
