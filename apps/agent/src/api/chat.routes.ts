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

const router = Router();

router.post('/', async (req, res) => {
    try {
        const { businessId } = requireTenantContext();
        const { message, conversationId, imageUrl } = req.body;
        const convId = conversationId || uuid();

        if (!message && !imageUrl) {
            return res.status(400).json({ error: 'Message or imageUrl is required' });
        }

        // ensure conversation exists
        const conversation = await ensureConversation(businessId, convId);

        // save human message
        await saveMessage(businessId, convId, 'user', message || '', imageUrl);

        if (conversation && (!conversation.aiEnabled || conversation.needsHumanHandoff)) {
            return res.status(202).json({
                conversationId: convId,
                reply: null,
                needsHumanHandoff: conversation.needsHumanHandoff,
            });
        }

        // Process image if provided (RAG + Vision context)
        if (imageUrl) {
            try {
                await handleImageInput(businessId, convId, imageUrl);
            } catch (error) {
                console.error('Error processing image in chat route:', error);
            }
        }

        // mark human activity
        await updateLastHumanActivity();

        const agentStatus = await getAgentStatus();

        // load full history for context
        const history = await loadConversationHistory(businessId, convId);

        const state = await agentGraph.invoke({
            businessId,
            conversationId: convId,
            agentStatus: agentStatus as AgentState['agentStatus'],
            lastHumanActivity: Date.now(),
            messages: history,
            psid: conversation?.psid,
        });

        const lastMessage = state.messages[state.messages.length - 1];
        const agentResponse = parseAgentResponse(lastMessage?.content);
        await executeAgentAction({
            businessId,
            conversationId: convId,
            psid: conversation?.psid,
            response: agentResponse,
        });
        const reply = agentResponse.message_text;

        if (reply) {
            await saveMessage(businessId, convId, 'assistant', reply);
        }

        res.json({
            conversationId: convId,
            reply,
        });
    } catch (error) {
        await logError('CHAT_API_ERROR', error, { body: req.body });
        console.error('Error in chat route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
