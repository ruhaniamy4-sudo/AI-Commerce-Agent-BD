import { Message } from "../models/Message";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { assertTenantBusinessId } from '../tenancy/context';
import { SystemMessage } from '@langchain/core/messages';
import { Conversation } from '../models/Conversation';
import { getAIRecentMessageLimit } from './ai-config';

export async function loadConversationHistory(businessId: string, conversationId: string): Promise<BaseMessage[]> {
    assertTenantBusinessId(businessId, 'memory.loadHistory');
    const limit = getAIRecentMessageLimit();
    const [conversation, messagesDescending] = await Promise.all([
        Conversation.findOne({ conversationId }).select('summary').lean(),
        Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);
    const messages = messagesDescending.reverse();

    const history: BaseMessage[] = messages.map((m: any) => {
        if (m.role === "assistant") {
            return new AIMessage(m.content);
        }

        // Handle multimodal content (text + image)
        if (m.contentType === 'image' && m.attachments?.length > 0) {
            const content: any[] = [
                { type: 'text', text: m.content || 'Attached image' }
            ];

            m.attachments.forEach((att: any) => {
                content.push({
                    type: 'image_url',
                    image_url: { url: att.url }
                });
            });

            return new HumanMessage({ content });
        }

        return new HumanMessage(m.content);
    });
    if (conversation?.summary) {
        history.unshift(new SystemMessage(`Conversation summary (facts only):\n${conversation.summary}`));
    }
    return history;
}
