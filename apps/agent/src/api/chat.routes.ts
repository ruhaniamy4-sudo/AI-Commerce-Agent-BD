import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { agentGraph } from '../agent/graph';
import { AgentState } from '../agent/state';
import {
    getAgentStatus,
    updateLastHumanActivity,
} from '../services/agentManager';
import { logError } from '../services/error.service';
import { loadConversationHistory } from '../services/history.service';
import { ensureConversation, saveMessage } from '../services/memory.service';
import { handleImageInput } from '../services/image-processor.service';
import { requireTenantContext } from '../tenancy/context';
import { executeAgentAction, parseAgentResponse } from '../services/agent-action.service';
import { checkpointInboundEvent, claimInboundEvent, completeInboundEvent, registerInboundEvent, releaseInboundEvent } from '../services/inbound-idempotency.service';
import { invokeIfAIActive, isAIActive } from '../services/conversation-control.service';
import { getDeterministicResponse } from '../services/deterministic-response.service';

const router = Router();

router.post('/', async (req, res) => {
    let processingToken: string | undefined;
    let eventIdentifier: string | undefined;
    try {
        const { businessId } = requireTenantContext();
        const { message, conversationId, imageUrl } = req.body;
        const convId = conversationId || uuid();
        eventIdentifier = String(req.headers['idempotency-key'] || req.body.messageId || uuid());

        if (!message && !imageUrl) {
            return res.status(400).json({ error: 'Message or imageUrl is required' });
        }

        await registerInboundEvent({
            eventId: eventIdentifier,
            source: 'web',
            psid: convId,
            payload: { message, conversationId: convId, hasImage: Boolean(imageUrl) },
        });
        const claim = await claimInboundEvent(eventIdentifier);
        if (!claim.claimed) {
            if (claim.event?.processed && claim.event.response) return res.json(claim.event.response);
            return res.status(202).json({ conversationId: convId, messageId: eventIdentifier, processing: true });
        }
        processingToken = claim.processingToken;

        // ensure conversation exists
        const conversation = await ensureConversation(businessId, convId);

        // save human message
        await saveMessage(businessId, convId, 'user', message || '', imageUrl, {
            messageId: eventIdentifier,
            platform: 'web',
        });

        if (!isAIActive(conversation)) {
            const response = {
                conversationId: convId,
                messageId: eventIdentifier,
                reply: null,
                controller: 'HUMAN_ACTIVE',
            };
            await completeInboundEvent(eventIdentifier, processingToken, response);
            return res.status(202).json(response);
        }

        // mark human activity
        await updateLastHumanActivity();

        const agentStatus = await getAgentStatus();
        if (agentStatus !== 'active') {
            const response = { conversationId: convId, messageId: eventIdentifier, reply: null, agentStatus };
            await completeInboundEvent(eventIdentifier, processingToken, response);
            return res.status(202).json(response);
        }

        const deterministicReply = message
            ? await getDeterministicResponse(businessId, String(message), { psid: conversation?.psid })
            : null;
        if (deterministicReply) {
            await saveMessage(businessId, convId, 'assistant', deterministicReply, undefined, {
                messageId: `${eventIdentifier}:assistant`, platform: 'web',
            });
            const response = { conversationId: convId, messageId: eventIdentifier, reply: deterministicReply };
            await completeInboundEvent(eventIdentifier, processingToken, response);
            return res.json(response);
        }

        // Process images only after cheap deterministic checks and a fresh control-state check.
        if (imageUrl) {
            try {
                const imageResult = await invokeIfAIActive(convId, () =>
                    handleImageInput(businessId, convId, imageUrl, eventIdentifier)
                );
                if (!imageResult) {
                    const response = {
                        conversationId: convId,
                        messageId: eventIdentifier,
                        reply: null,
                        controller: 'HUMAN_ACTIVE',
                    };
                    await completeInboundEvent(eventIdentifier, processingToken, response);
                    return res.status(202).json(response);
                }
            } catch (error) {
                console.error('Error processing image in chat route:', error);
            }
        }

        let agentResponse = (claim.event.response as any)?.aiResponse;
        if (!agentResponse) {
            const history = await loadConversationHistory(businessId, convId);
            const state = await invokeIfAIActive(convId, () => agentGraph.invoke({
                businessId,
                eventIdentifier,
                conversationId: convId,
                agentStatus: agentStatus as AgentState['agentStatus'],
                lastHumanActivity: Date.now(),
                messages: history,
                psid: conversation?.psid,
            }));
            if (!state) {
                const response = {
                    conversationId: convId,
                    messageId: eventIdentifier,
                    reply: null,
                    controller: 'HUMAN_ACTIVE',
                };
                await completeInboundEvent(eventIdentifier, processingToken, response);
                return res.status(202).json(response);
            }
            const lastMessage = state.messages[state.messages.length - 1];
            agentResponse = parseAgentResponse(lastMessage?.content);
            await checkpointInboundEvent(eventIdentifier, processingToken, { aiResponse: agentResponse });
        }
        await executeAgentAction({
            businessId,
            conversationId: convId,
            psid: conversation?.psid,
            response: agentResponse,
            eventIdentifier,
        });
        const reply = agentResponse.message_text;

        if (reply) {
            await saveMessage(businessId, convId, 'assistant', reply, undefined, {
                messageId: `${eventIdentifier}:assistant`, platform: 'web',
            });
        }

        const response = {
            conversationId: convId,
            messageId: eventIdentifier,
            reply,
        };
        await completeInboundEvent(eventIdentifier, processingToken, response);
        res.json(response);
    } catch (error) {
        if (eventIdentifier && processingToken) {
            await releaseInboundEvent(eventIdentifier, processingToken, error instanceof Error ? error.message : 'Unknown error');
        }
        await logError('CHAT_API_ERROR', error, { body: req.body });
        console.error('Error in chat route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
