import { describe, expect, it } from 'vitest';
import { containsPaymentCredential, deriveMetaCapabilities, facebookConversationId, isOptInMessage, isOptOutMessage, META_WINDOW_MS } from './meta-policy.service';

describe('Messenger policy guards', () => {
    it.each(['stop', 'unsubscribe', "don't message me", 'do not contact me', 'আর মেসেজ দিবেন না', 'মেসেজ বন্ধ করুন'])('recognizes opt-out: %s', (text) => expect(isOptOutMessage(text)).toBe(true));
    it('recognizes opt-in without treating ordinary messages as consent changes', () => { expect(isOptInMessage('resume messages')).toBe(true); expect(isOptInMessage('what is the price?')).toBe(false); });
    it('detects payment credentials before AI processing', () => { expect(containsPaymentCredential('my CVV is 123')).toBe(true); expect(containsPaymentCredential('card 4111 1111 1111 1111')).toBe(true); });
    it('keeps healthcare automation restricted and marketing disabled', () => {
        const capabilities = deriveMetaCapabilities(['pages_show_list', 'pages_messaging', 'pages_manage_metadata'], 'CLINIC_SERVICE');
        expect(capabilities.canReplyNormally).toBe(false); expect(capabilities.canUseMarketingMessages).toBe(false); expect(capabilities.healthcareRestricted).toBe(true);
    });
    it('scopes conversation identity to Page and customer', () => { expect(facebookConversationId('page-a', 'user-1')).not.toBe(facebookConversationId('page-b', 'user-1')); expect(META_WINDOW_MS).toBe(86_400_000); });
});
