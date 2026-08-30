import axios from 'axios';

export class FacebookPermissionError extends Error {
    constructor(message = 'Facebook import requires additional permission') { super(message); this.name = 'FacebookPermissionError'; }
}

export async function importAuthorizedFacebookPage(pageId: string) {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!token) throw new FacebookPermissionError();
    try {
        const response = await axios.get(`https://graph.facebook.com/v24.0/${encodeURIComponent(pageId)}`, {
            params: { fields: 'id,name,about,category,emails,phone,website,location,hours', access_token: token },
            timeout: 10_000,
        });
        const page = response.data || {};
        return {
            business: {
                name: page.name, description: page.about, phone: page.phone,
                email: Array.isArray(page.emails) ? page.emails[0] : undefined, website: page.website,
                address: page.location ? [page.location.street, page.location.city, page.location.country].filter(Boolean).join(', ') : undefined,
                openingHours: page.hours ? Object.entries(page.hours).map(([key, value]) => `${key}: ${value}`).join(', ') : undefined,
            },
            knowledge: page.about ? [{ title: `${page.name || 'Business'} — About`, content: page.about, type: 'GUIDE' as const, sourceUrl: `https://facebook.com/${pageId}` }] : [],
            products: [],
            pages: 1,
            warnings: ['Facebook catalog products are imported only when the connected Meta app has an authorized commerce/catalog integration.'],
        };
    } catch (error: any) {
        const code = error?.response?.data?.error?.code;
        if (code === 190 || error?.response?.status === 403) throw new FacebookPermissionError('Facebook connection expired or lacks business import permission');
        throw new Error('Facebook business information is currently unavailable');
    }
}
