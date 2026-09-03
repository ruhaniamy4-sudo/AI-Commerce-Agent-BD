import { v4 as uuid } from 'uuid';
import { agentGraph } from '../agent/graph';
import { AgentState } from '../agent/state';
import { getAgentStatus, updateLastHumanActivity } from './agentManager';
import { loadConversationHistory } from './history.service';
import { ensureConversation, saveMessage } from './memory.service';
import { handleImageInput } from './image-processor.service';
import { executeAgentAction, parseAgentResponse } from './agent-action.service';
import { checkpointInboundEvent, claimInboundEvent, completeInboundEvent, registerInboundEvent, releaseInboundEvent } from './inbound-idempotency.service';
import { invokeIfAIActive, isAIActive } from './conversation-control.service';
import { getDeterministicResponse } from './deterministic-response.service';
import { detectConversationLanguage, shouldHandoffToHuman } from './conversation-intelligence.service';
import { evaluateBusinessAIAccess } from './business-ai-access.service';
import { recordConversationTurn } from './turn-metrics.service';
import { classifyLightweightIntent } from './turn-routing.service';
import { computeSalesSignals } from './sales-intelligence.service';
import { Conversation } from '../models/Conversation';


export interface ChatTurnInput {
    businessId: string;
    message?: string;
    conversationId?: string;
    imageUrl?: string;
    eventIdentifier?: string;
    source?: 'web' | 'test';
}

export async function processChatTurn(input: ChatTurnInput) {
    const convId = input.conversationId || uuid();
    const eventIdentifier = input.eventIdentifier || uuid();
    const source = input.source || 'web';
    await registerInboundEvent({ eventId: eventIdentifier, source, psid: convId, payload: { message: input.message, conversationId: convId, hasImage: Boolean(input.imageUrl), testMode: source === 'test' } });
    const claim = await claimInboundEvent(eventIdentifier);
    if (!claim.claimed) {
        if (claim.event?.processed && claim.event.response) return { status: 200, body: claim.event.response };
        return { status: 202, body: { conversationId: convId, messageId: eventIdentifier, processing: true } };
    }
    const processingToken = claim.processingToken;
    try {
    const conversation = await ensureConversation(input.businessId, convId);
    await saveMessage(input.businessId, convId, 'user', input.message || '', input.imageUrl, { messageId: eventIdentifier, platform: source });
    const entitlement = await evaluateBusinessAIAccess(input.businessId);
    if (!entitlement.allowed) {
        const body = { conversationId: convId, messageId: eventIdentifier, reply: null, aiAccess: entitlement.reason };
        await completeInboundEvent(eventIdentifier, processingToken, body);
        return { status: 202, body };
    }
    if (!isAIActive(conversation)) {
        const body = { conversationId: convId, messageId: eventIdentifier, reply: null, controller: 'HUMAN_ACTIVE' };
        await completeInboundEvent(eventIdentifier, processingToken, body);
        return { status: 202, body };
    }
    await updateLastHumanActivity();
    const agentStatus = await getAgentStatus();
    if (agentStatus !== 'active') {
        const body = { conversationId: convId, messageId: eventIdentifier, reply: null, agentStatus };
        await completeInboundEvent(eventIdentifier, processingToken, body);
        return { status: 202, body };
    }
    const handoff = input.message ? shouldHandoffToHuman(input.message) : { required: false };
    if (handoff.required) {
        const language = detectConversationLanguage(input.message || '');
        const message_text = language === 'bn' ? 'একজন মানব প্রতিনিধি এই কথোপকথনটি চালিয়ে যাবেন।' : language === 'banglish' || language === 'mixed' ? 'একজন human agent এই conversationটা continue করবেন।' : 'A human agent will continue this conversation.';
        const response = { message_text, action: 'handoff' as const, action_payload: { reason: handoff.reason } };
        await executeAgentAction({ businessId: input.businessId, conversationId: convId, psid: conversation?.psid, response, eventIdentifier });
        response.message_text = message_text;
        await saveMessage(input.businessId, convId, 'assistant', response.message_text, undefined, { messageId: `${eventIdentifier}:assistant`, platform: source });
        const body = { conversationId: convId, messageId: eventIdentifier, reply: response.message_text, controller: 'HUMAN_ACTIVE' };
        await completeInboundEvent(eventIdentifier, processingToken, body);
        return { status: 200, body };
    }

    // ── Sales signals: pure synchronous, zero LLM call, zero DB call ──────────
    const messageText = input.message || '';
    const routedIntent = classifyLightweightIntent(messageText);
    const currentSalesStage = (conversation as any).salesStage;
    const hasActiveProduct = Boolean((conversation as any)?.metadata?.entityState?.activeProductId);
    const salesSignals = computeSalesSignals(messageText, routedIntent, currentSalesStage, hasActiveProduct);
    // ──────────────────────────────────────────────────────────────────────────

    const deterministicResult = input.message ? await getDeterministicResponse(input.businessId, input.message, { psid: conversation?.psid, conversationId: convId }) : null;
    if (deterministicResult) {
        const deterministicReply = typeof deterministicResult === 'string' ? deterministicResult : deterministicResult.message_text;
        const products = typeof deterministicResult === 'string' ? [] : deterministicResult.suggested_products || [];
        // Persist salesStage alongside the existing turn metrics — single combined write
        await Promise.all([
            saveMessage(input.businessId, convId, 'assistant', deterministicReply, undefined, { messageId: `${eventIdentifier}:assistant`, platform: source, products }),
            recordConversationTurn(input.businessId, convId, 'zero_llm', typeof deterministicResult === 'string' ? undefined : deterministicResult.memory),
            Conversation.updateOne(
                { businessId: input.businessId, conversationId: convId },
                { $set: { salesStage: salesSignals.salesStage, 'metadata.salesIntelligence': { intentScore: salesSignals.intentScore, nextBestAction: salesSignals.nextBestAction, updatedAt: new Date() } } },
            ),
        ]);
        const body = { conversationId: convId, messageId: eventIdentifier, reply: deterministicReply, products, deterministic: true, llmCalls: 0, salesStage: salesSignals.salesStage };
        await completeInboundEvent(eventIdentifier, processingToken, body);
        return { status: 200, body };
    }
    if (input.imageUrl) {
        try {
            const imageResult = await invokeIfAIActive(convId, () => handleImageInput(input.businessId, convId, input.imageUrl!, eventIdentifier));
            if (!imageResult) {
                const body = { conversationId: convId, messageId: eventIdentifier, reply: null, controller: 'HUMAN_ACTIVE' };
                await completeInboundEvent(eventIdentifier, processingToken, body);
                return { status: 202, body };
            }
            const products = imageResult.matchedProducts.slice(0, 3).map((product: any) => ({ id: String(product._id), name: product.name, price: product.salePrice ?? product.basePrice, currency: product.currency || 'BDT', availability: product.availability, stock: product.stock, image: product.images?.[0] }));
            const reply = products.length ? `I found ${products.length} visually similar product${products.length === 1 ? '' : 's'}.` : 'I could not confirm a catalog match from this image.';
            await Promise.all([
                saveMessage(input.businessId, convId, 'assistant', reply, undefined, { messageId: `${eventIdentifier}:assistant`, platform: source }),
                recordConversationTurn(input.businessId, convId, 'zero_llm', products.length ? { activeProductId: products[0].id, recentProductIds: products.map((product: any) => product.id) } : undefined),
                Conversation.updateOne(
                    { businessId: input.businessId, conversationId: convId },
                    { $set: { salesStage: salesSignals.salesStage, 'metadata.salesIntelligence': { intentScore: salesSignals.intentScore, nextBestAction: salesSignals.nextBestAction, updatedAt: new Date() } } },
                ),
            ]);
            const body = { conversationId: convId, messageId: eventIdentifier, reply, products, deterministic: true, llmCalls: 0, nonGenerationAiCalls: 2, salesStage: salesSignals.salesStage };
            await completeInboundEvent(eventIdentifier, processingToken, body);
            return { status: 200, body };
        } catch (error) {
            console.error('Error processing image in chat pipeline:', error);
        }
    }
    let agentResponse = (claim.event.response as any)?.aiResponse;
    if (!agentResponse) {
        const history = await loadConversationHistory(input.businessId, convId);
        const state = await invokeIfAIActive(convId, () => agentGraph.invoke({
            businessId: input.businessId, eventIdentifier, conversationId: convId,
            agentStatus: agentStatus as AgentState['agentStatus'], lastHumanActivity: Date.now(), messages: history, psid: conversation?.psid,
        }));
        if (!state) {
            const body = { conversationId: convId, messageId: eventIdentifier, reply: null, controller: 'HUMAN_ACTIVE' };
            await completeInboundEvent(eventIdentifier, processingToken, body);
            return { status: 202, body };
        }
        agentResponse = parseAgentResponse(state.messages[state.messages.length - 1]?.content);
        await checkpointInboundEvent(eventIdentifier, processingToken, { aiResponse: agentResponse });
    }
    await executeAgentAction({ businessId: input.businessId, conversationId: convId, psid: conversation?.psid, response: agentResponse, eventIdentifier });
    const reply = agentResponse.message_text;
    if (reply) await saveMessage(input.businessId, convId, 'assistant', reply, undefined, { messageId: `${eventIdentifier}:assistant`, platform: source, products: agentResponse.suggested_products || [] });

    // Persist salesStage on the LLM path (agent.ts already wrote it, but we sync here if agent was skipped via checkpoint)
    const isOrderAction = agentResponse.action === 'create_order';
    const conversionUpdate: Record<string, unknown> = {
        salesStage: isOrderAction ? 'ORDERED' : salesSignals.salesStage,
        'metadata.salesIntelligence': { intentScore: salesSignals.intentScore, nextBestAction: salesSignals.nextBestAction, updatedAt: new Date() },
    };
    if (isOrderAction) {
        conversionUpdate['conversionOutcome.convertedAt'] = new Date();
        conversionUpdate['conversionOutcome.conversionType'] = 'AI_ONLY';
        if (agentResponse.action_payload?.orderId) conversionUpdate['conversionOutcome.orderId'] = agentResponse.action_payload.orderId;
    }
    await Promise.all([
        recordConversationTurn(input.businessId, convId, 'llm_assisted'),
        Conversation.updateOne({ businessId: input.businessId, conversationId: convId }, { $set: conversionUpdate }),
    ]);
    const body = { conversationId: convId, messageId: eventIdentifier, reply, products: agentResponse.suggested_products || [], deterministic: false, llmCalls: 1, salesStage: isOrderAction ? 'ORDERED' : salesSignals.salesStage };
    await completeInboundEvent(eventIdentifier, processingToken, body);
    return { status: 200, body };
    } catch (error) {
        await releaseInboundEvent(eventIdentifier, processingToken, error instanceof Error ? error.message : 'Unknown error');
        throw error;
    }
}

