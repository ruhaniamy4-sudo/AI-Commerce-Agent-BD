/**
 * A customer typing Bangla writes Bangla numerals: "০১৭১২৩৪৫৬৭৮" is a phone
 * number and "২ টা" is a quantity. Every pattern downstream matches ASCII, so
 * the digits are converted once here rather than in each of them.
 */
export function normalizeDigits(text: string) {
    return String(text ?? '').replace(/[\u09e6-\u09ef]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

/**
 * `\b` only knows Latin letters, so a bare Bangla keyword matched anywhere inside
 * a longer Bangla word: "ফি" (fee) sat inside "রফিউল", and a customer answering
 * with their own name was read as asking about a price.
 *
 * Bangla glues its suffixes on — "ডেলিভারিতে", "দামটা" — so only the start of the
 * word is anchored. That rejects a keyword buried mid-word while still matching
 * one that simply carries an ending.
 */
const BANGLA_LETTER = '\\u0980-\\u09FF';
export function bnWord(...words: string[]) {
    return new RegExp(`(?<![${BANGLA_LETTER}])(?:${words.join('|')})`);
}

export type LightweightIntent = 'PRODUCT_PRICE'|'PRODUCT_STOCK'|'PRODUCT_IMAGE'|'PRODUCT_VARIANT'|'PRODUCT_SEARCH'|'PRODUCT_COMPARE'|'CATALOG_BROWSE'|'ORDER_FLOW'|'ORDER_STATUS'|'BUSINESS_FACT'|'KNOWLEDGE'|'GENERAL_CONVERSATION'|'HUMAN_HANDOFF';

// Everything a customer wraps a product name in — pronouns, want-verbs, browse
// filler — is stripped before searching. "amar mug lagbe" must be searched as
// "mug", never as a product literally named "amar mug lagbe".
const stopWords = new Set((
    // English is written the same way: "Hello I need a power bank" must search
    // for "power bank", never for "hello" or "need".
    'hello hi hey yo good morning afternoon evening the an my your our you we they is are am was do does did have has had '
    + 'what which when where how why who whose whom will would can could should shall may might '
    + 'yes yeah yep yup no nope ok okay sure alright fine right well just also too very really '
    + 'got get some any one need needs needed want wants wanted looking look searching search find buy buying purchase order '
    + 'please thanks thank sir madam bro give send show tell know about for with from that those these there here '
    + 'er ar ki koto dam price stock ache ase available availability picture photo image pic deo den dekhao dekhaw '
    + 'show me this it etar eta ta under moddhe মধ্যে within bdt tk taka product item shob sob sokol somosto gula gulo guli list tolika '
    + 'dekhan dekhen dekhben dekhte apnader apnar tomader amader achhe '
    + 'ami amar amake amay apni apnara tumi tomar lagbe lagbo lagto dorkar chai chaii nibo nebo nite kinbo kinte khujchi khujci '
    + 'ekta ektu ektaa kono please plz bhai vai apu hobe hoy niye janan '
    + 'আমি আমার আমাকে আমায় আপনি আপনার তুমি লাগবে দরকার চাই নিব নেব কিনব কিনতে খুঁজছি একটা একটু ভাই আপু দয়া'
    // Bangla asks its questions with these; none of them names a product.
    + ' দাম মূল্য কত কি কী আছে নেই স্টক স্টকে ছবি কেমন কোন কোনটা কোনটি ভালো হয় হবে না এটা ওটা এই ঐ সেটা ওটার এটার'
    + ' জানতে চাই বলুন বলেন দেখান দেখাও দিন দেন করে কর কিভাবে কীভাবে কবে কোথায় ধন্যবাদ জি হ্যাঁ আচ্ছা'
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
    /\bwhat\s+(?:have\s+you\s+got|are\s+you\s+selling|can\s+i\s+buy)\b/i,
    /\bshow\s+(?:me\s+)?(?:what|which)\b[^?.!]{0,32}\b(?:have|sell|got|offer|available)\b/i,
    /\b(?:which|what)\s+products?\b[^?.!]{0,24}\b(?:do\s+you|are|have|available)\b/i,
    /\b(?:ki|kichu|kisu)\s*(?:ki)?\s*(?:bikri|bikroy|bechen)\s*(?:koren|kore)?\b/i,
    /(?:কি|কী)\s*(?:কি|কী)?\s*(?:বিক্রি\s*করেন|বেচেন|বিক্রয়\s*করেন)/,
    /\b(?:apnader|apnar|tomader|amader)\b[^?.!]{0,20}\bki\s*(?:ki)?\b[^?.!]{0,20}\b(?:ache|ase|acche)\b/i,
    /(?:আপনাদের|আপনার|তোমাদের)\s*(?:কাছে|এখানে)?\s*(?:কি|কী)\s*(?:কি|কী)?\s*আছে/,
];

export function isCatalogBrowseQuery(text: string) { return catalogBrowsePatterns.some((pattern) => pattern.test(text)); }

/**
  * A measurement on its own — "20000 mah", "1 litre", "64gb" — is the customer
  * answering which one they want, not starting a new topic. It carries no verb,
  * so without this it fell through to the model every time.
  */
const SPEC_ONLY = /^[\s\-]*\d{1,6}\s*(?:mah|mAh|ml|ltr|litre|liter|gb|tb|mb|kg|gm|gram|inch|in|cm|mm|watt|w|v|amp|ah|ohm|hz|px|mp)\b[\s.!?]*$/i;
export function isSpecRefinement(text: string) { return SPEC_ONLY.test(String(text || '').trim()); }

export function classifyLightweightIntent(text: string): LightweightIntent {
    if (isSpecRefinement(text)) return 'PRODUCT_SEARCH';
    // Every Latin keyword is word-bounded on purpose: an unbounded `phone` also
    // matches "headphone" and `fee` matches "coffee", which used to route real
    // product questions to the business-fact and price answers.
    if (/\b(?:human|agent|staff)\b/i.test(text) || bnWord('মানুষ', 'কাস্টমার\\s*কেয়ার').test(text)) return 'HUMAN_HANDOFF';
    // A quoted order number is a status question on its own, however it is phrased.
    if (/\bORD[-_ ]?[A-Z0-9][A-Z0-9-]{3,}\b/i.test(text)) return 'ORDER_STATUS';
    if ((/\b(?:order|track|parcel)\b/i.test(text) || bnWord('অর্ডার', 'পার্সেল').test(text))
        && (/\b(?:status|where|track|parcel|delivery|koi|kothay|hoise|khobor|janaben|update|kobe|peye)\b/i.test(text)
            || bnWord('অবস্থা', 'কোথায়', 'পার্সেল', 'ডেলিভারি', 'খবর', 'কবে', 'স্ট্যাটাস', 'স্টেটাস', 'আপডেট', 'ট্র্যাক').test(text))) return 'ORDER_STATUS';
    if (/\bhow\s+many\b[^?.!]{0,28}\b(?:order|buy|take|get|available|in\s+stock)\b|\bkoyta\b[^?.!]{0,20}\b(?:ache|nite|order)\b|কয়টা\s*(?:আছে|নিতে|অর্ডার)/i.test(text)) return 'PRODUCT_STOCK';
    if (/\b(?:picture|photo|image|pic)\b/i.test(text) || bnWord('ছবি').test(text)) return 'PRODUCT_IMAGE';
    if (/\b(?:compare|better|best|versus|vs)\b|কোনটা ভালো|konta better/i.test(text)) return 'PRODUCT_COMPARE';
    if (isCatalogBrowseQuery(text)) return 'CATALOG_BROWSE';
    if (/\b(?:delivery|shipping)\b.{0,20}\b(?:charge|cost|fee|koto|kotodin|koydin|somoy|time)\b|\b(?:charge|cost|fee)\b.{0,20}\b(?:delivery|shipping)\b|\bdhaka\b.{0,20}\bdelivery\b|\bdelivery\b.{0,20}\bdhaka\b|\bcod\b|cash on delivery|payment method|\b(?:bkash|bikash|nagad|rocket|upay|card|advance)\b|\b(?:support|contact|phone|mobile|whatsapp)\s*(?:number|no\b)|\b(?:address|location)\b|opening hour|working hour/i.test(text)
        || bnWord('ডেলিভারি').test(text) && bnWord('চার্জ', 'খরচ', 'কত', 'কতদিন', 'সময়').test(text)
        || bnWord('বিকাশ', 'নগদ', 'রকেট', 'ঠিকানা', 'নাম্বার', 'নম্বর').test(text)
        // "do you deliver to Dhaka?" uses the verb, not the noun, and Bangla asks
        // "ঢাকায় ডেলিভারি হয়?" with no charge word in sight.
        || /\bdeliver\b|\b(?:ship|shipping)\s+to\b/i.test(text)
        || bnWord('ডেলিভারি').test(text) && /(?:হয়|করেন|দেন|যায়|আছে|দেবেন|করবেন|থাকেন)/.test(text)
        // "when will I get it?", "kobe pabo?", "কবে পাবো?" — a delivery-time question.
        || /\bwhen\s+(?:will|do|can|would)\s+(?:i|we|it|my)\b|\bhow\s+(?:long|many\s+days)\b|\bkobe\s*(?:pabo|paba|dibe|ashbe)\b/i.test(text)
        || /\b(?:can|could|will)\s+i\s+(?:get|have|receive)\s+(?:it|this|that|them)\b[^?.!]{0,24}\b(?:today|tomorrow|tonight|by|within|before)\b/i.test(text)
        || bnWord('কবে').test(text) && /(?:পাবো|পাব|পাওয়া|আসবে|দিবেন|দেবেন|হবে)/.test(text)
        || bnWord('কতদিন').test(text)) return 'BUSINESS_FACT';
    if (/\b(?:price|cost|dam|fee|rate|koto)\b/i.test(text) || bnWord('দাম', 'মূল্য', 'ফি', 'কত').test(text)) return 'PRODUCT_PRICE';
    if (/\b(?:black|white|blue|red|green|size|color|colour)\b/i.test(text) || bnWord('কালো', 'সাদা', 'নীল', 'লাল', 'সাইজ').test(text)) return 'PRODUCT_VARIANT';
    if (/\b(?:offer|discount|sale|price drop)\b/i.test(text) || bnWord('অফার', 'ছাড়').test(text)) return 'GENERAL_CONVERSATION';
    if (/\b(?:stock|available|availability|ache|ase)\b|pawa jabe/i.test(text) || bnWord('আছে', 'স্টক', 'পাওয়া\\s*যাবে').test(text)) return 'PRODUCT_STOCK';
    if (/\b(?:dekhaw|dekhao|dekhan|show|recommend|suggest|khujchi|khujci|chai|lagbe|lagbo|dorkar|nibo|nebo|nite|kinbo|kinte)\b/i.test(text)
        || bnWord('চাই', 'লাগবে', 'নিব', 'দেখা', 'দরকার').test(text)
        // The same sentence in English: "I need a power bank", "looking for a mug".
        || /\b(?:need|needed|needs|want|wanted|required|require|looking\s+for|look\s+for|searching\s+for|search\s+for|find|buy|purchase|interested\s+in|got\s+any|do\s+you\s+have|any)\b/i.test(text)
        // A bare noun phrase with a please on the end — "power bank please" —
        // is a request. Kept short so a sentence cannot drift in here.
        || (/\b(?:please|plz|pls)[\s!.]*$/i.test(text) && text.trim().split(/\s+/).length <= 5)
        || bnWord('খুঁজছি', 'কিনব', 'কিনতে', 'নিতে', 'দেখান', 'দেখাও', 'পছন্দ', 'কোনো').test(text)
        || extractBudget(text) !== undefined) return 'PRODUCT_SEARCH';
    if (/\b(?:policy|return|exchange|refund|warranty|document|eligibility|process)\b/i.test(text) || bnWord('কাগজ', 'যোগ্যতা', 'ফেরত', 'রিটার্ন', 'ওয়ারেন্টি').test(text)) return 'KNOWLEDGE';
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
