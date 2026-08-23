import { Conversation } from '../models/Conversation';
import { assertTenantBusinessId } from '../tenancy/context';
import { createOrder } from './checkout.service';

export interface AgentResponse {
    message_text: string;
    action?: 'create_order' | 'handoff' | 'none' | string;
    action_payload?: Record<string, any>;
    quick_replies?: string[];
    suggested_products?: any[];
    action_result?: { requested: string; confirmed: boolean; reference?: string; error?: string };
}

export function parseAgentResponse(content: unknown): AgentResponse {
    const text = content?.toString() || '';
    try {
        const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        return {
            ...parsed,
            message_text: String(parsed.message_text ?? parsed.content ?? ''),
        };
    } catch {
        return { message_text: text, action: 'none' };
    }
}

export async function executeAgentAction(params: {
    businessId: string;
    conversationId: string;
    psid?: string;
    eventIdentifier: string;
    response: AgentResponse;
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
            items: response.action_payload?.items || [],
            address: response.action_payload?.address,
            idempotencyKey: params.eventIdentifier,
        });
        response.action_result = orderResult.success
            ? { requested: 'create_order', confirmed: true, reference: String(orderResult.orderId) }
            : { requested: 'create_order', confirmed: false, error: orderResult.error };
        response.message_text = orderResult.success
            ? `Order #${orderResult.orderId} was created successfully. Total: ${orderResult.total}`
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
