import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

const callSendAPI = async (messageData: any, pageId: string = 'me') => {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v24.0/${pageId}/messages`,
            messageData,
            {
                headers: {
                    Authorization: `Bearer ${PAGE_ACCESS_TOKEN}`,
                },
            }
        );
        return response.data;
    } catch (error: any) {
        console.error(
            'Error sending Facebook message:',
            JSON.stringify(error.response?.data, null, 2) || error.message
        );
        throw error;
    }
};

export const sendMessage = async (
    recipientId: string,
    text: string,
    pageId: string = 'me'
) => {
    const messageData = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: { text },
    };
    return callSendAPI(messageData, pageId);
};

export const sendQuickReplies = async (
    recipientId: string,
    text: string,
    replies: { title: string; payload: string }[],
    pageId: string = 'me'
) => {
    const messageData = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: {
            text,
            quick_replies: replies.map((r) => ({
                content_type: 'text',
                title: r.title,
                payload: r.payload,
            })),
        },
    };
    return callSendAPI(messageData, pageId);
};

export const sendButtonTemplate = async (
    recipientId: string,
    text: string,
    buttons: { type: string; title: string; payload?: string; url?: string }[],
    pageId: string = 'me'
) => {
    const messageData = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text,
                    buttons,
                },
            },
        },
    };
    return callSendAPI(messageData, pageId);
};

export const sendGenericTemplate = async (
    recipientId: string,
    elements: {
        title: string;
        subtitle?: string;
        image_url?: string;
        buttons?: { type: string; title: string; url?: string; payload?: string }[];
    }[],
    pageId: string = 'me'
) => {
    const messageData = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements,
                },
            },
        },
    };
    return callSendAPI(messageData, pageId);
};

export const getSenderProfile = async (senderPsid: string) => {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/v24.0/${senderPsid}`,
            {
                params: {
                    fields: 'first_name,last_name,profile_pic,gender,email,birthday',
                    access_token: PAGE_ACCESS_TOKEN,
                },
            }
        );
        return response.data;
    } catch (error: any) {
        console.error(
            'Error fetching Facebook profile:',
            JSON.stringify(error.response?.data || error.message, null, 2)
        );
        return null;
    }
};
