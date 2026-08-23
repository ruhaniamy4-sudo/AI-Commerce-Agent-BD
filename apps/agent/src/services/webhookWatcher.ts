import { WebhookEvent } from '../models/WebhookEvent';
import { agentGraph } from '../agent/graph';
import { AgentState } from '../agent/state';
import {
    getAgentStatus,
    updateLastHumanActivity,
} from './agentManager';
import { loadConversationHistory } from './history.service';
import { ensureConversation, saveMessage } from './memory.service';
import {
    sendMessage,
    sendQuickReplies,
    sendGenericTemplate
} from './facebook.service';
import { logError } from './error.service';
import { handleImageInput } from './image-processor.service';
import { formatProductsForResponse } from './product-matcher.service';
import { Conversation } from '../models/Conversation';
import { assertTenantBusinessId } from '../tenancy/context';
import { executeAgentAction, parseAgentResponse } from './agent-action.service';

export const processWebhookEvent = async (data: any) => {
    const { businessId, eventId, psid, message, attachments = [], pageId } = data;
    assertTenantBusinessId(businessId, 'facebook.webhookWorker');

    const existingEvent = await WebhookEvent.findOne({ eventId, processed: true });
    if (existingEvent) {
        console.log(`Event ${eventId} already processed. Skipping.`);
        return;
    }

    try {
        console.log(`Processing event for PSID: ${psid}`);

        const agentStatus = await getAgentStatus();
        if (agentStatus === 'stopped') {
            return;
        }

        const convId = `fb_${psid}`;
        await ensureConversation(businessId, convId);

        // Check for image attachments and process them
        const imageAttachment = attachments.find((att: any) => att.type === 'image');
        let imageAnalyzed = false;

        if (imageAttachment && imageAttachment.payload?.url) {
            try {
                const { matchedProducts, visionResult } = await handleImageInput(businessId, convId, imageAttachment.payload.url);

                // If we found matching products, send them immediately (Facebook specific behavior)
                if (matchedProducts.length > 0) {
                    const productList = formatProductsForResponse(matchedProducts);
                    const responseText = `I can see this is a ${visionResult.category || 'product'}! I found these visually similar matches:\n\n${productList}\n\nWould you like to know more about any of these?`;

                    await sendMessage(psid, responseText, pageId);
                    imageAnalyzed = true;
                } else {
                    // No good matches
                    await sendMessage(psid, `I can see the ${visionResult.category || 'product'} you shared! We don't have exact matches right now, but I can help you find similar items. What are you looking for?`, pageId);
                    imageAnalyzed = true;
                }
            } catch (visionError) {
                console.error('Error processing image attachment:', visionError);
            }
        }

        // Save the user message
        const messageText = message || (imageAttachment ? '[Image]' : '');
        await saveMessage(businessId, convId, 'user', messageText);
        await updateLastHumanActivity();

        // Load conversation with image context
        const conversation = await Conversation.findOne({ conversationId: convId });
        if (conversation && (!conversation.aiEnabled || conversation.needsHumanHandoff)) {
            await WebhookEvent.updateOne(
                { eventId },
                { processed: true, processedAt: new Date() }
            );
            return;
        }
        const history = await loadConversationHistory(businessId, convId);

        // Invoke AI Agent
        const state = await agentGraph.invoke({
            businessId,
            conversationId: convId,
            agentStatus: agentStatus as AgentState['agentStatus'],
            lastHumanActivity: Date.now(),
            messages: history,
            psid: psid // Pass PSID for context retrieval
        });

        // Get reply and Parse JSON
        const lastMessage = state.messages[state.messages.length - 1];
        const aiResponse = parseAgentResponse(lastMessage.content);

        // 1. Handle Actions
        await executeAgentAction({ businessId, conversationId: convId, psid, response: aiResponse });

        // 2. Send Message (with Quick Replies or Templates)
        if (aiResponse.suggested_products && aiResponse.suggested_products.length > 0) {
            // Send Carousel
            const elements = aiResponse.suggested_products.map((p: any) => ({
                title: p.name,
                subtitle: p.price ? `Price: ${p.price}` : '',
                image_url: p.image_url || 'https://via.placeholder.com/150',
                buttons: [
                    { type: 'postback', title: 'Buy Now', payload: `BUY_${p.sku}` }
                ]
            }));
            await sendGenericTemplate(psid, elements, pageId);

            // Send text separately if needed
            if (aiResponse.message_text) {
                await sendMessage(psid, aiResponse.message_text, pageId);
            }

        } else if (aiResponse.quick_replies && aiResponse.quick_replies.length > 0) {
            // Send Quick Replies
            const replies = aiResponse.quick_replies.map((r: string) => ({
                title: r,
                payload: r.toUpperCase().replace(/\s/g, '_')
            }));
            await sendQuickReplies(psid, aiResponse.message_text, replies, pageId);

        } else {
            // Send Simple Text
            if (aiResponse.message_text) {
                await sendMessage(psid, aiResponse.message_text, pageId);
            }
        }

        // Save Assistant Reply - Store the text to keep conversation history compatible
        // Ideally we should store the full JSON structure in metadata, but for RAG text is input
        await saveMessage(businessId, convId, 'assistant', aiResponse.message_text);

        await WebhookEvent.updateOne(
            { eventId },
            { processed: true, processedAt: new Date() }
        );

    } catch (error: any) {
        console.error('Error processing webhook event:', error);
        await WebhookEvent.updateOne(
            { eventId },
            { error: error.message }
        );
        throw error;
    }
};
