/**
 * How much of a real sales conversation costs nothing.
 *
 * Runs a realistic Bangladeshi chat against a live database and reports which
 * turns were answered deterministically (zero model tokens) and which still need
 * the model, with the measured prompt cost of the ones that do.
 *
 * Run: npm run measure:coverage
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SYSTEM_PROMPT } from '../agent/prompts';
import { Business } from '../models/Business';
import { Category } from '../models/Category';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from '../services/deterministic-response.service';
import { mergeMemory } from '../services/conversation-memory.service';

const CONVERSATION = [
    'Assalamu alaikum',
    'ki ki product ache?',
    'power bank er dam koto?',
    'accha',
    'dam ta beshi mone hocche, kom hobe na?',
    'bikash e payment kora jabe?',
    'delivery charge koto?',
    'apni ki AI?',
    '👍',
    'thik ache eta nibo',
    'Rafiul Islam',
    'vai kalke pabo to?',
    '01712345678',
    'Mirpur 10',
    'aro ekta baray den',
    'koto holo total',
    'ji vai order ta confirm kore den',
    'order ta kobe pabo?',
    'Amar order status ta ki?',
    'number: 01632149759',
    'apni ki AI?',
    'Okay vaiya thank you.',
    'accha vaiya',
    'ji apu',
    'pore kotha hobe',
];

// The prompt cost a model turn pays before any conversation content.
const LLM_TURN_FLOOR = Math.ceil(SYSTEM_PROMPT.length / 4) + 300;

async function main() {
    // A replica set, because placing the order runs inside a transaction.
    const server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(server.getUri());

    const businessId = new mongoose.Types.ObjectId().toString();
    const principal = { businessId, userId: 'measure', membershipId: 'measure', role: 'Owner' as const };
    const conversationId = 'measure-coverage';

    try {
        await withTenantContext(principal, async () => {
            await Business.create({
                _id: businessId, name: 'SellPilot Store', slug: 'sellpilot-store', businessType: 'ECOMMERCE',
                commerce: { paymentMethods: ['Cash on Delivery', 'bKash'], deliveryFees: { insideDhaka: 80, outsideDhaka: 130 } },
            } as any);
            const category = await Category.create({ name: 'Electronics', slug: 'electronics' });
            await Product.create({
                name: 'Power Bank 20000mAh', slug: 'power-bank-20000mah', categoryId: category._id,
                basePrice: 2600, stock: 28, description: 'Fast-charging power bank', merchantConfirmed: true,
            });
            const customer = await Customer.create({ psid: 'web-measure', name: 'Web User', notes: '' });
            await Conversation.create({ conversationId, customerId: customer._id, psid: 'web-measure', platform: 'web-widget', metadata: {} });
        });

        let deterministic = 0;
        const escalated: string[] = [];

        for (const [index, message] of CONVERSATION.entries()) {
            const reply: any = await withTenantContext(principal, async () => await getDeterministicResponse(
                businessId, message, { conversationId, psid: 'web-measure', eventIdentifier: `turn-${index}`, sandbox: true },
            ));
            if (reply) {
                deterministic += 1;
                // Carry the turn's memory forward exactly as the live pipeline does.
                const conversation = await withTenantContext(principal, async () => await Conversation.findOne({ conversationId }).lean());
                const merged = mergeMemory((conversation as any)?.metadata?.entityState, (typeof reply === 'string' ? {} : reply.memory) || {});
                await withTenantContext(principal, async () => await Conversation.updateOne({ conversationId }, { $set: { 'metadata.entityState': merged } }));
            } else {
                escalated.push(message);
            }
            const marker = reply ? '  0 tokens' : `~${LLM_TURN_FLOOR}+ tokens`;
            console.log(`${String(index + 1).padStart(2)}. ${marker}  ${message}`);
        }

        const total = CONVERSATION.length;
        const modelTurns = total - deterministic;
        console.log('');
        console.log(`Zero-token turns : ${deterministic}/${total} (${Math.round((deterministic / total) * 100)}%)`);
        console.log(`Model turns      : ${modelTurns} (~${modelTurns * LLM_TURN_FLOOR} prompt tokens for this conversation)`);
        if (escalated.length) console.log(`Still escalating : ${escalated.map((m) => `"${m}"`).join(', ')}`);
        const orders = await withTenantContext(principal, async () => await Order.countDocuments({}));
        console.log(`Orders placed    : ${orders}`);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('Coverage measurement failed:', error);
    process.exit(1);
});
