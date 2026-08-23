import { HumanMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';
import { agentGraph } from './agent/graph';
import { connectMongo } from './db/mongodb';
import { initializeScriptTenantContext } from './tenancy/script-context';
import { randomUUID } from 'node:crypto';
dotenv.config();

async function testAgent(businessId: string, message: string) {
    console.log(`\n--- Testing with message: "${message}" ---`);
    const state = await agentGraph.invoke({
        businessId,
        eventIdentifier: randomUUID(),
        messages: [new HumanMessage(message)],
        agentStatus: 'active',
        lastHumanActivity: Date.now(),
        conversationId: 'test-conv',
    });

    const lastMessage = state.messages[state.messages.length - 1];
    console.log('Agent Reply:', lastMessage.content);
}

async function runTests() {
    try {
        await connectMongo();
        const business = await initializeScriptTenantContext();
        const businessId = business._id.toString();

        // Test 1: Pricing Logic - Phase 1 (Asking for price)
        await testAgent(businessId, 'আপনাদের প্যাকেজ এর প্রাইস কত?');

        // Test 2: Pricing Logic - Phase 2 (Providing location)
        console.log('\n--- Simulating multi-turn for pricing ---');
        await testAgent(businessId, 'আমি ঢাকার ভিতরে থাকি। প্রাইস কত জানতে চাই।');

        // Test 3: Support Hours
        await testAgent(businessId, 'আপনাদের সাথে কখন যোগাযোগ করা যাবে?');

        // Test 4: Add Client Tool (Facebook Simulation - SILENT)
        console.log(
            '\n--- Testing Silent Add Client Tool with Facebook PSID ---'
        );
        const clientState = await agentGraph.invoke({
            businessId,
            eventIdentifier: randomUUID(),
            messages: [
                new HumanMessage(
                    'আমার ফোন নম্বর ০১৭০০০০০০০০, আমি একটি স্কুল চালাই আর আমাদের ১০০০ স্টুডেন্ট আছে।'
                ),
            ],
            agentStatus: 'active',
            lastHumanActivity: Date.now(),
            conversationId: 'fb_987654321', // Simulation of Facebook ID
        });
        const clientReply =
            clientState.messages[clientState.messages.length - 1];
        console.log('Agent Reply:', clientReply.content);

        // Test 5: Schedule Meeting Tool
        console.log('\n--- Testing Schedule Meeting Tool (Database Only) ---');
        await testAgent(
            businessId,
            'I want to schedule a meeting for tomorrow at 10am. My email is imran@edutechs.app'
        );

        console.log('\nVerification complete!');
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();
