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

const router = Router();

router.post('/', async (req, res) => {
    try {
        const { message, conversationId, imageUrl } = req.body;
        const convId = conversationId || uuid();

        if (!message && !imageUrl) {
            return res.status(400).json({ error: 'Message or imageUrl is required' });
        }

        // ensure conversation exists
        await ensureConversation(convId);

        // save human message
        await saveMessage(convId, 'user', message || '', imageUrl);

        // Process image if provided (RAG + Vision context)
        if (imageUrl) {
            try {
                await handleImageInput(convId, imageUrl);
            } catch (error) {
                console.error('Error processing image in chat route:', error);
            }
        }

        // mark human activity
        await updateLastHumanActivity();

        const agentStatus = await getAgentStatus();

        // load full history for context
        const history = await loadConversationHistory(convId);

        const state = await agentGraph.invoke({
            conversationId: convId,
            agentStatus: agentStatus as AgentState['agentStatus'],
            lastHumanActivity: Date.now(),
            messages: history,
        });

        const lastMessage = state.messages[state.messages.length - 1];
        let reply = lastMessage?.content;

        if (lastMessage) {
            if (typeof lastMessage.content === 'string') {
                reply = lastMessage.content;
            } else if (Array.isArray(lastMessage.content)) {
                reply = lastMessage.content
                    .map((m: any) => ('text' in m ? m.text : ''))
                    .join('');
            }
        }

        if (reply) {
            await saveMessage(convId, 'assistant', reply as string);
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
