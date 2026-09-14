/**
 * The same shop conversation, three ways: English, Bangla and Banglish.
 *
 * Banglish was tuned first and reaches zero tokens; this measures whether a
 * customer who writes plain English or plain Bangla gets the same answers for
 * the same cost. Each turn prints what the customer said, whether it cost the
 * model anything, and the reply — a wrong-but-free answer is not a win.
 *
 * Run: npm run measure:languages
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

const CONVERSATIONS: Record<string, string[]> = {
    english: [
        'Hello',
        'I need a power bank',
        '20000 mah',
        'show me what products you have got',
        'what is the price?',
        'is it in stock?',
        'do you deliver to Dhaka?',
        'how much is the delivery charge?',
        'can I pay with bKash?',
        'ok I will take this one',
        'Rafiul Islam',
        '01712345678',
        'Mirpur 10, Dhaka',
        'yes please confirm my order',
        'when will I get it?',
        'what is my order status?',
        'are you an AI?',
        'okay thank you',
        'bye',
    ],
    bangla: [
        'আসসালামু আলাইকুম',
        'আমার একটা পাওয়ার ব্যাংক লাগবে',
        'কি কি প্রোডাক্ট আছে?',
        'দাম কত?',
        'স্টকে আছে?',
        'ঢাকায় ডেলিভারি হয়?',
        'ডেলিভারি চার্জ কত?',
        'বিকাশে পেমেন্ট করা যাবে?',
        'আচ্ছা এটা নিব',
        'রফিউল ইসলাম',
        '০১৭১২৩৪৫৬৭৮',
        'মিরপুর ১০, ঢাকা',
        'জি অর্ডারটা কনফার্ম করে দেন',
        'কবে পাবো?',
        'আমার অর্ডার স্ট্যাটাস কি?',
        'আপনি কি AI?',
        'ধন্যবাদ',
        'আচ্ছা ভাই',
    ],
    banglish: [
        'Assalamu alaikum',
        'amar ekta power bank lagbe',
        'ki ki product ache?',
        'dam koto?',
        'stock e ache?',
        'dhaka te delivery hoy?',
        'delivery charge koto?',
        'bikash e payment kora jabe?',
        'accha eta nibo',
        'Rafiul Islam',
        '01712345678',
        'Mirpur 10, Dhaka',
        'ji order ta confirm kore den',
        'kobe pabo?',
        'amar order status ki?',
        'apni ki AI?',
        'dhonnobad',
        'accha vai',
    ],
};

/** The prompt cost a model turn pays before any conversation content. */
const LLM_TURN_FLOOR = Math.ceil(SYSTEM_PROMPT.length / 4) + 300;

async function runConversation(businessId: string, principal: any, language: string, messages: string[]) {
    const conversationId = `measure-${language}`;
    await withTenantContext(principal, async () => {
        const customer = await Customer.create({ psid: `web-${language}`, name: 'Web User', notes: '' });
        await Conversation.create({ conversationId, customerId: customer._id, psid: `web-${language}`, platform: 'web-widget', metadata: {} });
    });

    let deterministic = 0;
    const escalated: string[] = [];
    console.log(`\n── ${language.toUpperCase()} ${'─'.repeat(Math.max(2, 66 - language.length))}`);

    for (const [index, message] of messages.entries()) {
        const reply: any = await withTenantContext(principal, async () => await getDeterministicResponse(
            businessId, message, { conversationId, psid: `web-${language}`, eventIdentifier: `${language}-${index}`, sandbox: true },
        ));
        if (reply) {
            deterministic += 1;
            const conversation = await withTenantContext(principal, async () => await Conversation.findOne({ conversationId }).lean());
            const merged = mergeMemory((conversation as any)?.metadata?.entityState, (typeof reply === 'string' ? {} : reply.memory) || {});
            await withTenantContext(principal, async () => await Conversation.updateOne({ conversationId }, { $set: { 'metadata.entityState': merged } }));
        } else {
            escalated.push(message);
        }
        const marker = reply ? '   0' : `~${LLM_TURN_FLOOR}`;
        const answer = reply ? String(typeof reply === 'string' ? reply : reply.message_text).replace(/\n/g, ' ⏎ ') : '(model)';
        console.log(`${String(index + 1).padStart(2)}. ${marker.padStart(6)}  ${message}`);
        console.log(`            → ${answer.slice(0, 150)}${answer.length > 150 ? '…' : ''}`);
    }

    const orders = await withTenantContext(principal, async () => await Order.countDocuments({ conversationId }));
    return { language, total: messages.length, deterministic, escalated, orders };
}

async function main() {
    // A replica set, because placing the order runs inside a transaction.
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
            await Product.create({
                name: 'Power Bank 20000mAh', slug: 'power-bank-20000mah', categoryId: category._id,
                basePrice: 2600, stock: 28, description: 'Fast-charging 20000 mAh power bank with dual USB output', merchantConfirmed: true,
            });
            await Product.create({
                name: 'Bluetooth Headphones', slug: 'bluetooth-headphones', categoryId: category._id,
                basePrice: 2500, stock: 12, description: 'Wireless over-ear headphones', merchantConfirmed: true,
            });
        });

        const results = [];
        for (const [language, messages] of Object.entries(CONVERSATIONS)) {
            results.push(await runConversation(businessId, principal, language, messages));
        }

        console.log(`\n${'═'.repeat(72)}`);
        for (const result of results) {
            const percent = Math.round((result.deterministic / result.total) * 100);
            const modelTurns = result.total - result.deterministic;
            console.log(
                `${result.language.padEnd(10)} ${String(result.deterministic).padStart(2)}/${result.total} zero-token (${String(percent).padStart(3)}%)`
                + `  ·  ~${String(modelTurns * LLM_TURN_FLOOR).padStart(5)} prompt tokens  ·  orders: ${result.orders}`,
            );
            if (result.escalated.length) console.log(`${' '.repeat(11)}escalated: ${result.escalated.map((m) => `"${m}"`).join(', ')}`);
        }
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('Language coverage measurement failed:', error);
    process.exit(1);
});
