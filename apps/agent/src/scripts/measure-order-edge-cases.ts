/**
 * The many ways a customer asks for a product and agrees to buy it.
 *
 * Each scenario is a short conversation whose last turn is the one under test:
 * the earlier turns only put a product on the table. A scenario passes when every
 * turn was answered deterministically — one model turn in the middle is a model
 * turn the merchant pays for.
 *
 * Run: npm run measure:edge-cases
 */
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Business } from '../models/Business';
import { Category } from '../models/Category';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from '../services/deterministic-response.service';
import { mergeMemory } from '../services/conversation-memory.service';

interface Scenario { group: string; turns: string[]; expectOrder?: boolean }

const SHOW = ['I need a power bank'];

const SCENARIOS: Scenario[] = [
    // ── Asking for a product ────────────────────────────────────────────────
    { group: 'ask', turns: ['Hello, I need a powerbank'] },
    { group: 'ask', turns: ['powerbank needed'] },
    { group: 'ask', turns: ['power bank please'] },
    { group: 'ask', turns: ['do you have power banks?'] },
    { group: 'ask', turns: ['any power bank available?'] },
    { group: 'ask', turns: ['I am looking for a power bank'] },
    { group: 'ask', turns: ['need a mug'] },
    { group: 'ask', turns: ['mug lagbe'] },
    { group: 'ask', turns: ['মগ লাগবে'] },
    { group: 'ask', turns: ['powerbank ta dekhan'] },
    { group: 'ask', turns: ['পাওয়ার ব্যাংক দেখান'] },
    { group: 'ask', turns: ['send me the price list'] },

    // ── Agreeing to buy, with the product already on screen ────────────────
    { group: 'confirm', turns: [...SHOW, 'yes please. I would like to get 1 piece of this.'], expectOrder: false },
    { group: 'confirm', turns: [...SHOW, 'I will take 1 piece'] },
    { group: 'confirm', turns: [...SHOW, 'give me one'] },
    { group: 'confirm', turns: [...SHOW, 'send me 2 pieces'] },
    { group: 'confirm', turns: [...SHOW, 'ok order it for me'] },
    { group: 'confirm', turns: [...SHOW, 'yes please'] },
    { group: 'confirm', turns: [...SHOW, 'I want this one'] },
    { group: 'confirm', turns: [...SHOW, 'book it'] },
    { group: 'confirm', turns: [...SHOW, 'please proceed'] },
    { group: 'confirm', turns: [...SHOW, 'go ahead with the order'] },
    { group: 'confirm', turns: [...SHOW, 'eta nibo'] },
    { group: 'confirm', turns: [...SHOW, 'এটা নিব'] },
    { group: 'confirm', turns: [...SHOW, 'ekta pathiye den'] },
    { group: 'confirm', turns: [...SHOW, 'একটা পাঠিয়ে দিন'] },

    // ── Handing over the delivery details ──────────────────────────────────
    { group: 'details', turns: [...SHOW, 'I will take one', 'Rafiul Islam Sifat, 01632149759, Agargaon'] },
    { group: 'details', turns: [...SHOW, 'I will take one', 'Rafiul Islam / 01632149759 / Mirpur 10, Dhaka'] },
    { group: 'details', turns: [...SHOW, 'I will take one', 'Rafiul Islam - 01632149759 - Dhanmondi 32'] },
    { group: 'details', turns: [...SHOW, 'I will take one', 'রফিউল ইসলাম, ০১৬৩২১৪৯৭৫৯, আগারগাঁও'] },
    { group: 'details', turns: [...SHOW, 'I will take one', 'name Rafiul phone 01632149759 address Uttara 7'] },

    // ── Answering one question at a time ───────────────────────────────────
    { group: 'stepwise', turns: [...SHOW, 'I will take one', 'Rafiul Islam', '01632149759', 'Agargaon, Dhaka'], expectOrder: false },
    { group: 'stepwise', turns: [...SHOW, 'how many can I order?', '1'] },

    // ── Changing their mind mid-order ──────────────────────────────────────
    { group: 'amend', turns: [...SHOW, 'I will take one', 'actually make it 2'] },
    { group: 'amend', turns: [...SHOW, 'I will take one', 'Rafiul Islam', 'sorry wrong name, it is Sifat'] },
    { group: 'amend', turns: [...SHOW, 'I will take one', 'cancel it'] },

    // ── All the way to a placed order, so the quantity can be checked ──────
    { group: 'purchase', turns: [...SHOW, 'send me 2 pieces', 'Rafiul Islam, 01632149759, Agargaon Dhaka', 'yes confirm'], expectOrder: true },
    { group: 'purchase', turns: [...SHOW, 'I will take one', 'actually make it 3', 'Rafiul Islam, 01632149759, Mirpur 10 Dhaka', 'confirm'], expectOrder: true },
    { group: 'purchase', turns: [...SHOW, 'eta 2 ta nibo', 'Rafiul Islam, 01632149759, Dhanmondi Dhaka', 'ji confirm kore den'], expectOrder: true },
    { group: 'purchase', turns: [...SHOW, 'এটা ২ টা নিব', 'রফিউল ইসলাম, ০১৬৩২১৪৯৭৫৯, ধানমন্ডি ঢাকা', 'কনফার্ম করেন'], expectOrder: true },

    // ── Questions that must never start or advance an order ────────────────
    { group: 'question', turns: [...SHOW, 'when will I get it?'] },
    { group: 'question', turns: [...SHOW, 'can I get it tomorrow?'] },
    { group: 'question', turns: [...SHOW, 'how much will 2 pieces cost?'] },
    { group: 'question', turns: [...SHOW, 'is there any discount?'] },
    { group: 'question', turns: [...SHOW, 'do you have it in black?'] },
];

async function main() {
    const server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(server.getUri());
    const businessId = new mongoose.Types.ObjectId().toString();
    const principal = { businessId, userId: 'measure', membershipId: 'measure', role: 'Owner' as const };

    try {
        await withTenantContext(principal, async () => {
            await Business.create({
                _id: businessId, name: 'SellPilot Store', slug: 'sellpilot-store', businessType: 'ECOMMERCE',
                commerce: { paymentMethods: ['Cash on Delivery', 'bKash'], deliveryFees: { insideDhaka: 80, outsideDhaka: 130 } },
            } as any);
            const category = await Category.create({ name: 'Electronics', slug: 'electronics' });
            await Product.create({ name: 'Power Bank 20000mAh', slug: 'power-bank-20000mah', categoryId: category._id, basePrice: 2600, stock: 28, description: 'Fast-charging 20000 mAh power bank', merchantConfirmed: true });
            await Product.create({ name: 'Ceramic Coffee Mug', slug: 'ceramic-coffee-mug', categoryId: category._id, basePrice: 550, stock: 50, description: 'Ceramic mug', merchantConfirmed: true });
            await Product.create({ name: 'Bluetooth Headphones', slug: 'bluetooth-headphones', categoryId: category._id, basePrice: 2500, stock: 12, description: 'Wireless headphones', merchantConfirmed: true });
        });

        const failures: Array<{ scenario: Scenario; turn: string }> = [];
        const byGroup = new Map<string, { total: number; passed: number }>();

        for (const [index, scenario] of SCENARIOS.entries()) {
            const conversationId = `edge-${index}`;
            await withTenantContext(principal, async () => {
                const customer = await Customer.create({ psid: `edge-${index}`, name: 'Web User', notes: '' });
                await Conversation.create({ conversationId, customerId: customer._id, psid: `edge-${index}`, platform: 'web-widget', metadata: {} });
            });

            let escalatedAt = '';
            let lastReply = '';
            for (const [turnIndex, message] of scenario.turns.entries()) {
                const reply: any = await withTenantContext(principal, async () => await getDeterministicResponse(
                    businessId, message, { conversationId, psid: `edge-${index}`, eventIdentifier: `edge-${index}-${turnIndex}`, sandbox: true },
                ));
                if (!reply) { if (!escalatedAt) escalatedAt = message; continue; }
                lastReply = String(typeof reply === 'string' ? reply : reply.message_text);
                const conversation = await withTenantContext(principal, async () => await Conversation.findOne({ conversationId }).lean());
                const merged = mergeMemory((conversation as any)?.metadata?.entityState, (typeof reply === 'string' ? {} : reply.memory) || {});
                await withTenantContext(principal, async () => await Conversation.updateOne({ conversationId }, { $set: { 'metadata.entityState': merged } }));
            }

            const stats = byGroup.get(scenario.group) || { total: 0, passed: 0 };
            stats.total += 1;
            if (!escalatedAt) stats.passed += 1;
            byGroup.set(scenario.group, stats);

            const label = scenario.turns[scenario.turns.length - 1];
            if (escalatedAt) {
                failures.push({ scenario, turn: escalatedAt });
                console.log(`FAIL [${scenario.group}] ${label}`);
                console.log(`        model turn on: "${escalatedAt}"`);
            } else {
                console.log(`ok   [${scenario.group}] ${label}`);
                console.log(`        → ${lastReply.replace(/\n/g, ' ⏎ ').slice(0, 120)}`);
            }
        }

        console.log(`\n${'═'.repeat(72)}`);
        for (const [group, stats] of byGroup) {
            console.log(`${group.padEnd(10)} ${String(stats.passed).padStart(2)}/${stats.total} free`);
        }
        const orders = await withTenantContext(principal, async () => await Order.countDocuments({}));
        console.log(`\n${SCENARIOS.length - failures.length}/${SCENARIOS.length} scenarios cost nothing · orders placed: ${orders}`);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('Edge case measurement failed:', error);
    process.exit(1);
});
