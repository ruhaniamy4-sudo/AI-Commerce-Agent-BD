export type LightweightIntent = 'PRODUCT_PRICE'|'PRODUCT_STOCK'|'PRODUCT_IMAGE'|'PRODUCT_VARIANT'|'PRODUCT_SEARCH'|'PRODUCT_COMPARE'|'ORDER_STATUS'|'BUSINESS_FACT'|'KNOWLEDGE'|'GENERAL_CONVERSATION'|'HUMAN_HANDOFF';

const stopWords = new Set('er ar ki koto dam price stock ache ase available availability picture photo image pic deo den dekhao dekhaw show me this it etar eta ta under moddhe মধ্যে within bdt tk taka product item'.split(' '));
const bangla = /[\u0980-\u09ff]/; const banglish = /\b(ache|ase|koto|lagbe|chai|ta|eta|ki|kivabe|dekhaw|deo|den|dam|pabo|hobe)\b/i;

export function detectLightweightLanguage(text: string) { const hasBangla = bangla.test(text); const hasLatin = /[a-z]/i.test(text); return hasBangla && hasLatin ? 'mixed' : hasBangla ? 'bn' : banglish.test(text) ? 'banglish' : 'en'; }
export function detectExplicitLanguagePreference(text: string): 'bn'|'en'|'banglish'|undefined {
    if (/banglish(?:\s+(?:e|a|te))?\s+(?:bolo|bolen|reply|speak)|বাংলিশ/i.test(text)) return 'banglish';
    if (/bangla(?:\s+(?:e|a|te))?\s+(?:bolo|bolen|reply|speak)|বাংলা(?:য়|তে)?\s*(?:বল|লিখ|উত্তর)/i.test(text)) return 'bn';
    if (/english(?:\s+(?:e|a|te|please))?\s*(?:bolo|bolen|reply|speak)?|ইংরেজি(?:তে)?\s*(?:বল|লিখ|উত্তর)/i.test(text)) return 'en';
    return undefined;
}
export function parseSearchTerms(text: string) { return text.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ').split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word)).slice(0, 8); }
export function extractBudget(text: string) { const match = text.toLowerCase().match(/(?:under|within|moddhe|মধ্যে|ভিতরে|budget)?\s*(?:৳|tk|bdt)?\s*(\d+(?:\.\d+)?)\s*(k|হাজার)?/i); if (!match || !/(under|within|moddhe|মধ্যে|ভিতরে|budget|৳|tk|bdt|হাজার|\bk\b)/i.test(text)) return undefined; return Math.round(Number(match[1]) * (match[2] ? 1000 : 1)); }

export function classifyLightweightIntent(text: string): LightweightIntent {
    if (/(?:human|agent|staff|মানুষ|কাস্টমার কেয়ার)/i.test(text)) return 'HUMAN_HANDOFF';
    if (/order|track|parcel|অর্ডার|পার্সেল/i.test(text) && /status|where|track|parcel|delivery|koi|kothay|hoise|অবস্থা|কোথায়|পার্সেল|ডেলিভারি/i.test(text)) return 'ORDER_STATUS';
    if (/picture|photo|image|pic|ছবি/i.test(text)) return 'PRODUCT_IMAGE';
    if (/compare|better|best|কোনটা ভালো|konta better|versus|\bvs\b/i.test(text)) return 'PRODUCT_COMPARE';
    if (/(?:delivery|shipping).*(?:charge|cost|fee|koto)|(?:charge|cost|fee).*(?:delivery|shipping)|dhaka.*delivery|delivery.*dhaka|cod|cash on delivery|payment method|support number|phone|address|location|opening hour|working hour|ডেলিভারি(?:\s|.*)(?:চার্জ|খরচ|কত)|ঠিকানা/i.test(text)) return 'BUSINESS_FACT';
    if (/price|cost|dam|দাম|fee|ফি|\bkoto\b|কত/i.test(text)) return 'PRODUCT_PRICE';
    if (/black|white|blue|red|green|size|color|colour|কালো|সাদা|নীল|লাল/i.test(text)) return 'PRODUCT_VARIANT';
    if (/\b(?:offer|discount|sale|price drop|অফার|ছাড়)\b/i.test(text)) return 'GENERAL_CONVERSATION';
    if (/stock|available|availability|\b(?:ache|ase)\b|আছে|pawa jabe|পাওয়া যাবে/i.test(text)) return 'PRODUCT_STOCK';
    if (/dekhaw|dekhao|show|recommend|suggest|khujchi|\b(?:chai|lagbe|nibo)\b|চাই|লাগবে|নিব|দেখা/i.test(text) || extractBudget(text) !== undefined) return 'PRODUCT_SEARCH';
    if (/policy|return|refund|warranty|document|eligibility|process|কাগজ|যোগ্যতা/i.test(text)) return 'KNOWLEDGE';
    return 'GENERAL_CONVERSATION';
}

export function extractLightweightMemory(text: string) {
    const memory: Record<string, string> = { detectedLanguage: detectLightweightLanguage(text), conversationStage: classifyLightweightIntent(text) };
    const preferredLanguage = detectExplicitLanguagePreference(text); if (preferredLanguage) memory.preferredLanguage = preferredLanguage;
    const country = text.match(/\b(canada|australia|uk|usa|germany|japan|কানাডা|অস্ট্রেলিয়া|যুক্তরাজ্য)\b/i); if (country) memory.activeCountry = country[1];
    const visa = text.match(/\b(student|tourist|work|business|family)\s+visa\b/i); if (visa) memory.activeVisaType = `${visa[1]} visa`;
    const course = text.match(/\b(ssc|hsc|class\s*\d+|grade\s*\d+|science|commerce|arts|batch)\b/i); if (course) memory.activeCourse = course[1];
    const service = text.match(/\b(facebook ads|seo|web design|consultation|appointment)\b/i); if (service) memory.activeService = service[1];
    return memory;
}
