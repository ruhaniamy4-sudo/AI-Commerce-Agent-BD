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
    const deterministicReply = input.message ? await getDeterministicResponse(input.businessId, input.message, { psid: conversation?.psid }) : null;
    if (deterministicReply) {
        await saveMessage(input.businessId, convId, 'assistant', deterministicReply, undefined, { messageId: `${eventIdentifier}:assistant`, platform: source });
        const body = { conversationId: convId, messageId: eventIdentifier, reply: deterministicReply, deterministic: true };
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
    if (reply) await saveMessage(input.businessId, convId, 'assistant', reply, undefined, { messageId: `${eventIdentifier}:assistant`, platform: source });
    const body = { conversationId: convId, messageId: eventIdentifier, reply };
    await completeInboundEvent(eventIdentifier, processingToken, body);
    return { status: 200, body };
    } catch (error) {
        await releaseInboundEvent(eventIdentifier, processingToken, error instanceof Error ? error.message : 'Unknown error');
        throw error;
    }
}
