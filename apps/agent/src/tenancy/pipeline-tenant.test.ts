import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../models/Conversation';
import { Product } from '../models/Product';
import { ensureConversation } from '../services/memory.service';
import { retrieveContext } from '../services/rag.service';
import { matchProductsWithRAG } from '../services/product-matcher.service';
import { createOrderWithStock } from '../services/checkout.service';
import { executeAgentAction } from '../services/agent-action.service';
import { withTenantContext } from './context';

const businessA = new mongoose.Types.ObjectId().toString();
const businessB = new mongoose.Types.ObjectId().toString();

function asBusinessA<T>(work: () => T) {
    return withTenantContext({
        businessId: businessA,
        userId: 'pipeline-test',
        membershipId: 'pipeline-test',
        role: 'Staff',
    }, work);
}

describe('message pipeline tenant guards', () => {
    afterEach(() => vi.restoreAllMocks());
    it('stops a mismatched business before Memory queries', async () => {
        const findConversation = vi.spyOn(Conversation, 'findOne');
        await expect(asBusinessA(() => ensureConversation(businessB, 'fb_customer')))
            .rejects.toThrow('memory.ensureConversation');
        expect(findConversation).not.toHaveBeenCalled();
    });

    it('stops a mismatched business before RAG customer, knowledge, or product queries', async () => {
        const findProduct = vi.spyOn(Product, 'find');
        await expect(asBusinessA(() => retrieveContext(businessB, 'customer', 'find laptop', [])))
            .rejects.toThrow('rag.retrieveContext');
        expect(findProduct).not.toHaveBeenCalled();
    });

    it('stops a mismatched business before product search tools', async () => {
        const findProduct = vi.spyOn(Product, 'find');
        await expect(asBusinessA(() => matchProductsWithRAG({
            businessId: businessB,
            imageEmbedding: [0.1, 0.2],
        }))).rejects.toThrow('products.matchWithRag');
        expect(findProduct).not.toHaveBeenCalled();
    });

    it('stops a mismatched business before starting an order transaction', async () => {
        const startSession = vi.spyOn(mongoose, 'startSession');
        await expect(asBusinessA(() => createOrderWithStock({
            businessId: businessB,
            customerId: new mongoose.Types.ObjectId(),
            items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1 }],
            shippingAddress: {},
        }))).rejects.toThrow('orders.createWithStock');
        expect(startSession).not.toHaveBeenCalled();
    });

    it('stops a mismatched business before executing any agent action', async () => {
        const updateConversation = vi.spyOn(Conversation, 'updateOne');
        await expect(asBusinessA(() => executeAgentAction({
            businessId: businessB,
            conversationId: 'fb_customer',
            psid: 'customer',
            eventIdentifier: 'event-1',
            response: { message_text: 'handoff', action: 'handoff' },
        }))).rejects.toThrow('agent.executeAction');
        expect(updateConversation).not.toHaveBeenCalled();
    });
});
