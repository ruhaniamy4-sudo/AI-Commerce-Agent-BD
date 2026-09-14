import { BaseMessage } from '@langchain/core/messages';
import { businessTypeLabel, getConversationGuidance } from './adaptive-training.service';
import { detectExplicitLanguagePreference, scriptLanguage } from './turn-routing.service';

export type ConversationLanguage = 'bn' | 'en' | 'banglish' | 'mixed';
export type ConversationStage = 'DISCOVERY' | 'INTEREST' | 'QUALIFICATION' | 'COMPARISON' | 'OBJECTION' | 'PURCHASE_INTENT' | 'ORDER' | 'SUPPORT' | 'COMPLAINT' | 'HUMAN_HANDOFF';

export interface BrandVoiceSettings {
    tone?: 'friendly' | 'professional' | 'casual' | 'premium' | 'custom';
    replyLength?: 'short' | 'balanced' | 'detailed';
    language?: 'auto' | 'bn' | 'en' | 'banglish';
    salesBehavior?: 'helpful' | 'balanced' | 'sales_focused';
    emoji?: 'none' | 'light' | 'normal';
    customTone?: string;
    examples?: string[];
}

const bangla = /[\u0980-\u09ff]/;
const banglish = /\b(ache|ase|koto|lagbe|lagbo|dorkar|chai|chaan|ta|eta|eita|oita|ki|kivabe|keno|nibo|nebo|kinbo|khujchi|dekh(?:an|ao|abo)|den|dio|bhai|vai|apu|dam|pabo|korbo|kora|kore|korle|hobe|hoy|hoise|jabe|jay|jante|nile|dile|dibo|diben|pari|pare|parbo|thik|accha|acha|amar|ami|apnar|apnader|ekta|shob|sob|bolun|bolen|kon|konta)\b/i;

export function detectConversationLanguage(text: string): ConversationLanguage {
    // One detector for the whole pipeline: the zero-LLM replies and the model
    // path used to disagree about what "mixed" meant and answered the same
    // customer in two different registers.
    const script = scriptLanguage(text);
    return script === 'en' && banglish.test(text) ? 'banglish' : script;
}

export function resolveConversationLanguage(text: string, preferred?: ConversationLanguage): ConversationLanguage {
    const explicit = detectExplicitLanguagePreference(text);
    if (explicit) return explicit;
    const detected = detectConversationLanguage(text);
    if (!preferred) return detected;
    // A customer already answering in Bangla keeps Bangla when this turn merely
    // quotes a Latin product name.
    if (bangla.test(text)) return detected === 'mixed' && preferred === 'bn' ? 'bn' : detected;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (preferred === 'en' && detected === 'banglish' && wordCount >= 3) return 'banglish';
    if (['bn','banglish','mixed'].includes(preferred) && detected === 'en' && wordCount >= 4) return 'en';
    return preferred;
}

export function classifyConversationStage(text: string): ConversationStage {
    const value = text.toLowerCase();
    if (/human|person|agent|representative|মানুষ|কাস্টমার কেয়ার|staff/.test(value)) return 'HUMAN_HANDOFF';
    if (/complain|fraud|scam|angry|খারাপ|অভিযোগ|refund dispute|wrong product/.test(value)) return 'COMPLAINT';
    if (/order status|track|parcel|delivery koi|কোথায়|পার্সেল/.test(value)) return 'SUPPORT';
    if (/confirm|place order|buy now|নিব|অর্ডার কর|checkout/.test(value)) return 'ORDER';
    if (/price beshi|too expensive|delivery charge beshi|trust|original|onno jaygay|কম দামে/.test(value)) return 'OBJECTION';
    if (/compare|difference|versus|\bvs\b|পার্থক্য/.test(value)) return 'COMPARISON';
    if (/budget|size|color|colour|country|intake|visa type|service/.test(value)) return 'QUALIFICATION';
    if (/price|stock|available|ache|আছে|দাম|details|দেখান/.test(value)) return 'INTEREST';
    if (/buy|purchase|book|appointment|যোগাযোগ/.test(value)) return 'PURCHASE_INTENT';
    return 'DISCOVERY';
}

export function shouldOfferNextStep(text: string, stage: ConversationStage): boolean {
    if (/^(thanks?|thank you|ধন্যবাদ|bye|goodbye|allah hafez|ঠিক আছে|ok|okay)[!.\s]*$/i.test(text.trim())) return false;
    if (['COMPLAINT','HUMAN_HANDOFF'].includes(stage)) return false;
    if (/stop|don't continue|do not continue|আর লাগবে না/i.test(text)) return false;
    return ['DISCOVERY','INTEREST','QUALIFICATION','COMPARISON','OBJECTION','PURCHASE_INTENT','ORDER'].includes(stage);
}

export function shouldHandoffToHuman(text: string): { required: boolean; reason?: string } {
    if (/(?:talk|speak|connect|chat) (?:to|with) (?:a )?(?:human|person|agent|staff)|human agent|customer care|মানুষের সাথে|কাস্টমার কেয়ার|স্টাফের সাথে/i.test(text)) return { required: true, reason: 'Customer requested a person' };
    if (/refund dispute|wrong product|fraud|scam|formal complaint|অভিযোগ|ভুল পণ্য|রিফান্ড.*সমস্যা/i.test(text)) return { required: true, reason: 'Complaint or refund issue needs staff review' };
    return { required: false };
}

export function extractRememberedPreferences(messages: BaseMessage[]): Record<string, string> {
    const text = messages.filter((message) => message.getType() === 'human').map((message) => String(message.content)).join(' ');
    const memory: Record<string, string> = {};
    const budget = text.match(/(?:budget|বাজেট)\s*(?:is|=|:)?\s*(?:৳|tk\.?|bdt)?\s*([\d,]+)/i); if (budget) memory.budget = budget[1].replace(/,/g, '');
    const size = text.match(/(?:size|সাইজ)\s*(?:is|=|:)?\s*([a-z0-9-]{1,8})/i); if (size) memory.size = size[1].toUpperCase();
    const color = text.match(/\b(black|white|blue|navy|red|green|pink|yellow|কালো|সাদা|নীল|লাল)\b/i); if (color) memory.color = color[1];
    const country = text.match(/\b(canada|australia|uk|usa|germany|japan|কানাডা|অস্ট্রেলিয়া|যুক্তরাজ্য)\b/i); if (country) memory.country = country[1];
    const intake = text.match(/\b((?:spring|summer|fall|winter)\s*20\d{2}|20\d{2}\s+intake)\b/i); if (intake) memory.intake = intake[1];
    return memory;
}

export function deriveApprovedStyle(examples: string[] = []) {
    const approved = examples.map((example) => example.trim()).filter(Boolean).slice(-10);
    const sampleCount = approved.length; const joined = approved.join(' ');
    const averageWords = sampleCount ? Math.round(approved.reduce((sum, example) => sum + example.split(/\s+/).length, 0) / sampleCount) : 0;
    const emojiCount = (joined.match(/[\p{Extended_Pictographic}]/gu) || []).length;
    const languages = approved.map(detectConversationLanguage);
    const dominantLanguage = languages.sort((a, b) => languages.filter((value) => value === b).length - languages.filter((value) => value === a).length)[0];
    return { sampleCount, adaptationLevel: sampleCount < 3 ? 'default' : sampleCount < 6 ? 'partial' : 'established', averageWords, emojiFrequency: emojiCount / Math.max(1, sampleCount), dominantLanguage };
}

export function buildConversationInstructions(params: {
    business: { name?: string; businessType?: string; preferredLanguage?: string; brandVoice?: BrandVoiceSettings };
    customerText: string; history: BaseMessage[]; channel?: string; preferredLanguage?: ConversationLanguage;
}) {
    const voice = params.business.brandVoice || {};
    const stage = classifyConversationStage(params.customerText); const memory = extractRememberedPreferences(params.history);
    const learned = deriveApprovedStyle(voice.examples); const guidance = getConversationGuidance(params.business.businessType); const serviceBusiness = guidance.mode !== 'commerce';
    const configuredLanguage = voice.language || 'auto';
    const automaticLanguage = resolveConversationLanguage(params.customerText, params.preferredLanguage);
    const language = configuredLanguage === 'auto' ? automaticLanguage : configuredLanguage;
    const approvedStyleExamples = learned.sampleCount >= 3 ? (voice.examples || []).slice(-5).map((example) => String(example).replace(/[\r\n]+/g, ' ').slice(0, 300)) : [];
    // Every line here is paid for on every LLM turn, so each one has to earn its
    // place. The discovery question only matters while we are still discovering,
    // and the customer's remembered facts are carried by the single memory line
    // the caller appends — repeating them here was paying twice for the same
    // sentence and inviting the two copies to disagree.
    const openingHint = stage === 'DISCOVERY' || stage === 'INTEREST' ? `Discovery: ${guidance.discoveryQuestion}\n` : '';
    return {
        stage, language, memory, serviceBusiness, leadFields: guidance.leadFields,
        prompt: `\nPROFILE\nBusiness: ${params.business.name || 'Merchant'}; ${businessTypeLabel(params.business.businessType)}; ${guidance.mode}; channel: ${params.channel || 'web'}; stage: ${stage}.\nReply: ${language}, ${voice.tone || 'friendly'}, ${voice.replyLength || 'balanced'}, ${voice.emoji || 'light'} emoji.\n${openingHint}Safety: ${guidance.safety}\n${serviceBusiness ? 'Service qualification only; do not ask cart or stock questions.\n' : ''}Lead fields: ${guidance.leadFields.join(', ')}; collect gradually.\n${approvedStyleExamples.length ? `Style-only examples: ${JSON.stringify(approvedStyleExamples.slice(-2))}\n` : ''}${shouldOfferNextStep(params.customerText, stage) ? 'At most one useful next step.' : 'No sales CTA or appended question.'}`,
    };
}

export function guardResponseText(text: string, factualContext: string): string {
    let guarded = text
        .replace(/\bAs an AI(?: language model)?[,]?\s*/gi, '')
        .replace(/\bI(?:'|’)d be happy to assist(?: you)?[.!]?\s*/gi, '')
        .replace(/\bBased on the information provided[,]?\s*/gi, '')
        .replace(/\bHow may I assist you today\??/gi, 'What are you looking for?');
    if (!/best seller|bestseller/i.test(factualContext)) guarded = guarded.replace(/\b(?:a |our )?best[ -]?seller\b[.!]?/gi, '').trim();
    if (!/offer|discount|sale_?price/i.test(factualContext)) guarded = guarded.replace(/\b(?:special )?(?:offer|discount)(?: ends? (?:today|soon))?\b[.!]?/gi, '').trim();
    if (!/limited stock/i.test(factualContext)) guarded = guarded.replace(/\blimited stock\b[.!]?/gi, '').trim();
    if (!/waterproof/i.test(factualContext)) guarded = guarded.replace(/\b(?:100%\s+)?(?:fully\s+)?waterproof\b[.!]?/gi, 'water resistance is not confirmed as full waterproofing').trim();
    if (!/guarantee|guaranteed/i.test(factualContext)) guarded = guarded.replace(/\b(?:visa|approval|success|eligibility)\s+(?:is\s+)?guaranteed\b[.!]?/gi, 'the outcome cannot be guaranteed').trim();
    return guarded.replace(/\s{2,}/g, ' ').trim();
}
