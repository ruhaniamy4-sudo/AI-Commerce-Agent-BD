/**
 * Prints the per-turn prompt cost of one LLM-assisted reply, so prompt changes
 * are judged by measured tokens rather than by feel.
 *
 * Run: npm run measure:context
 */
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { SYSTEM_PROMPT } from '../agent/prompts';
import { enforceContextBudget, formatContextPack } from '../services/rag.service';
import { buildConversationInstructions } from '../services/conversation-intelligence.service';
import { buildSalesContextSnippet, computeSalesSignals } from '../services/sales-intelligence.service';
import { memoryPromptLine } from '../services/conversation-memory.service';
import { classifyLightweightIntent } from '../services/turn-routing.service';
import { getAIHistoryCharBudget, getAIHistoryMessageCharCap, getAIRecentMessageLimit } from '../services/ai-config';

const estimate = (text: string) => Math.ceil(text.length / 4);

const product = (name: string, code: string) => ({
    _id: code, name, publicCode: code, description: `${name} in premium finish, suitable for daily use and gifting.`,
    basePrice: 1200, salePrice: 999, stock: 14, availability: 'in_stock', brand: 'HouseBrand',
    aiSellingStatus: 'active', aiKnowledge: [{ question: 'Is it dishwasher safe?', answer: 'Yes, it is dishwasher safe.' }],
    variants: [{ name: 'White', sku: `${code}-W`, price: 999, stock: 7, isActive: true }],
    intelligence: { facts: ['ceramic', '350ml', 'microwave safe'], terms: ['mug', 'ceramic'] },
    _matchKind: 'constraint_match',
});

const context: any = {
    businessId: 'b1',
    query: { terms: ['mug'], colors: [], sizes: [], categories: [], materials: [], useCases: [], budgetMax: undefined, comparison: false, serviceIntent: false, highStakes: false },
    catalogHits: [product('Ceramic Coffee Mug', 'CER-9F2A'), product('Travel Mug Steel', 'TRA-1B3D')],
    offeringHits: [],
    knowledgeEntries: [{ type: 'POLICY', title: 'Delivery', content: 'Inside Dhaka 80 taka, outside Dhaka 130 taka, delivery in 2-3 days.', intelligence: { facts: ['80', '130'], riskLevel: 'normal' } }],
    awarenessEntries: [],
    customerProfile: { name: 'Guest', language: 'bn' },
    lastOrders: [],
};

const pack = formatContextPack(context);
const budgeted = enforceContextBudget(pack, 550);

// Everything else the turn actually sends. The static prompt and the context
// pack were the only two things measured here, which hid the fact that the
// profile, the sales line, the memory line and the replayed history together
// cost about as much again.
const customerText = 'ei mug ta 2 ta nibo';
const intent = classifyLightweightIntent(customerText);
const intelligence = buildConversationInstructions({
    business: { name: 'Merchant Workspace', businessType: 'ECOMMERCE', brandVoice: { tone: 'friendly', replyLength: 'balanced', emoji: 'light', language: 'auto' } },
    customerText, history: [], channel: 'facebook',
});
const salesSnippet = buildSalesContextSnippet(computeSalesSignals(customerText, intent, 'INTERESTED', true));
const memoryLine = memoryPromptLine({
    customerName: 'Rafiul Islam', customerPhone: '01712345678', city: 'Dhaka', quantity: 2,
    activeProductName: 'Ceramic Coffee Mug', activeProductCode: 'CER-9F2A', activeProductPrice: 999,
});

// A realistic window: short customer turns against assistant replies long enough
// to be trimmed by the per-message cap.
const transcript = [
    new HumanMessage('ki ki mug ache?'),
    new AIMessage(`Amader kache egulo ache:\n${'1. Ceramic Coffee Mug, CER-9F2A, ৳999\n2. Travel Mug Steel, TRA-1B3D, ৳999\n'.repeat(3)}Kon ta niye jante chan bolun.`),
    new HumanMessage('CER-9F2A tar dam koto?'),
    new AIMessage('Ceramic Coffee Mug, CER-9F2A, ৳999. Stock e 14 ta ache. Nite chaile bolben, ami order ta kore dicchi.'),
    new HumanMessage(customerText),
];
const cap = getAIHistoryMessageCharCap();
const windowed = transcript.slice(-getAIRecentMessageLimit());
let historyCharacters = 0;
let historyMessages = 0;
for (const message of [...windowed].reverse()) {
    const size = Math.min(String(message.content).length, cap);
    if (historyMessages && historyCharacters + size > getAIHistoryCharBudget()) break;
    historyCharacters += size;
    historyMessages += 1;
}

const rows: Array<readonly [string, number]> = [
    ['static system prompt', estimate(SYSTEM_PROMPT)],
    ['runtime profile', estimate(intelligence.prompt)],
    ['sales signals line', estimate(salesSnippet)],
    ['carried memory line', estimate(memoryLine)],
    ['context pack (raw)', estimate(pack)],
    ['context pack (after budget cap)', estimate(budgeted)],
    [`replayed history (${historyMessages} msgs, cap ${cap})`, Math.ceil(historyCharacters / 4)],
];

if (process.env.DUMP) console.log(JSON.stringify(JSON.parse(pack), null, 1));
for (const [label, tokens] of rows) console.log(`${label.padEnd(34)} ~${tokens} tokens`);
const inputTotal = estimate(SYSTEM_PROMPT) + estimate(intelligence.prompt) + estimate(salesSnippet) + estimate(memoryLine) + estimate(budgeted) + Math.ceil(historyCharacters / 4);
console.log(`${'per-turn input total'.padEnd(34)} ~${inputTotal} tokens (a retrieval turn; a plain turn drops the context pack)`);
console.log(`${'per-turn input, no retrieval'.padEnd(34)} ~${inputTotal - estimate(budgeted)} tokens`);
