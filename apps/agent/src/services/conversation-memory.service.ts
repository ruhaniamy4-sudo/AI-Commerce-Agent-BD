import { COLOR_WORDS } from './product-card';
import { cityFrom, extractLabelledDetails, quantityFrom } from './order-flow.service';

/**
 * Everything the assistant must still know on turn twenty.
 *
 * The LLM only ever sees the last few messages, and the rolling transcript
 * summary starts far later, so anything a customer said early — their budget,
 * size, city, the product they were quoted — used to vanish after two exchanges.
 * This memory is extracted with plain regexes (zero LLM calls), merged forward on
 * every turn, and re-injected as one short line, which is far cheaper than
 * carrying a longer message window.
 */
export interface ConversationMemory {
    preferredLanguage?: string;
    detectedLanguage?: string;
    conversationStage?: string;
    activeProductId?: string;
    activeProductName?: string;
    activeProductCode?: string;
    activeProductPrice?: number;
    recentProductIds?: string[];
    budget?: number;
    size?: string;
    color?: string;
    quantity?: number;
    city?: string;
    customerName?: string;
    customerPhone?: string;
    lastOrderNumber?: string;
    /** What the customer said they need it for — "gift", "biye", "office". */
    purpose?: string;
    /** When they need it — "kalke", "friday", "eid er age". */
    deadline?: string;
    [key: string]: unknown;
}

const SIZE_PATTERN = /\b(?:size|sizes|সাইজ)\s*[:\-]?\s*(xxl|xl|xs|s|m|l|\d{2})\b|\b(xxl|xl)\s*(?:size|lagbe|chai)\b/i;
const PURPOSE_PATTERN = /\b(gift|উপহার|gift er jonno|biye|wedding|birthday|janmodin|office|oshusto|travel|vromon|puja|eid|ঈদ|corporate)\b/i;
const DEADLINE_PATTERN = /\b(aj(?:ke)?|kal(?:ke)?|porshu|ei sptahe|this week|tomorrow|today|friday|sukrobar|eid er age|next week)\b|আজ(?:কে)?|কালকে?|পরশু|ঈদের আগে/i;

/** "3000 er moddhe", "budget 5000", "5k er vitore", "2 hajar er modhye". */
export function budgetFrom(text: string) {
    const thousand = text.match(/(?<![\d.])(\d{1,3})(?:\s*)(k|হাজার|hajar|hazar)\b/i);
    if (thousand) return Number(thousand[1]) * 1000;
    const explicit = text.match(/\b(?:budget|বাজেট)\s*(?:is|=|:)?\s*(?:৳|tk\.?|bdt)?\s*([\d,]{3,7})/i)
        || text.match(/(?:৳|tk\.?|bdt)\s*([\d,]{3,7})\s*(?:er|র|এর)?\s*(?:moddhe|modhye|vitore|bhitore|মধ্যে|ভিতরে|under|within)/i)
        || text.match(/\b([\d,]{3,7})\s*(?:taka|টাকা|tk)?\s*(?:er|র|এর)?\s*(?:moddhe|modhye|vitore|bhitore|মধ্যে|ভিতরে)\b/i)
        || text.match(/\b(?:under|within|max(?:imum)?)\s*(?:৳|tk\.?|bdt)?\s*([\d,]{3,7})\b/i);
    if (!explicit) return undefined;
    const value = Number(String(explicit[1]).replace(/,/g, ''));
    return Number.isFinite(value) && value >= 50 && value <= 10_000_000 ? value : undefined;
}

/** Facts worth keeping from one customer message. Absent keys leave memory untouched. */
export function extractTurnMemory(text: string): Partial<ConversationMemory> {
    const memory: Partial<ConversationMemory> = {};
    const labelled = extractLabelledDetails(text);

    const budget = budgetFrom(text);
    if (budget !== undefined) memory.budget = budget;

    const size = text.match(SIZE_PATTERN);
    if (size) memory.size = String(size[1] || size[2]).toUpperCase();

    const colorWord = text.toLowerCase().split(/[^a-zঀ-৿]+/).find((word) => word && COLOR_WORDS[word]);
    if (colorWord) memory.color = COLOR_WORDS[colorWord];

    const city = cityFrom(text);
    if (city) memory.city = city;

    if (labelled.fullName) memory.customerName = labelled.fullName;
    if (labelled.phone) memory.customerPhone = labelled.phone;

    const quantity = quantityFrom(text);
    if (quantity !== undefined) memory.quantity = quantity;

    const purpose = text.match(PURPOSE_PATTERN);
    if (purpose) memory.purpose = purpose[1] || purpose[0];

    const deadline = text.match(DEADLINE_PATTERN);
    if (deadline) memory.deadline = deadline[0];

    return memory;
}

/** Newer facts win; a fact never disappears because a later message did not repeat it. */
export function mergeMemory(previous: ConversationMemory | undefined, incoming: Partial<ConversationMemory>): ConversationMemory {
    const merged: ConversationMemory = { ...(previous || {}) };
    for (const [key, value] of Object.entries(incoming)) {
        if (value === undefined || value === null || value === '') continue;
        if (Array.isArray(value) && !value.length) continue;
        merged[key] = value;
    }
    return merged;
}

const PROMPT_FIELDS: Array<[keyof ConversationMemory, string]> = [
    ['customerName', 'name'],
    ['customerPhone', 'phone'],
    ['city', 'city'],
    ['budget', 'budget'],
    ['size', 'size'],
    ['color', 'colour'],
    ['quantity', 'qty'],
    ['purpose', 'for'],
    ['deadline', 'needs by'],
    ['activeProductName', 'viewing'],
    ['activeProductCode', 'code'],
    ['activeProductPrice', 'price'],
    ['lastOrderNumber', 'last order'],
];

/**
 * One line, roughly thirty tokens, that replaces the turns the model can no
 * longer see. Empty when nothing is known, so early turns pay nothing.
 */
export function memoryPromptLine(memory: ConversationMemory | undefined): string {
    if (!memory) return '';
    const parts = PROMPT_FIELDS
        .filter(([key]) => memory[key] !== undefined && memory[key] !== '')
        .map(([key, label]) => `${label} ${memory[key]}`);
    if (!parts.length) return '';
    return `Known about this customer (do not ask again): ${parts.join('; ')}.`;
}
