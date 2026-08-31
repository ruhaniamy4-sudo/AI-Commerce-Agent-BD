import { BusinessChannel } from '../../models/BusinessChannel';
import { requireTenantContext } from '../../tenancy/context';
import { decryptMetaAccessToken } from '../meta-credentials.service';
import { MetaGraphError, metaGraph } from '../meta-graph.service';

export class FacebookPermissionError extends Error {
    constructor(message = 'Facebook import requires pages_read_engagement permission') { super(message); this.name = 'FacebookPermissionError'; }
}

export async function importAuthorizedFacebookPage(pageId: string) {
    const principal = requireTenantContext();
    const channel = await BusinessChannel.findOne({ businessId: principal.businessId, platform: 'facebook', externalId: pageId, connectionStatus: 'CONNECTED' }).select('+encryptedAccessToken');
    if (!channel?.encryptedAccessToken || !channel.permissions.includes('pages_read_engagement')) throw new FacebookPermissionError();
    try {
        const page = await metaGraph.pageBusiness(pageId, decryptMetaAccessToken(channel.encryptedAccessToken));
        return {
            business: {
                name: page.name, description: page.about, phone: page.phone,
                email: Array.isArray(page.emails) ? page.emails[0] : undefined, website: page.website,
                address: page.location ? [page.location.street, page.location.city, page.location.country].filter(Boolean).join(', ') : undefined,
                openingHours: page.hours ? Object.entries(page.hours).map(([key, value]) => `${key}: ${value}`).join(', ') : undefined,
            },
            knowledge: page.about ? [{ title: `${page.name || 'Business'} — About`, content: page.about, type: 'GUIDE' as const, sourceUrl: `https://facebook.com/${pageId}` }] : [],
            products: [], pages: 1,
            warnings: ['Facebook catalog products require a separately reviewed commerce/catalog integration and are not inferred from customer messages.'],
        };
    } catch (error) {
        if (error instanceof MetaGraphError && ['AUTH_EXPIRED', 'PERMISSION_MISSING'].includes(error.category)) throw new FacebookPermissionError('Facebook connection expired or lacks pages_read_engagement permission');
        throw new Error('Facebook business information is currently unavailable');
    }
}
