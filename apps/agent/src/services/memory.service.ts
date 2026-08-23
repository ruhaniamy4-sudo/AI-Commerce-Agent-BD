import { Customer } from '../models/Customer';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { getSenderProfile } from './facebook.service';
import { assertTenantBusinessId } from '../tenancy/context';

export async function ensureConversation(
    businessId: string,
    conversationId: string,
    clientInfo?: { name?: string; email?: string; phone?: string; senderId?: string }
) {
    assertTenantBusinessId(businessId, 'memory.ensureConversation');
    let conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
        // Find or create client
        let client;
        let senderId = clientInfo?.senderId;

        // Extract senderId from conversationId if it's facebook and not provided
        if (!senderId && conversationId.startsWith('fb_')) {
            senderId = conversationId.replace('fb_', '');
        }

        if (clientInfo?.email) {
            client = await Customer.findOne({ email: clientInfo.email });
        } else if (clientInfo?.phone) {
            client = await Customer.findOne({ phone: clientInfo.phone });
        } else if (senderId) {
            client = await Customer.findOne({ psid: senderId });
        }

        if (!client) {
            let name = clientInfo?.name;
            let facebookLink = undefined;

            // Fetch profile data from Facebook if it's a new FB user
            if (senderId && conversationId.startsWith('fb_')) {
                const profile = await getSenderProfile(senderId);
                if (profile) {
                    name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                    facebookLink = `https://www.facebook.com/${senderId}`;
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
                notes: facebookLink ? `Facebook Profile: ${facebookLink}` : '',
            });
        }

        conversation = await Conversation.create({
            conversationId,
            customerId: client._id,
            psid: client.psid,
            platform: conversationId.startsWith('fb_') ? 'facebook' : 'web-widget',
        });
    } else if (!conversation.customerId && clientInfo) {
        // Link client to existing conversation if not already linked
        let client;
        if (clientInfo.email) {
            client = await Customer.findOne({ email: clientInfo.email });
        } else if (clientInfo.phone) {
            client = await Customer.findOne({ phone: clientInfo.phone });
        } else if (clientInfo.senderId) {
            client = await Customer.findOne({ psid: clientInfo.senderId });
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
    imageUrl?: string
) {
    assertTenantBusinessId(businessId, 'memory.saveMessage');
    const messageData: any = {
        conversationId,
        role,
        content,
    };

    if (imageUrl) {
        messageData.contentType = 'image';
        messageData.attachments = [{
            url: imageUrl,
            type: 'image/jpeg', // Defaulting to jpeg for simplicity
        }];
    }

    await Message.create(messageData);
}
