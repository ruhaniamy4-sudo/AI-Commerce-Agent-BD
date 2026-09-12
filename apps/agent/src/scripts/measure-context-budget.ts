/**
 * Prints the per-turn prompt cost of one LLM-assisted reply, so prompt changes
 * are judged by measured tokens rather than by feel.
 *
 * Run: npm run measure:context
 */
import { SYSTEM_PROMPT } from '../agent/prompts';
import { enforceContextBudget, formatContextPack } from '../services/rag.service';

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
const rows = [
    ['static system prompt', estimate(SYSTEM_PROMPT)],
    ['context pack (raw)', estimate(pack)],
    ['context pack (after budget cap)', estimate(budgeted)],
] as const;

if (process.env.DUMP) console.log(JSON.stringify(JSON.parse(pack), null, 1));
for (const [label, tokens] of rows) console.log(`${label.padEnd(34)} ~${tokens} tokens`);
console.log(`${'per-turn prompt floor'.padEnd(34)} ~${estimate(SYSTEM_PROMPT) + estimate(budgeted)} tokens (prompt + context, before history)`);
