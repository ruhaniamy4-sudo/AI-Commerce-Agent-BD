import { Conversation } from '../models/Conversation';
import { assertTenantBusinessId } from '../tenancy/context';

export async function recordConversationTurn(businessId: string, conversationId: string, mode: 'zero_llm'|'llm_assisted', memory?: Record<string, unknown>) {
    assertTenantBusinessId(businessId, 'conversation.turnMetrics');
    const increments = mode === 'zero_llm'
        ? { 'metadata.turnMetrics.zeroLlmResponses': 1 }
        : { 'metadata.turnMetrics.llmAssistedResponses': 1 };
    await Conversation.updateOne({ businessId, conversationId }, {
        $inc: increments,
        $set: {
            'metadata.turnMetrics.updatedAt': new Date(),
            ...(memory ? Object.fromEntries(Object.entries(memory).map(([key, value]) => [`metadata.entityState.${key}`, value])) : {}),
        },
    });
}
