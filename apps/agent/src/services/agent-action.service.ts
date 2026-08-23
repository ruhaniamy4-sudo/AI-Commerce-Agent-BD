import { Conversation } from '../models/Conversation';
import { assertTenantBusinessId } from '../tenancy/context';
import { createOrder } from './checkout.service';

export interface AgentResponse {
    message_text: string;
    action?: 'create_order' | 'handoff' | 'none' | string;
    action_payload?: Record<string, any>;
    quick_replies?: string[];
    suggested_products?: any[];
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
    response: AgentResponse;
}) {
    assertTenantBusinessId(params.businessId, 'agent.executeAction');
    const { response } = params;

    if (response.action === 'create_order') {
        if (!params.psid) {
            response.message_text += '\n\nI need a customer identity before I can create this order.';
            return response;
        }
        const orderResult = await createOrder({
            businessId: params.businessId,
            psid: params.psid,
            items: response.action_payload?.items || [],
            address: response.action_payload?.address,
        });
        response.message_text += orderResult.success
            ? `\n\nOrder #${orderResult.orderId} created successfully! Total: ${orderResult.total}`
            : `\n\nFailed to create order: ${orderResult.error}`;
    }

    if (response.action === 'handoff') {
        await Conversation.updateOne(
            { conversationId: params.conversationId },
            {
                aiEnabled: false,
                needsHumanHandoff: true,
                handoffReason: response.action_payload?.reason || 'AI requested human handoff',
            }
        );
    }

    return response;
}
