/**
 * Bangla words, Latin catalog.
 *
 * A Bangladeshi shop lists "Power Bank 20000mAh" and the customer asks for
 * "পাওয়ার ব্যাংক". Neither a substring match nor a text index connects the two,
 * so a full catalog used to answer "দুঃখিত, পাওয়ার ব্যাংক আমাদের কাছে নেই" and
 * the whole conversation fell apart from there.
 *
 * Two things bridge it, in order:
 *
 *  1. A vocabulary of the words Bangladeshi shops actually sell. "মগ" is a mug
 *     however it is spelled, and no amount of phonetics gets you there.
 *  2. Phonetic transliteration for everything else, which turns "হেডফোন" into
 *     "hedphon" — close enough for a regex against "Headphone" only after the
 *     spellings that differ are folded together (ph/f, v/b, sh/s, double letters).
 *
 * Everything here is a plain lookup: no model call, no network, no cost.
 */

/** What Bangladeshi catalogs are written in when the customer types Bangla. */
const VOCABULARY: Record<string, string[]> = {
    // Electronics
    'পাওয়ার': ['power'], 'ব্যাংক': ['bank'], 'পাওয়ারব্যাংক': ['power bank', 'powerbank'],
    'হেডফোন': ['headphone', 'headphones'], 'ইয়ারফোন': ['earphone', 'earbud'], 'ইয়ারবাড': ['earbud', 'airpod'],
    'চার্জার': ['charger'], 'ক্যাবল': ['cable'], 'কেবল': ['cable'], 'তার': ['cable', 'wire'],
    'মোবাইল': ['mobile', 'phone'], 'ফোন': ['phone', 'mobile'], 'স্মার্টফোন': ['smartphone', 'phone'],
    'ল্যাপটপ': ['laptop'], 'কম্পিউটার': ['computer', 'pc'], 'মাউস': ['mouse'], 'কিবোর্ড': ['keyboard'],
    'স্পিকার': ['speaker'], 'ঘড়ি': ['watch', 'clock'], 'স্মার্টওয়াচ': ['smartwatch', 'watch'],
    'ক্যামেরা': ['camera'], 'টিভি': ['tv', 'television'], 'ফ্যান': ['fan'], 'লাইট': ['light', 'lamp'],
    'বাতি': ['light', 'bulb'], 'ব্যাটারি': ['battery'], 'কভার': ['cover', 'case'], 'কেস': ['case', 'cover'],
    'প্রোটেক্টর': ['protector'], 'গ্লাস': ['glass'], 'স্ট্যান্ড': ['stand'], 'হোল্ডার': ['holder'],

    // Clothing and accessories
    'শার্ট': ['shirt'], 'টিশার্ট': ['t-shirt', 'tshirt', 'shirt'], 'প্যান্ট': ['pant', 'trouser'],
    'পাঞ্জাবি': ['panjabi', 'punjabi'], 'শাড়ি': ['saree', 'sari'], 'সালোয়ার': ['salwar'],
    'কামিজ': ['kameez', 'kamiz'], 'ওড়না': ['orna', 'dupatta'], 'জামা': ['dress', 'shirt'],
    'জুতা': ['shoe', 'shoes'], 'জুতো': ['shoe', 'shoes'], 'স্যান্ডেল': ['sandal'], 'ব্যাগ': ['bag'],
    'বেল্ট': ['belt'], 'মানিব্যাগ': ['wallet'], 'ওয়ালেট': ['wallet'], 'ক্যাপ': ['cap', 'hat'],
    'টুপি': ['cap', 'hat'], 'চশমা': ['glasses', 'sunglass'], 'গহনা': ['jewellery', 'jewelry'],

    // Home and kitchen
    'মগ': ['mug'], 'কাপ': ['cup'], 'প্লেট': ['plate'], 'বোতল': ['bottle'], 'বাটি': ['bowl'],
    'চামচ': ['spoon'], 'ছুরি': ['knife'], 'কেটলি': ['kettle'], 'ব্লেন্ডার': ['blender'],
    'চাদর': ['bedsheet', 'sheet'], 'বালিশ': ['pillow'], 'তোয়ালে': ['towel'], 'পর্দা': ['curtain'],
    'কম্বল': ['blanket'], 'ম্যাট': ['mat'], 'চেয়ার': ['chair'], 'টেবিল': ['table'],

    // Beauty, care, general
    'ক্রিম': ['cream'], 'তেল': ['oil'], 'শ্যাম্পু': ['shampoo'], 'সাবান': ['soap'],
    'পারফিউম': ['perfume'], 'লিপস্টিক': ['lipstick'], 'ফেসওয়াশ': ['facewash', 'face wash'],
    'বই': ['book'], 'খাতা': ['notebook', 'khata'], 'কলম': ['pen'], 'পেন': ['pen'],
    'খেলনা': ['toy'], 'গিফট': ['gift'], 'উপহার': ['gift'],

    // Words that describe rather than name
    'সেট': ['set'], 'কিট': ['kit'], 'প্যাক': ['pack'], 'বক্স': ['box'], 'কালার': ['color', 'colour'],
    'সাইজ': ['size'], 'ব্র্যান্ড': ['brand'], 'অরিজিনাল': ['original'], 'নতুন': ['new'],
};

/** Bangla letters to the Latin a Bangladeshi would type. Longest match first. */
const LETTERS: Array<[string, string]> = [
    ['ক্ষ', 'kh'], ['জ্ঞ', 'gg'], ['ঞ্চ', 'nch'], ['ঞ্জ', 'nj'], ['ঙ্ক', 'nk'], ['ঙ্গ', 'ng'],
    ['া', 'a'], ['ি', 'i'], ['ী', 'i'], ['ু', 'u'], ['ূ', 'u'], ['ৃ', 'ri'],
    ['ে', 'e'], ['ৈ', 'oi'], ['ো', 'o'], ['ৌ', 'ou'],
    ['অ', 'o'], ['আ', 'a'], ['ই', 'i'], ['ঈ', 'i'], ['উ', 'u'], ['ঊ', 'u'], ['ঋ', 'ri'],
    ['এ', 'e'], ['ঐ', 'oi'], ['ও', 'o'], ['ঔ', 'ou'],
    ['ক', 'k'], ['খ', 'kh'], ['গ', 'g'], ['ঘ', 'gh'], ['ঙ', 'ng'],
    ['চ', 'ch'], ['ছ', 'chh'], ['জ', 'j'], ['ঝ', 'jh'], ['ঞ', 'n'],
    ['ট', 't'], ['ঠ', 'th'], ['ড', 'd'], ['ঢ', 'dh'], ['ণ', 'n'],
    ['ত', 't'], ['থ', 'th'], ['দ', 'd'], ['ধ', 'dh'], ['ন', 'n'],
    ['প', 'p'], ['ফ', 'f'], ['ব', 'b'], ['ভ', 'v'], ['ম', 'm'],
    ['য', 'j'], ['র', 'r'], ['ল', 'l'], ['শ', 'sh'], ['ষ', 'sh'], ['স', 's'], ['হ', 'h'],
    ['ড়', 'r'], ['ঢ়', 'r'], ['য়', 'y'], ['ৎ', 't'], ['ং', 'ng'], ['ঃ', ''], ['ঁ', ''],
    ['্', ''], ['়', ''],
];

/** A rough Latin spelling of a Bangla word. */
export function transliterateBangla(word: string) {
    let out = '';
    let index = 0;
    while (index < word.length) {
        const match = LETTERS.find(([bangla]) => word.startsWith(bangla, index));
        if (match) {
            out += match[1];
            index += match[0].length;
        } else {
            out += word[index];
            index += 1;
        }
    }
    return out;
}

/**
 * Fold the spellings that differ but sound the same, so a transliteration can be
 * compared with what the merchant typed: "hedphon" and "headphone" both become
 * "hedfon".
 */
export function phoneticKey(word: string) {
    return String(word || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/ph/g, 'f')
        .replace(/[vw]/g, 'b')
        .replace(/(?:sh|ss)/g, 's')
        .replace(/ck|kh|q/g, 'k')
        .replace(/[aeiou]+/g, 'a')
        .replace(/(.)\1+/g, '$1');
}

const hasBangla = /[ঀ-৿]/;

/**
 * Everything one search term could be written as in the catalog: the word itself,
 * its known English equivalents, and a transliteration to fall back on.
 */
export function termAlternatives(term: string): string[] {
    const word = String(term || '').trim();
    if (!word || !hasBangla.test(word)) return [word];

    const alternatives = new Set<string>([word]);
    for (const mapped of VOCABULARY[word] || []) alternatives.add(mapped);

    // Bangla attaches its articles to the word: "মগটা" is still a mug.
    const stripped = word.replace(/(?:টা|টি|গুলা|গুলো|গুলি|টার|টির|ের|র|য়ের)$/u, '');
    if (stripped && stripped !== word) {
        alternatives.add(stripped);
        for (const mapped of VOCABULARY[stripped] || []) alternatives.add(mapped);
    }

    const latin = transliterateBangla(stripped || word);
    if (latin && /[a-z]/i.test(latin) && latin.length > 2) alternatives.add(latin);
    return [...alternatives];
}

/** Does this product read like a match for a Bangla word the customer used? */
export function phoneticallyMatches(haystack: string, term: string) {
    const key = phoneticKey(transliterateBangla(term));
    if (key.length < 3) return false;
    return phoneticKey(haystack).includes(key);
}
