import { HumanMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';
import { buildConversationInstructions, classifyConversationStage, deriveApprovedStyle, detectConversationLanguage, extractRememberedPreferences, guardResponseText, resolveConversationLanguage, shouldHandoffToHuman, shouldOfferNextStep } from './conversation-intelligence.service';

describe('tenant conversation intelligence', () => {
    it.each([
        ['কালোটা আছে?', 'bn'], ['black ta available?', 'banglish'], ['Is black available?', 'en'], ['কালো color available?', 'mixed'],
    ])('detects %s as %s', (text, expected) => expect(detectConversationLanguage(text)).toBe(expected));

    it('keeps explicit language preferences until the customer clearly switches', () => {
        expect(resolveConversationLanguage('delivery charge koto?', 'bn')).toBe('bn');
        expect(resolveConversationLanguage('Please explain this in English now', 'bn')).toBe('en');
        expect(resolveConversationLanguage('bangla te bolo', 'en')).toBe('bn');
        expect(resolveConversationLanguage('কালো color available?', 'en')).toBe('mixed');
    });

    it('uses business-specific controls without leaking another tenant voice', () => {
        const first = buildConversationInstructions({ business: { name: 'A', brandVoice: { tone: 'premium', emoji: 'none' } }, customerText: 'price koto?', history: [], channel: 'facebook' });
        const second = buildConversationInstructions({ business: { name: 'B', brandVoice: { tone: 'casual', emoji: 'normal' } }, customerText: 'price koto?', history: [], channel: 'facebook' });
        expect(first.prompt).toContain('banglish, premium'); expect(first.prompt).not.toContain('banglish, casual');
        expect(second.prompt).toContain('banglish, casual'); expect(second.prompt).not.toContain('Business: A');
    });

    it('adapts gradually only after enough approved examples', () => {
        expect(deriveApprovedStyle(['Hello']).adaptationLevel).toBe('default');
        expect(deriveApprovedStyle(['Hello', 'Hi', 'Welcome']).adaptationLevel).toBe('partial');
        expect(deriveApprovedStyle(['1','2','3','4','5','6']).adaptationLevel).toBe('established');
    });

    it('remembers budget, size, color, country and intake from recent customer turns', () => {
        const memory = extractRememberedPreferences([new HumanMessage('Budget 2000, size L'), new HumanMessage('black চাই, Canada Fall 2027 intake')]);
        expect(memory).toMatchObject({ budget: '2000', size: 'L', color: 'black', country: 'Canada', intake: 'Fall 2027' });
    });

    it('selects useful sales and support stages', () => {
        expect(classifyConversationStage('price beshi')).toBe('OBJECTION');
        expect(classifyConversationStage('compare these two')).toBe('COMPARISON');
        expect(classifyConversationStage('I want a human agent')).toBe('HUMAN_HANDOFF');
        expect(classifyConversationStage('wrong product, I want to complain')).toBe('COMPLAINT');
    });

    it('offers contextual hooks without forcing them at conversation endings or complaints', () => {
        expect(shouldOfferNextStep('black ta available?', 'INTEREST')).toBe(true);
        expect(shouldOfferNextStep('Thanks!', 'DISCOVERY')).toBe(false);
        expect(shouldOfferNextStep('wrong product', 'COMPLAINT')).toBe(false);
    });

    it('hands explicit person requests and serious disputes to staff without treating identity questions as requests', () => {
        expect(shouldHandoffToHuman('Can I talk to a human agent?').required).toBe(true);
        expect(shouldHandoffToHuman('I received the wrong product').required).toBe(true);
        expect(shouldHandoffToHuman('Are you an AI or human?').required).toBe(false);
    });

    it('switches service businesses away from ecommerce interrogation', () => {
        const result = buildConversationInstructions({ business: { businessType: 'Visa consultancy' }, customerText: 'Canada student visa niye jante chai', history: [], channel: 'web-widget' });
        expect(result.serviceBusiness).toBe(true); expect(result.prompt).toContain('do not ask cart or stock questions');
    });

    it('keeps the same core behavior across channels while adapting presentation', () => {
        const base = { business: { name: 'Shop' }, customerText: 'black ta available?', history: [] as HumanMessage[] };
        const web = buildConversationInstructions({ ...base, channel: 'web-widget' }); const messenger = buildConversationInstructions({ ...base, channel: 'facebook' });
        expect(web.stage).toBe(messenger.stage); expect(web.language).toBe(messenger.language); expect(web.prompt).toContain('channel: web-widget'); expect(messenger.prompt).toContain('channel: facebook');
    });

    it('removes generic AI phrasing and unsupported commercial claims', () => {
        const guarded = guardResponseText("As an AI, I'd be happy to assist you. This is our best seller. Limited stock!", '{}');
        expect(guarded).not.toMatch(/As an AI|happy to assist|best seller|limited stock/i);
        expect(guardResponseText('Our best seller is available.', '{"best seller":true}')).toContain('best seller');
    });

    it('prevents unsupported benefit upgrades and high-stakes guarantees', () => {
        expect(guardResponseText('It is fully waterproof.', '{"feature":"water resistant"}')).not.toMatch(/fully waterproof/i);
        expect(guardResponseText('Your visa is guaranteed.', '{"service":"profile review"}')).toContain('cannot be guaranteed');
        expect(guardResponseText('It is waterproof.', '{"feature":"waterproof"}')).toContain('waterproof');
    });
});
