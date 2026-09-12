import { Conversation } from '../models/Conversation';
import { assertTenantBusinessId } from '../tenancy/context';
import { createOrder } from './checkout.service';
import { normalizeAssistantResponse } from './assistant-response.service';

export interface AgentResponse {
    message_text: string;
    action?: 'create_order' | 'handoff' | 'none' | string;
    action_payload?: Record<string, any>;
    quick_replies?: string[];
    suggested_products?: any[];
    action_result?: { requested: string; confirmed: boolean; reference?: string; error?: string };
}

export function parseAgentResponse(content: unknown): AgentResponse {
    return normalizeAssistantResponse(content) as AgentResponse;
}

export async function executeAgentAction(params: {
    businessId: string;
    conversationId: string;
    psid?: string;
    eventIdentifier: string;
    response: AgentResponse;
    /** Conversation language, so a failure speaks to the customer, not to the log. */
    language?: string;
}) {
    assertTenantBusinessId(params.businessId, 'agent.executeAction');
    const { response } = params;

    if (response.action && response.action !== 'none') {
        const stillAIControlled = await Conversation.findOne({
            conversationId: params.conversationId,
            controlMode: 'AI_ACTIVE',
        }).select('_id').lean();
        if (!stillAIControlled) {
            response.message_text = '';
            response.action_result = {
                requested: response.action,
                confirmed: false,
                error: 'Conversation is controlled by a human',
            };
            return response;
        }
    }

    if (response.action === 'create_order') {
        // The deterministic checkout flow owns ordering. If the model still asks
        // for an order without naming a product, ask the customer in their own
        // language instead of showing them a raw validation error.
        const requestedItems = Array.isArray(response.action_payload?.items) ? response.action_payload!.items : [];
        const usableItems = requestedItems.filter((item: any) => (item?.sku || item?.productId) && Number(item?.quantity) > 0);
        if (!usableItems.length) {
            response.action = 'none';
            response.action_result = { requested: 'create_order', confirmed: false, error: 'No order item was identified' };
            response.message_text = params.language === 'en'
                ? 'Happy to place that order - which product and how many should I put down?'
                : params.language === 'bn'
                    ? 'অবশ্যই অর্ডারটি করে দিচ্ছি—কোন প্রোডাক্ট আর কয়টি নেবেন বলুন।'
                    : 'Obosshoi order ta kore dicchi - kon product ar koyta niben bolun.';
            return response;
        }
        if (!params.psid) {
            response.message_text = 'I could not confirm the order because the customer identity is unavailable. A human can help complete it safely.';
            response.action_result = {
                requested: 'create_order',
                confirmed: false,
                error: 'Customer identity is unavailable',
            };
            return response;
        }
        const orderResult = await createOrder({
            businessId: params.businessId,
            psid: params.psid,
            conversationId: params.conversationId,
            items: usableItems,
            address: response.action_payload?.address,
            idempotencyKey: params.eventIdentifier,
        });
        response.action_result = orderResult.success
            ? { requested: 'create_order', confirmed: true, reference: String(orderResult.orderNumber) }
            : { requested: 'create_order', confirmed: false, error: orderResult.error };
        // The customer-facing reference is the order number, never the internal id.
        response.message_text = orderResult.success
            ? `Your order is confirmed. Order ID: ${orderResult.orderNumber}. Total: ${orderResult.total}. Keep this Order ID for any update.`
            : `I could not confirm the order. ${orderResult.error}. A human can help complete it safely.`;
    }

    if (response.action === 'handoff') {
        const handoffResult = await Conversation.updateOne(
            { conversationId: params.conversationId },
            {
                aiEnabled: false,
                controlMode: 'HUMAN_ACTIVE',
                needsHumanHandoff: true,
                handoffReason: response.action_payload?.reason || 'AI requested human handoff',
            }
        );
        const confirmed = handoffResult.matchedCount === 1;
        response.action_result = confirmed
            ? { requested: 'handoff', confirmed: true }
            : { requested: 'handoff', confirmed: false, error: 'Conversation was not found' };
        response.message_text = confirmed
            ? 'A human agent will continue this conversation.'
            : 'I could not confirm the handoff. Please contact support directly.';
    }

    return response;
}
