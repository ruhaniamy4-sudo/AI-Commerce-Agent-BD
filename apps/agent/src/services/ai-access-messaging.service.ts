/**
 * What happens when the AI access gate says no.
 *
 * The gate used to return `reply: null`: the customer got silence, the merchant
 * learned about it from an angry message, and a quota meant to protect revenue
 * cost the sale instead. Every block now answers the customer and tells the
 * merchant once.
 */
import { Business } from '../models/Business';
import { BusinessMember } from '../models/BusinessMember';
import { User } from '../models/User';
import { sendEmail } from './notification.service';
import type { AIAccessDecision, AIAccessReason } from './business-ai-access.service';
import type { ConversationLanguage } from './conversation-intelligence.service';

/** One email per business per window, however many customers write in. */
const NOTICE_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Deliberately vague to the customer about which limit was hit — a shopper does
 * not need to hear about the merchant's billing, only that a person will reply.
 */
const CUSTOMER_FALLBACK: Record<'bn' | 'en', string> = {
    bn: 'ধন্যবাদ আপনার মেসেজের জন্য। এই মুহূর্তে আমাদের অটোমেটিক সহায়তা পাওয়া যাচ্ছে না, আমাদের একজন প্রতিনিধি খুব শিগগিরই আপনাকে উত্তর দেবেন।',
    en: 'Thanks for your message. Automatic replies are unavailable right now — someone from our team will get back to you shortly.',
};

const MERCHANT_NOTICE: Record<AIAccessReason, { subject: string; what: string; fix: string }> = {
    REQUEST_LIMIT_REACHED: {
        subject: 'Your AI replies have paused — monthly message limit reached',
        what: 'Your plan\'s monthly message allowance is used up, so the AI has stopped replying to customers.',
        fix: 'Upgrade your plan to restore replies immediately, or wait for the allowance to reset next period.',
    },
    TOKEN_LIMIT_REACHED: {
        subject: 'Your AI replies have paused — monthly usage limit reached',
        what: 'Your plan\'s monthly AI usage allowance is used up, so the AI has stopped replying to customers.',
        fix: 'Upgrade your plan to restore replies immediately, or wait for the allowance to reset next period.',
    },
    SUBSCRIPTION_INACTIVE: {
        subject: 'Your AI replies have paused — subscription inactive',
        what: 'Your subscription is not active, so the AI has stopped replying to customers.',
        fix: 'Renew or reactivate your subscription from Settings → Billing to restore replies.',
    },
    PLATFORM_SUSPENDED: {
        subject: 'Your AI replies have been paused by SellPilot',
        what: 'AI selling has been suspended on your account by the SellPilot team.',
        fix: 'Contact support to resolve this.',
    },
    BUSINESS_SUSPENDED: {
        subject: 'Your SellPilot account is suspended',
        what: 'Your business account is suspended, so the AI has stopped replying to customers.',
        fix: 'Contact support to resolve this.',
    },
    MERCHANT_DISABLED: {
        subject: 'AI replies are switched off for your store',
        what: 'AI selling is switched off in your own settings, so customers are getting your paused-reply message.',
        fix: 'Switch AI selling back on when you are ready.',
    },
};

/** Bangla for a Bangla or Banglish conversation, English otherwise. */
export function customerFallbackMessage(language: ConversationLanguage | undefined, pausedReply?: string) {
    const configured = String(pausedReply || '').trim();
    if (configured) return configured;
    return CUSTOMER_FALLBACK[language === 'bn' || language === 'banglish' || language === 'mixed' ? 'bn' : 'en'];
}

/**
 * Emails the business owners at most once per window. Never throws: a blocked
 * turn still has to answer the customer even when mail is unconfigured.
 */
export async function notifyMerchantOfBlock(businessId: string, reason: AIAccessReason, decision: AIAccessDecision, now = new Date()) {
    try {
        // One atomic claim, so concurrent inbound messages send one email between them.
        const claimed = await Business.updateOne(
            { _id: businessId, $or: [{ 'aiAccess.lastBlockNotifiedAt': { $exists: false } }, { 'aiAccess.lastBlockNotifiedAt': { $lt: new Date(now.getTime() - NOTICE_WINDOW_MS) } }] },
            { $set: { 'aiAccess.lastBlockNotifiedAt': now } },
        );
        if (!claimed.modifiedCount) return false;

        const owners = await BusinessMember.find({ businessId, role: 'Owner', status: 'active' }).select('userId').lean();
        if (!owners.length) return false;
        const users = await User.find({ _id: { $in: owners.map((owner) => owner.userId) }, status: 'active' }).select('email').lean();
        const recipients = users.map((user) => user.email).filter(Boolean);
        if (!recipients.length) return false;

        const notice = MERCHANT_NOTICE[reason];
        const used = decision.usage && decision.limits
            ? `\n\nThis period: ${decision.usage.requests.toLocaleString()} replies${decision.limits.requests !== null ? ` of ${decision.limits.requests.toLocaleString()}` : ''}, ${decision.usage.tokens.toLocaleString()} tokens${decision.limits.tokens !== null ? ` of ${decision.limits.tokens.toLocaleString()}` : ''}.`
            : '';
        const text = `${notice.what}${used}\n\nCustomers are still getting a holding message, and their conversations are waiting for you in your inbox.\n\n${notice.fix}`;
        return await sendEmail(recipients, notice.subject, text, `<p>${notice.what}</p>${used ? `<p>${used.trim()}</p>` : ''}<p>Customers are still getting a holding message, and their conversations are waiting for you in your inbox.</p><p>${notice.fix}</p>`);
    } catch (error) {
        console.warn('Could not notify merchant about paused AI replies:', error instanceof Error ? error.message : error);
        return false;
    }
}
