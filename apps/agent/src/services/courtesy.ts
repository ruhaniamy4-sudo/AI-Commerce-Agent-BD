/**
 * The words a customer wraps a real question in.
 *
 * "আসসালামু আলাইকুম। পাওয়ারব্যাংক আছে?" is one greeting and one product
 * question, but the greeting used to survive into the catalog search, which ANDs
 * its terms — so a shop with two power banks in stock answered "দুঃখিত, আসসালামু
 * আলাইকুম পাওয়ারব্যাংক আমাদের কাছে নেই". Latin "assalamu alaikum" did the same;
 * "hello bhai" only escaped because those two words happened to be stop words.
 *
 * This module owns that vocabulary once, so the courtesy classifier and the
 * search-term parser can never disagree about what counts as politeness. It
 * imports nothing, which is what lets both of them use it.
 */

export type CourtesyKind = 'salaam' | 'thanks' | 'greeting' | 'ack' | 'honorific' | 'filler';

/** Multi-word courtesy, folded to a single token before the word lookup. */
export const COURTESY_PHRASES: Array<[RegExp, string]> = [
    [/\bwalaikum\s*(?:as)?salam(?:u)?\b|ওয়ালাইকুম\s*(?:আস)?সালাম/gi, ' salaam '],
    [/\bassalamu?\s*(?:o\s*)?alaikum\b|assalamualaykum|assalamualaikum|আসসালামু?\s*[-–]?\s*আলাইকুম/gi, ' salaam '],
    [/\bthank\s*(?:you|u)\b|\bmany\s*thanks\b/gi, ' thanks '],
    [/\bthik\s*(?:ache|ase)\b|ঠিক\s*আছে/gi, ' ack '],
    [/\bkemon\s*(?:achen|acho|ase|asen)\b|কেমন\s*(?:আছেন|আছো)/gi, ' greeting '],
    [/\bki\s*khobor\b|কি\s*খবর|কী\s*খবর/gi, ' greeting '],
    [/\bgood\s*(?:morning|afternoon|evening|night)\b/gi, ' greeting '],
    [/\bshubho\s*(?:sokal|dupur|bikal|sondha)\b|শুভ\s*(?:সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত্রি|রাত)/gi, ' greeting '],
];

export const COURTESY_WORDS: Record<string, CourtesyKind> = {
    salaam: 'salaam', salam: 'salaam', slm: 'salaam', সালাম: 'salaam', আসসালামু: 'salaam', আলাইকুম: 'salaam',
    ওয়ালাইকুম: 'salaam', আসসালামুআলাইকুম: 'salaam', assalamu: 'salaam', alaikum: 'salaam', walaikum: 'salaam',
    thanks: 'thanks', thank: 'thanks', thnx: 'thanks', thx: 'thanks', tnx: 'thanks', shukriya: 'thanks',
    dhonnobad: 'thanks', dhonyobad: 'thanks', ধন্যবাদ: 'thanks', শুকরিয়া: 'thanks',
    hi: 'greeting', hello: 'greeting', helo: 'greeting', hey: 'greeting', greeting: 'greeting', greetings: 'greeting',
    হ্যালো: 'greeting', হাই: 'greeting', নমস্কার: 'greeting', আদাব: 'greeting', namaskar: 'greeting', adab: 'greeting',
    ok: 'ack', okay: 'ack', okk: 'ack', okey: 'ack', k: 'ack', hmm: 'ack', hm: 'ack', hmmm: 'ack',
    acha: 'ack', accha: 'ack', achcha: 'ack', ack: 'ack', ji: 'ack', jee: 'ack', hae: 'ack', ha: 'ack', haa: 'ack',
    yes: 'ack', yeah: 'ack', right: 'ack', done: 'ack', fine: 'ack', bujhlam: 'ack', bujhechi: 'ack',
    nice: 'ack', great: 'ack', good: 'ack', shundor: 'ack', sundor: 'ack',
    আচ্ছা: 'ack', হুম: 'ack', জি: 'ack', হ্যাঁ: 'ack', ভালো: 'ack', সুন্দর: 'ack', বুঝলাম: 'ack',
    vai: 'honorific', vaia: 'honorific', vaiya: 'honorific', bhai: 'honorific', bhaiya: 'honorific', bhaiyya: 'honorific',
    vaijan: 'honorific', bhaijan: 'honorific', apu: 'honorific', apa: 'honorific', apuni: 'honorific',
    bro: 'honorific', brother: 'honorific', sir: 'honorific', madam: 'honorific', mam: 'honorific', dada: 'honorific',
    ভাই: 'honorific', ভাইয়া: 'honorific', ভাইজান: 'honorific', আপু: 'honorific', আপা: 'honorific',
    স্যার: 'honorific', ম্যাডাম: 'honorific', দাদা: 'honorific',
    you: 'filler', u: 'filler', a: 'filler', lot: 'filler', so: 'filler', much: 'filler', very: 'filler',
    amar: 'filler', apnake: 'filler', onek: 'filler', আপনাকে: 'filler', অনেক: 'filler',
};

function foldPhrases(text: string) {
    let normalized = ` ${String(text ?? '').toLowerCase()} `;
    for (const [pattern, token] of COURTESY_PHRASES) normalized = normalized.replace(pattern, token);
    return normalized;
}

const WORD_SPLIT = /[^a-zঀ-৿]+/i;

/** The kind of courtesy this message is, or nothing if it says something else too. */
export function classifyCourtesy(text: string): 'salaam' | 'thanks' | 'greeting' | 'ack' | undefined {
    const words = foldPhrases(text).split(WORD_SPLIT).filter(Boolean);
    if (!words.length) return undefined;
    const kinds = words.map((word) => COURTESY_WORDS[word]);
    if (kinds.some((kind) => !kind)) return undefined;   // something real was said too
    if (kinds.includes('salaam')) return 'salaam';
    if (kinds.includes('thanks')) return 'thanks';
    if (kinds.includes('greeting')) return 'greeting';
    return kinds.includes('ack') ? 'ack' : undefined;
}

/**
 * The greeting a message opens with, even when it goes on to ask something real.
 * "Assalamu alaikum, power bank ache?" deserves the salaam returned *and* the
 * stock answered; only one of those used to happen.
 */
export function openingCourtesy(text: string): 'salaam' | 'greeting' | undefined {
    const words = foldPhrases(text).split(WORD_SPLIT).filter(Boolean);
    let opening: 'salaam' | 'greeting' | undefined;
    for (const word of words) {
        const kind = COURTESY_WORDS[word];
        if (kind === 'salaam') return 'salaam';
        if (kind === 'greeting') { opening = 'greeting'; continue; }
        // Honorifics and fillers may sit between the greeting and the question.
        if (kind === 'honorific' || kind === 'filler' || kind === 'ack') continue;
        break;   // the real message has started
    }
    return opening;
}

// Only the words that are unambiguously address, never description. "good",
// "nice" and "fine" are courtesy in "nice, thanks" but they are also how a
// product gets described, so they stay in the text and the stop-word list deals
// with them.
const STRIPPABLE: CourtesyKind[] = ['salaam', 'greeting', 'thanks', 'honorific'];

/**
 * The message with its politeness removed, so only what the customer actually
 * asked for reaches the catalog.
 */
export function stripCourtesy(text: string): string {
    return foldPhrases(text)
        .split(/([^a-zঀ-৿]+)/i)
        .map((part) => (!part || WORD_SPLIT.test(part) ? part : STRIPPABLE.includes(COURTESY_WORDS[part]) ? ' ' : part))
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
