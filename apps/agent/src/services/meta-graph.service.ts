import axios, { AxiosError, AxiosInstance } from 'axios';
import { getMetaConfig } from './meta-config.service';
import { redactMetaSecrets } from './meta-credentials.service';

export type MetaErrorCategory = 'AUTH_EXPIRED' | 'PERMISSION_MISSING' | 'RATE_LIMITED' | 'PAGE_UNAVAILABLE' | 'INVALID_REQUEST' | 'TEMPORARY_FAILURE' | 'UNKNOWN';

export class MetaGraphError extends Error {
    constructor(public category: MetaErrorCategory, public code: string, public statusCode: number, message: string) {
        super(message);
        this.name = 'MetaGraphError';
    }
}

function normalizeMetaError(error: unknown): MetaGraphError {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status || 502;
    const provider = axiosError.response?.data?.error || {};
    const code = String(provider.code || provider.error_subcode || status || 'unknown');
    let category: MetaErrorCategory = 'UNKNOWN';
    if ([190, 102].includes(Number(provider.code))) category = 'AUTH_EXPIRED';
    else if ([10, 200, 298, 299].includes(Number(provider.code))) category = 'PERMISSION_MISSING';
    else if ([4, 17, 32, 613].includes(Number(provider.code)) || status === 429) category = 'RATE_LIMITED';
    else if ([100, 803].includes(Number(provider.code)) || status === 404) category = 'PAGE_UNAVAILABLE';
    else if (status >= 400 && status < 500) category = 'INVALID_REQUEST';
    else if (status >= 500) category = 'TEMPORARY_FAILURE';
    return new MetaGraphError(category, code, status, redactMetaSecrets(provider.message || axiosError.message || 'Meta Graph request failed'));
}

export class MetaGraphClient {
    private readonly client: AxiosInstance;
    constructor(client?: AxiosInstance) {
        const { graphVersion } = getMetaConfig();
        this.client = client || axios.create({ baseURL: `https://graph.facebook.com/${graphVersion}`, timeout: 10_000 });
    }

    private async request<T>(method: 'get' | 'post' | 'delete', path: string, token?: string, data?: unknown, params?: unknown): Promise<T> {
        try {
            const response = await this.client.request<T>({ method, url: path, data, params, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
            return response.data;
        } catch (error) {
            throw normalizeMetaError(error);
        }
    }

    exchangeCode(code: string, appId: string, appSecret: string, redirectUri: string) {
        return this.request<{ access_token: string; token_type?: string; expires_in?: number }>('get', '/oauth/access_token', undefined, undefined, { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
    }

    exchangeLongLivedUserToken(token: string, appId: string, appSecret: string) {
        return this.request<{ access_token: string; token_type?: string; expires_in?: number }>('get', '/oauth/access_token', undefined, undefined, { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: token });
    }

    me(token: string) { return this.request<{ id: string; name?: string }>('get', '/me', token, undefined, { fields: 'id,name' }); }
    permissions(token: string) { return this.request<{ data: Array<{ permission: string; status: string }> }>('get', '/me/permissions', token); }
    pages(token: string) { return this.request<{ data: Array<{ id: string; name: string; access_token: string; category?: string; perms?: string[]; picture?: { data?: { url?: string } } }> }>('get', '/me/accounts', token, undefined, { fields: 'id,name,category,picture,access_token,perms', limit: 100 }); }
    page(pageId: string, token: string) { return this.request<{ id: string; name: string; category?: string; picture?: { data?: { url?: string } } }>('get', `/${pageId}`, token, undefined, { fields: 'id,name,category,picture' }); }
    pageBusiness(pageId: string, token: string) { return this.request<any>('get', `/${pageId}`, token, undefined, { fields: 'id,name,about,category,emails,phone,website,location,hours' }); }
    pagePosts(pageId: string, token: string, since?: Date) { return this.request<{ data: any[] }>('get', `/${pageId}/posts`, token, undefined, { fields: 'id,message,created_time,permalink_url,attachments{media,title,description}', limit: 25, ...(since ? { since: Math.floor(since.getTime() / 1000) } : {}) }); }
    profile(psid: string, token: string) { return this.request<{ first_name?: string; last_name?: string; profile_pic?: string }>('get', `/${psid}`, token, undefined, { fields: 'first_name,last_name,profile_pic' }); }
    subscribe(pageId: string, token: string, fields: readonly string[]) { return this.request<{ success: boolean }>('post', `/${pageId}/subscribed_apps`, token, undefined, { subscribed_fields: fields.join(',') }); }
    unsubscribe(pageId: string, token: string) { return this.request<{ success: boolean }>('delete', `/${pageId}/subscribed_apps`, token); }
    subscriptions(pageId: string, token: string) { return this.request<{ data: Array<{ subscribed_fields?: string[] }> }>('get', `/${pageId}/subscribed_apps`, token); }
    send(pageId: string, token: string, payload: unknown) { return this.request<{ recipient_id?: string; message_id?: string }>('post', `/${pageId}/messages`, token, payload); }
}

export const metaGraph = new MetaGraphClient();
