import { upsertBusinessAwareness, ITrainingAwarenessInput } from '../business-awareness.service';
import { BusinessChannel } from '../../models/BusinessChannel';
import { decryptMetaAccessToken } from '../meta-credentials.service';
import { metaGraph } from '../meta-graph.service';

export interface FacebookPostSignal { id: string; message?: string; created_time?: string; permalink_url?: string; attachments?: { data?: Array<{ media?: { image?: { src?: string } }; title?: string; description?: string }> } }

export function classifyFacebookPost(post: FacebookPostSignal, now = new Date()): ITrainingAwarenessInput | null {
    const text = String(post.message || '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const publishedAt = post.created_time ? new Date(post.created_time) : now;
    if (now.getTime() - publishedAt.getTime() > 180 * 86_400_000) return null;
    const percent = text.match(/(?:up\s*to\s*)?(\d{1,2})\s*%/i);
    const upTo = /up\s*to|সর্বোচ্চ/i.test(text);
    const category = text.match(/(?:all|সব)\s+([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:up\s*to\s*)?\d{1,2}\s*%|\s+(?:price drop|sale|offer|discount|ছাড়)|[.!]|$)/iu)?.[1]?.trim();
    const offer = /offer|discount|sale|price drop|%|অফার|ছাড়/i.test(text);
    const announcement = /announce|announcement|launch|open|applications?|নতুন|শুরু/i.test(text);
    const live = /facebook live|\blive\b|লাইভ/i.test(text);
    if (!offer && !announcement && !live) return null;
    return {
        type: live ? 'LIVE' : offer ? 'CAMPAIGN' : 'ANNOUNCEMENT', title: text.slice(0, 120), summary: text.slice(0, 1000),
        targetType: category ? 'CATEGORY' : 'ALL_PRODUCTS', targetReference: category,
        claimType: percent ? (upTo ? 'UP_TO_PERCENT' : 'PERCENT') : offer ? 'TEXT' : undefined,
        claimValue: percent ? Number(percent[1]) : offer ? text.slice(0, 240) : undefined,
        sourceType: 'facebook', sourceId: post.id, sourceUrl: post.permalink_url, publishedAt, confidence: percent ? .9 : .75,
    };
}

export async function syncAuthorizedFacebookAwareness(businessId: string, pageId: string, since?: Date) {
    const channel = await BusinessChannel.findOne({ businessId, platform: 'facebook', externalId: pageId, connectionStatus: 'CONNECTED' }).select('+encryptedAccessToken');
    if (!channel?.encryptedAccessToken || !channel.permissions.includes('pages_read_engagement')) throw new Error('META_PERMISSION_REQUIRED');
    const response = await metaGraph.pagePosts(pageId, decryptMetaAccessToken(channel.encryptedAccessToken), since);
    const posts = Array.isArray(response.data) ? response.data as FacebookPostSignal[] : [];
    let processed = 0; let relevant = 0;
    for (const post of posts) {
        processed += 1; const signal = classifyFacebookPost(post); if (!signal) continue;
        await upsertBusinessAwareness(businessId, signal); relevant += 1;
    }
    const newest = posts[0];
    return { processed, relevant, checkpoint: { lastFacebookSyncAt: new Date(), lastProcessedPostId: newest?.id, lastProcessedPostAt: newest?.created_time ? new Date(newest.created_time) : undefined } };
}
