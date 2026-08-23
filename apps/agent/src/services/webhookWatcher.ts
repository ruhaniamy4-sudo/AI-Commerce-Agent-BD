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
import { assertTenantBusinessId } from '../tenancy/context';
import { executeAgentAction, parseAgentResponse } from './agent-action.service';
import { checkpointInboundEvent, claimInboundEvent, completeInboundEvent, releaseInboundEvent } from './inbound-idempotency.service';
import { invokeIfAIActive, isAIActive } from './conversation-control.service';
import { getDeterministicResponse } from './deterministic-response.service';

export const processWebhookEvent = async (data: any) => {
    const { businessId, eventId, psid, message, attachments = [], pageId } = data;
    assertTenantBusinessId(businessId, 'facebook.webhookWorker');

    const claim = await claimInboundEvent(eventId);
    if (!claim.claimed) return;
    const processingToken = claim.processingToken;

    try {
        console.log(`Processing event for PSID: ${psid}`);

        const convId = `fb_${psid}`;
        const conversation = await ensureConversation(businessId, convId);

        const messageText = message || (attachments.length ? '[Attachment]' : '');
        await saveMessage(businessId, convId, 'user', messageText, undefined, {
            messageId: eventId, platform: 'facebook',
        });
        await updateLastHumanActivity();

        if (!isAIActive(conversation)) {
            await completeInboundEvent(eventId, processingToken, { controller: 'HUMAN_ACTIVE' });
            return;
        }

        const agentStatus = await getAgentStatus();
        if (agentStatus !== 'active') {
            await completeInboundEvent(eventId, processingToken, { agentStatus });
            return;
        }

        const deterministicReply = message
            ? await getDeterministicResponse(businessId, String(message), { psid })
            : null;
        if (deterministicReply) {
            await sendMessage(psid, deterministicReply, pageId);
            await saveMessage(businessId, convId, 'assistant', deterministicReply, undefined, {
                messageId: `${eventId}:assistant`, platform: 'facebook',
            });
            await completeInboundEvent(eventId, processingToken, { reply: deterministicReply });
            return;
        }

        // Image analysis is itself an AI path, so re-check control immediately before it.
        const imageAttachment = attachments.find((att: any) => att.type === 'image');
        if (imageAttachment && imageAttachment.payload?.url) {
            try {
                const imageResult = await invokeIfAIActive(convId, () => handleImageInput(
                    businessId, convId, imageAttachment.payload.url, eventId
                ));
                if (!imageResult) {
                    await completeInboundEvent(eventId, processingToken, { controller: 'HUMAN_ACTIVE' });
                    return;
                }
                const { matchedProducts, visionResult } = imageResult;
                const responseText = matchedProducts.length > 0
                    ? `I can see this is a ${visionResult.category || 'product'}! I found these visually similar matches:\n\n${formatProductsForResponse(matchedProducts)}\n\nWould you like to know more about any of these?`
                    : `I can see the ${visionResult.category || 'product'} you shared! We don't have exact matches right now, but I can help you find similar items. What are you looking for?`;

                await sendMessage(psid, responseText, pageId);
                await saveMessage(businessId, convId, 'assistant', responseText, undefined, {
                    messageId: `${eventId}:assistant`, platform: 'facebook',
                });
                await completeInboundEvent(eventId, processingToken, { reply: responseText });
                return;
            } catch (visionError) {
                console.error('Error processing image attachment:', visionError);
            }
        }

        let aiResponse = (claim.event.response as any)?.aiResponse;
        if (!aiResponse) {
            const history = await loadConversationHistory(businessId, convId);
            const state = await invokeIfAIActive(convId, () => agentGraph.invoke({
                businessId,
                eventIdentifier: eventId,
                conversationId: convId,
                agentStatus: agentStatus as AgentState['agentStatus'],
                lastHumanActivity: Date.now(),
                messages: history,
                psid,
            }));
            if (!state) {
                await completeInboundEvent(eventId, processingToken, { controller: 'HUMAN_ACTIVE' });
                return;
            }
            const lastMessage = state.messages[state.messages.length - 1];
            aiResponse = parseAgentResponse(lastMessage.content);
            await checkpointInboundEvent(eventId, processingToken, { aiResponse });
        }

        // 1. Handle Actions
        await executeAgentAction({ businessId, conversationId: convId, psid, response: aiResponse, eventIdentifier: eventId });

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
        await saveMessage(businessId, convId, 'assistant', aiResponse.message_text, undefined, {
            messageId: `${eventId}:assistant`, platform: 'facebook',
        });

        await completeInboundEvent(eventId, processingToken, { reply: aiResponse.message_text });

    } catch (error: any) {
        console.error('Error processing webhook event:', error);
        await releaseInboundEvent(eventId, processingToken, error.message);
        throw error;
    }
};
