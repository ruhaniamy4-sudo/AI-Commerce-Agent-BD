import { Message } from "../models/Message";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { assertTenantBusinessId } from '../tenancy/context';

export async function loadConversationHistory(businessId: string, conversationId: string): Promise<BaseMessage[]> {
    assertTenantBusinessId(businessId, 'memory.loadHistory');
    const messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .lean();

    return messages.map((m: any) => {
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
}
