import { Customer } from '../models/Customer';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { getSenderProfile } from './facebook.service';
import { assertTenantBusinessId } from '../tenancy/context';
import { maybeUpdateConversationSummary } from './conversation-summary.service';
import type { StoredMediaReference } from './media-storage.service';

export async function ensureConversation(
    businessId: string,
    conversationId: string,
    clientInfo?: { name?: string; email?: string; phone?: string; senderId?: string; pageId?: string }
) {
    assertTenantBusinessId(businessId, 'memory.ensureConversation');
    let conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
        // Find or create client
        let client;
        let senderId = clientInfo?.senderId;

        // Extract senderId from conversationId if it's facebook and not provided
        // Facebook callers must provide senderId because conversation IDs also contain the Page ID.

        if (clientInfo?.email) {
            client = await Customer.findOne({ email: clientInfo.email });
        } else if (clientInfo?.phone) {
            client = await Customer.findOne({ phone: clientInfo.phone });
        } else if (senderId) {
            client = await Customer.findOne({ psid: senderId, ...(clientInfo?.pageId ? { channelPageId: clientInfo.pageId } : {}) });
        }

        if (!client) {
            let name = clientInfo?.name;
            // Fetch profile data from Facebook if it's a new FB user
            if (senderId && clientInfo?.pageId && conversationId.startsWith('fb_')) {
                const profile = await getSenderProfile(senderId, clientInfo.pageId);
                if (profile) {
                    name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                }
            }

            client = await Customer.create({
                name:
                    name ||
                    (conversationId.startsWith('fb_')
                        ? 'Facebook User'
                        : 'Web User'),
                email: clientInfo?.email,
                phone: clientInfo?.phone,
                psid: senderId || `web-${Date.now()}`,
                channelPageId: clientInfo?.pageId,
                notes: '',
            });
        }

        conversation = await Conversation.create({
            conversationId,
            customerId: client._id,
            psid: client.psid,
            platform: conversationId.startsWith('fb_') ? 'facebook' : 'web-widget',
            platformConversationId: conversationId.startsWith('fb_') ? senderId : conversationId,
            platformPageId: clientInfo?.pageId,
        });
    } else if (!conversation.customerId && clientInfo) {
        // Link client to existing conversation if not already linked
        let client;
        if (clientInfo.email) {
            client = await Customer.findOne({ email: clientInfo.email });
        } else if (clientInfo.phone) {
            client = await Customer.findOne({ phone: clientInfo.phone });
        } else if (clientInfo.senderId) {
            client = await Customer.findOne({ psid: clientInfo.senderId, ...(clientInfo.pageId ? { channelPageId: clientInfo.pageId } : {}) });
        }

        if (!client) {
            client = await Customer.create({
                name:
                    clientInfo.name ||
                    (conversationId.startsWith('fb_')
                        ? 'Facebook User'
                        : 'Web User'),
                email: clientInfo.email,
                phone: clientInfo.phone,
                psid: clientInfo.senderId || `web-${Date.now()}`,
                channelPageId: clientInfo.pageId,
            });
        }

        conversation.customerId = client._id;
        conversation.psid = client.psid;
        await conversation.save();
    }

    return conversation;
}



export async function saveMessage(
    businessId: string,
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    imageUrl?: string,
    options?: { messageId?: string; platform?: string; products?: unknown[]; media?: StoredMediaReference }
) {
    assertTenantBusinessId(businessId, 'memory.saveMessage');
    const messageData: any = {
        conversationId,
        role,
        content,
        metadata: options?.messageId ? {
            messageId: options.messageId,
            platform: options.platform,
            ...(options.products?.length ? { products: options.products } : {}),
        } : undefined,
    };

    const media = options?.media;
    if (imageUrl || media) {
        messageData.contentType = 'image';
        messageData.attachments = [{
            url: media?.secureUrl || imageUrl,
            type: media?.mimeType || 'image/jpeg',
            filename: media?.originalFilename,
            size: media?.size,
            provider: media?.provider,
            providerAssetId: media?.providerAssetId,
            resourceType: media?.resourceType,
            width: media?.width,
            height: media?.height,
            source: media?.source,
            originalUrl: media?.originalUrl,
            conversationId: media?.conversationId,
            messageId: media?.messageId,
            retention: media?.retention,
            expiresAt: media?.expiresAt,
            retentionStatus: media?.retentionStatus,
            mediaCreatedAt: media?.createdAt,
        }];
    }

    let savedMessage;
    try {
        savedMessage = await Message.create(messageData);
    } catch (error: any) {
        if (error?.code !== 11000 || !options?.messageId) throw error;
        return Message.findOne({ conversationId, 'metadata.messageId': options.messageId });
    }
    const conversation = await Conversation.findOneAndUpdate(
        { conversationId },
        {
            $inc: { messageCount: 1 },
            $set: {
                lastMessageAt: new Date(),
                lastMessagePreview: content.slice(0, 200),
            },
        },
        { new: true }
    );
    if (conversation) await maybeUpdateConversationSummary(businessId, conversationId);
    return savedMessage;
}
