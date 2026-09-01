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
import { recordConversationTurn } from './turn-metrics.service';
import { containsPaymentCredential, facebookConversationId, isOptOutMessage, recordMetaInbound } from './meta-policy.service';
import { MediaStorageError, persistConversationImage } from './media-storage.service';

export const processWebhookEvent = async (data: any) => {
    const { businessId, eventId, psid, message, attachments = [], pageId, channelAIEnabled = true } = data;
    assertTenantBusinessId(businessId, 'facebook.webhookWorker');

    const claim = await claimInboundEvent(eventId);
    if (!claim.claimed) return;
    const processingToken = claim.processingToken;

    try {
        console.log(`Processing event for PSID: ${psid}`);

        const convId = facebookConversationId(pageId, psid);
        const conversation = await ensureConversation(businessId, convId, { senderId: psid, pageId });

        const paymentSensitive = containsPaymentCredential(message || '');
        const imageAttachment = attachments.find((att: any) => att.type === 'image' && att.payload?.url);
        let imageMedia; let mediaError: unknown;
        if (!paymentSensitive && imageAttachment?.payload?.url) {
            try { imageMedia = await persistConversationImage({ businessId, url: imageAttachment.payload.url, source: 'FACEBOOK', conversationId: convId, messageId: eventId }); }
            catch (error) { mediaError = error; }
        }
        const messageText = paymentSensitive ? '[Sensitive payment credential removed]' : message || (attachments.length ? '[Attachment]' : '');
        await saveMessage(businessId, convId, 'user', messageText, imageMedia?.secureUrl, {
            messageId: eventId, platform: 'facebook', media: imageMedia,
        });
        await recordMetaInbound(businessId, pageId, psid, convId, message || '');
        await updateLastHumanActivity();

        if (isOptOutMessage(message || '')) {
            await completeInboundEvent(eventId, processingToken, { policy: 'OPTED_OUT' });
            return;
        }

        if (!channelAIEnabled) {
            await completeInboundEvent(eventId, processingToken, { controller: 'CHANNEL_AI_PAUSED' });
            return;
        }

        const deliveries = (claim.event.response as any)?.deliveries || {};
        const sendOnce = async (key: string, work: () => Promise<any>) => {
            if (deliveries[key]?.status === 'SENDING' || deliveries[key]?.status === 'SENT') return deliveries[key]?.result;
            deliveries[key] = { status: 'SENDING', at: new Date().toISOString() };
            await checkpointInboundEvent(eventId, processingToken, { deliveries });
            const result = await work();
            deliveries[key] = { status: 'SENT', at: new Date().toISOString(), result: { messageId: result?.message_id } };
            await checkpointInboundEvent(eventId, processingToken, { deliveries });
            return result;
        };

        if (paymentSensitive) {
            const safeReply = 'For your security, please do not send card numbers, PINs, CVVs, OTPs, or bank credentials here. Use the merchant’s approved payment link or contact support.';
            await sendOnce('payment-safety', () => sendMessage(psid, safeReply, pageId));
            await saveMessage(businessId, convId, 'assistant', safeReply, undefined, { messageId: `${eventId}:assistant`, platform: 'facebook' });
            await completeInboundEvent(eventId, processingToken, { policy: 'PAYMENT_CREDENTIAL_BLOCKED', reply: safeReply, deliveries });
            return;
        }

        if (mediaError) {
            const safeReply = mediaError instanceof MediaStorageError && mediaError.code === 'NOT_CONFIGURED'
                ? 'Image storage is temporarily unavailable. Please try again later or send the product name.'
                : 'I could not securely read that image. Please send a JPG, PNG, WebP, GIF, or AVIF image under 8 MB.';
            await sendOnce('image-storage-error', () => sendMessage(psid, safeReply, pageId));
            await saveMessage(businessId, convId, 'assistant', safeReply, undefined, { messageId: `${eventId}:assistant`, platform: 'facebook' });
            await completeInboundEvent(eventId, processingToken, { reply: safeReply, mediaError: mediaError instanceof MediaStorageError ? mediaError.code : 'UPLOAD_FAILED', deliveries });
            return;
        }

        if (!isAIActive(conversation)) {
            await completeInboundEvent(eventId, processingToken, { controller: 'HUMAN_ACTIVE' });
            return;
        }

        const agentStatus = await getAgentStatus();
        if (agentStatus !== 'active') {
            await completeInboundEvent(eventId, processingToken, { agentStatus });
            return;
        }

        const deterministicResult = message
            ? await getDeterministicResponse(businessId, String(message), { psid, conversationId: convId })
            : null;
        if (deterministicResult) {
            const deterministicReply = typeof deterministicResult === 'string' ? deterministicResult : deterministicResult.message_text;
            const products = typeof deterministicResult === 'string' ? [] : deterministicResult.suggested_products || [];
            if (products.length) await sendOnce('deterministic-products', () => sendGenericTemplate(psid, products.map((product: any) => ({
                title: product.name, subtitle: `Price: ৳${product.price}${product.stock !== undefined ? ` · Stock: ${product.stock}` : ''}`,
                ...(product.image ? { image_url: product.image } : {}), buttons: product.sku ? [{ type: 'postback', title: 'Buy Now', payload: `BUY_${product.sku}` }] : [],
            })), pageId));
            if (deterministicReply) await sendOnce('deterministic-text', () => sendMessage(psid, deterministicReply, pageId));
            await saveMessage(businessId, convId, 'assistant', deterministicReply, undefined, {
                messageId: `${eventId}:assistant`, platform: 'facebook',
            });
            await recordConversationTurn(businessId, convId, 'zero_llm', typeof deterministicResult === 'string' ? undefined : deterministicResult.memory);
            await completeInboundEvent(eventId, processingToken, { reply: deterministicReply, products, deterministic: true, llmCalls: 0 });
            return;
        }

        // Image analysis is itself an AI path, so re-check control immediately before it.
        if (imageMedia) {
            try {
                const imageResult = await invokeIfAIActive(convId, () => handleImageInput(
                    businessId, convId, imageMedia.secureUrl, eventId, imageMedia
                ));
                if (!imageResult) {
                    await completeInboundEvent(eventId, processingToken, { controller: 'HUMAN_ACTIVE' });
                    return;
                }
                const { matchedProducts, visionResult } = imageResult;
                const responseText = matchedProducts.length > 0
                    ? `I can see this is a ${visionResult.category || 'product'}! I found these visually similar matches:\n\n${formatProductsForResponse(matchedProducts)}\n\nWould you like to know more about any of these?`
                    : `I can see the ${visionResult.category || 'product'} you shared! We don't have exact matches right now, but I can help you find similar items. What are you looking for?`;

                await sendOnce('vision-text', () => sendMessage(psid, responseText, pageId));
                await saveMessage(businessId, convId, 'assistant', responseText, undefined, {
                    messageId: `${eventId}:assistant`, platform: 'facebook',
                });
                await recordConversationTurn(businessId, convId, 'zero_llm', matchedProducts.length ? { activeProductId: String(matchedProducts[0]._id), recentProductIds: matchedProducts.slice(0, 3).map((product: any) => String(product._id)) } : undefined);
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
                ...(p.image_url ? { image_url: p.image_url } : {}),
                buttons: [
                    { type: 'postback', title: 'Buy Now', payload: `BUY_${p.sku}` }
                ]
            }));
            await sendOnce('ai-products', () => sendGenericTemplate(psid, elements, pageId));

            // Send text separately if needed
            if (aiResponse.message_text) {
                await sendOnce('ai-text', () => sendMessage(psid, aiResponse.message_text, pageId));
            }

        } else if (aiResponse.quick_replies && aiResponse.quick_replies.length > 0) {
            // Send Quick Replies
            const replies = aiResponse.quick_replies.map((r: string) => ({
                title: r,
                payload: r.toUpperCase().replace(/\s/g, '_')
            }));
            await sendOnce('ai-quick-replies', () => sendQuickReplies(psid, aiResponse.message_text, replies, pageId));

        } else {
            // Send Simple Text
            if (aiResponse.message_text) {
                await sendOnce('ai-text', () => sendMessage(psid, aiResponse.message_text, pageId));
            }
        }

        // Save Assistant Reply - Store the text to keep conversation history compatible
        // Ideally we should store the full JSON structure in metadata, but for RAG text is input
        await saveMessage(businessId, convId, 'assistant', aiResponse.message_text, undefined, {
            messageId: `${eventId}:assistant`, platform: 'facebook',
        });
        await recordConversationTurn(businessId, convId, 'llm_assisted');

        await completeInboundEvent(eventId, processingToken, { reply: aiResponse.message_text });

    } catch (error: any) {
        console.error('Error processing webhook event:', error);
        await releaseInboundEvent(eventId, processingToken, error.message);
        throw error;
    }
};
