export type LightweightIntent = 'PRODUCT_PRICE'|'PRODUCT_STOCK'|'PRODUCT_IMAGE'|'PRODUCT_VARIANT'|'PRODUCT_SEARCH'|'PRODUCT_COMPARE'|'CATALOG_BROWSE'|'ORDER_FLOW'|'ORDER_STATUS'|'BUSINESS_FACT'|'KNOWLEDGE'|'GENERAL_CONVERSATION'|'HUMAN_HANDOFF';

// Everything a customer wraps a product name in — pronouns, want-verbs, browse
// filler — is stripped before searching. "amar mug lagbe" must be searched as
// "mug", never as a product literally named "amar mug lagbe".
const stopWords = new Set(('er ar ki koto dam price stock ache ase available availability picture photo image pic deo den dekhao dekhaw '
    + 'show me this it etar eta ta under moddhe মধ্যে within bdt tk taka product item shob sob sokol somosto gula gulo guli list tolika '
    + 'dekhan dekhen dekhben dekhte apnader apnar tomader amader achhe '
    + 'ami amar amake amay apni apnara tumi tomar lagbe lagbo lagto dorkar chai chaii nibo nebo nite kinbo kinte khujchi khujci '
    + 'ekta ektu ektaa kono please plz bhai vai apu hobe hoy niye janan '
    + 'আমি আমার আমাকে আমায় আপনি আপনার তুমি লাগবে দরকার চাই নিব নেব কিনব কিনতে খুঁজছি একটা একটু ভাই আপু দয়া'
    + ' সব সকল সমস্ত লিস্ট তালিকা প্রোডাক্ট পণ্য আইটেম').split(' '));
const bangla = /[\u0980-\u09ff]/; const banglish = /\b(ache|ase|koto|lagbe|lagbo|dorkar|chai|ta|eta|ki|kivabe|dekhaw|dekhao|dekhan|deo|den|dam|pabo|hobe|amar|ami|apnar|apnader|ekta|shob|sob|kon|konta|nibo|kinbo)\b/i;

export function detectLightweightLanguage(text: string) { const hasBangla = bangla.test(text); const hasLatin = /[a-z]/i.test(text); return hasBangla && hasLatin ? 'mixed' : hasBangla ? 'bn' : banglish.test(text) ? 'banglish' : 'en'; }
export function detectExplicitLanguagePreference(text: string): 'bn'|'en'|'banglish'|undefined {
    if (/banglish(?:\s+(?:e|a|te))?\s+(?:bolo|bolen|reply|speak)|বাংলিশ/i.test(text)) return 'banglish';
    if (/bangla(?:\s+(?:e|a|te))?\s+(?:bolo|bolen|reply|speak)|বাংলা(?:য়|তে)?\s*(?:বল|লিখ|উত্তর)/i.test(text)) return 'bn';
    if (/english(?:\s+(?:e|a|te|please))?\s*(?:bolo|bolen|reply|speak)?|ইংরেজি(?:তে)?\s*(?:বল|লিখ|উত্তর)/i.test(text)) return 'en';
    return undefined;
}
export function parseSearchTerms(text: string) { return text.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]+/g, ' ').split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word)).slice(0, 8); }
export function extractBudget(text: string) { const match = text.toLowerCase().match(/(?:under|within|moddhe|মধ্যে|ভিতরে|budget)?\s*(?:৳|tk|bdt)?\s*(\d+(?:\.\d+)?)\s*(k|হাজার)?/i); if (!match || !/(under|within|moddhe|মধ্যে|ভিতরে|budget|৳|tk|bdt|হাজার|\bk\b)/i.test(text)) return undefined; return Math.round(Number(match[1]) * (match[2] ? 1000 : 1)); }

// A customer asking "what do you have?" is browsing the whole catalog, not
// searching for one named item. These turns carry no usable search term, so the
// generic product search finds nothing and used to answer "not available" for a
// merchant whose catalog is full. They are routed to CATALOG_BROWSE instead and
// answered from the live product list.
const catalogBrowsePatterns = [
    /\bki\s*ki\b[^?.!]{0,24}\b(?:product|products|item|items|jinis|jinish|collection|ache|ase|acche)\b/i,
    /(?:কি|কী)\s*(?:কি|কী)\s*(?:প্রোডাক্ট|পণ্য|আইটেম|জিনিস|কালেকশন)?\s*(?:আছে|পাওয়া|রাখেন|বিক্রি)/,
    /\b(?:shob|sob|sokol|somosto|all|entire|complete|full)\s*(?:gula|gulo|guli|the|your)?\s*(?:product|products|item|items|collection|catalog|catalogue|list|stock)\b/i,
    /(?:সব|সকল|সমস্ত)\s*(?:গুলা|গুলো|গুলি)?\s*(?:প্রোডাক্ট|পণ্য|আইটেম|কালেকশন|লিস্ট|তালিকা)/,
    /\b(?:product|products|item|items|price|stock|full)\s*(?:list|range|catalog|catalogue|collection|menu)\b/i,
    /(?:প্রোডাক্ট|পণ্য|প্রাইস|দাম)(?:ের)?\s*(?:লিস্ট|তালিকা|ক্যাটালগ)/,
    /\b(?:list|catalog|catalogue|collection|inventory|menu)\s*(?:ta|ti|tuku)?\s*(?:dekha(?:n|o|w|be|ben|te)?|dao|deo|den|pathan|send|show|chai)\b/i,
    /\bwhat\s+(?:kind\s+of\s+)?(?:do\s+you|products?|items?|things?|stuff)\b[^?.!]{0,32}\b(?:sell|have|offer|carry|stock|available)\b/i,
    /\bshow\s+(?:me\s+)?(?:all|everything|your\s+(?:products?|items?|catalog|catalogue|collection|list))\b/i,
    /\b(?:ki|kichu|kisu)\s*(?:ki)?\s*(?:bikri|bikroy|bechen)\s*(?:koren|kore)?\b/i,
    /(?:কি|কী)\s*(?:কি|কী)?\s*(?:বিক্রি\s*করেন|বেচেন|বিক্রয়\s*করেন)/,
    /\b(?:apnader|apnar|tomader|amader)\b[^?.!]{0,20}\bki\s*(?:ki)?\b[^?.!]{0,20}\b(?:ache|ase|acche)\b/i,
    /(?:আপনাদের|আপনার|তোমাদের)\s*(?:কাছে|এখানে)?\s*(?:কি|কী)\s*(?:কি|কী)?\s*আছে/,
];

export function isCatalogBrowseQuery(text: string) { return catalogBrowsePatterns.some((pattern) => pattern.test(text)); }

export function classifyLightweightIntent(text: string): LightweightIntent {
    // Every Latin keyword is word-bounded on purpose: an unbounded `phone` also
    // matches "headphone" and `fee` matches "coffee", which used to route real
    // product questions to the business-fact and price answers.
    if (/\b(?:human|agent|staff)\b|মানুষ|কাস্টমার কেয়ার/i.test(text)) return 'HUMAN_HANDOFF';
    if (/\b(?:order|track|parcel)\b|অর্ডার|পার্সেল/i.test(text) && /\b(?:status|where|track|parcel|delivery|koi|kothay|hoise)\b|অবস্থা|কোথায়|পার্সেল|ডেলিভারি/i.test(text)) return 'ORDER_STATUS';
    if (/\b(?:picture|photo|image|pic)\b|ছবি/i.test(text)) return 'PRODUCT_IMAGE';
    if (/\b(?:compare|better|best|versus|vs)\b|কোনটা ভালো|konta better/i.test(text)) return 'PRODUCT_COMPARE';
    if (isCatalogBrowseQuery(text)) return 'CATALOG_BROWSE';
    if (/\b(?:delivery|shipping)\b.{0,20}\b(?:charge|cost|fee|koto)\b|\b(?:charge|cost|fee)\b.{0,20}\b(?:delivery|shipping)\b|\bdhaka\b.{0,20}\bdelivery\b|\bdelivery\b.{0,20}\bdhaka\b|\bcod\b|cash on delivery|payment method|\b(?:support|contact|phone|mobile|whatsapp)\s*(?:number|no\b)|\b(?:address|location)\b|opening hour|working hour|ডেলিভারি(?:\s|.*)(?:চার্জ|খরচ|কত)|ঠিকানা|নাম্বার/i.test(text)) return 'BUSINESS_FACT';
    if (/\b(?:price|cost|dam|fee|rate|koto)\b|দাম|ফি|কত/i.test(text)) return 'PRODUCT_PRICE';
    if (/\b(?:black|white|blue|red|green|size|color|colour)\b|কালো|সাদা|নীল|লাল/i.test(text)) return 'PRODUCT_VARIANT';
    if (/\b(?:offer|discount|sale|price drop)\b|অফার|ছাড়/i.test(text)) return 'GENERAL_CONVERSATION';
    if (/\b(?:stock|available|availability|ache|ase)\b|আছে|pawa jabe|পাওয়া যাবে/i.test(text)) return 'PRODUCT_STOCK';
    if (/\b(?:dekhaw|dekhao|dekhan|show|recommend|suggest|khujchi|khujci|chai|lagbe|lagbo|dorkar|nibo|nebo|nite|kinbo|kinte)\b|চাই|লাগবে|নিব|দেখা|দরকার/i.test(text) || extractBudget(text) !== undefined) return 'PRODUCT_SEARCH';
    if (/\b(?:policy|return|exchange|refund|warranty|document|eligibility|process)\b|কাগজ|যোগ্যতা/i.test(text)) return 'KNOWLEDGE';
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
