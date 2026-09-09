import { canonicalUrl } from './normalization';

export type UrlPageType =
    | 'PRODUCT_PAGE'
    | 'CATEGORY_PAGE'
    | 'COLLECTION_PAGE'
    | 'PAGINATION'
    | 'FILTER_SORT_SEARCH'
    | 'BLOG_CONTENT'
    | 'ACCOUNT_CART_CHECKOUT'
    | 'POLICY_INFO'
    | 'CONTACT_LOCATION'
    | 'FAQ'
    | 'IRRELEVANT';

export interface CrawlDiscoveryMetrics {
    discovered: number;
    candidateProductUrls: number;
    acceptedProducts: number;
    rejectedUrls: number;
    duplicatesMerged: number;
}

const COMMON_IMAGE_OR_MEDIA_EXT = /\.(jpe?g|png|gif|webp|svg|ico|bmp|tiff?|pdf|zip|tar|gz|rar|exe|mp4|webm|avi|mov|mp3|wav|ogg|woff2?|eot|ttf|otf|css|js)(\?.*)?$/i;

const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'zanpid', 'msclkid',
    'srsltid', 'gbraid', 'wbraid', 'fb_action_ids', 'fb_action_types',
    '_ga', '_gl', 'mc_cid', 'mc_eid', 'ref', 'source', 'campaign',
    'affiliate', 'aff_id', 'trk', 'tracking', 'spm', 'scm',
]);

const FILTER_SORT_PARAM_REGEX = /^(filter|sort|order|orderby|dir|limit|view|layout|display|grid|list|min_price|max_price|price_min|price_max|rating|color|size|tag|attributes|brand|manufacturer|q|query|s|search|search_query|k|keyword|refinementlist.*|refinement.*|hierarchicalmenu.*|menu.*)$/i;

const PAGINATION_PARAM_REGEX = /^(page|p|paged|pg|start|offset)$/i;
const PAGINATION_PATH_REGEX = /(?:^|\/)(?:page|p)\/\d+(?:\/|$)/i;

/**
 * Normalizes a URL for discovery deduplication.
 * - Strips tracking query parameters
 * - Strips search/filter query parameters
 * - Strips variant query parameters for root catalog item discovery (e.g., ?variant=12345)
 * - Normalizes protocol to lowercase and removes default port and fragment
 * - Strips trailing slashes from path (except root)
 */
export function normalizeDiscoveryUrl(rawUrl: string, options?: { preserveVariantParam?: boolean }): string | undefined {
    if (!rawUrl || typeof rawUrl !== 'string') return undefined;
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
        return undefined;
    }
    try {
        const url = new URL(trimmed);
        if (!['http:', 'https:'].includes(url.protocol)) return undefined;

        url.hash = '';

        // Delete tracking, filter/sort, and irrelevant parameters
        for (const key of [...url.searchParams.keys()]) {
            const lowerKey = key.toLowerCase();
            if (TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_')) {
                url.searchParams.delete(key);
            } else if (!options?.preserveVariantParam && /^(variant|variant_id|attribute_[^=]+|v)$/i.test(lowerKey)) {
                // Remove variant parameter to deduplicate to base product page during discovery
                url.searchParams.delete(key);
            } else if (FILTER_SORT_PARAM_REGEX.test(lowerKey) || lowerKey.startsWith('filter.') || lowerKey.startsWith('filter_') || lowerKey.startsWith('filter[') || lowerKey.startsWith('refinement')) {
                // Remove filter and sort params to prevent link explosion
                url.searchParams.delete(key);
            } else if (PAGINATION_PARAM_REGEX.test(lowerKey) && url.searchParams.get(key) === '1') {
                // Page 1 is the canonical category/catalog page
                url.searchParams.delete(key);
            }
        }

        url.hostname = url.hostname.toLowerCase();
        if (url.pathname !== '/') {
            url.pathname = url.pathname.replace(/\/+$/, '');
        }

        return url.toString();
    } catch {
        return undefined;
    }
}

/**
 * Deterministically classifies a URL into commerce taxonomy.
 * Zero LLM calls — strict deterministic pattern matching.
 */
export function classifyUrlType(urlStr: string): UrlPageType {
    let parsed: URL;
    try {
        parsed = new URL(urlStr);
    } catch {
        return 'IRRELEVANT';
    }

    const pathname = decodeURIComponent(parsed.pathname).toLowerCase();
    const search = decodeURIComponent(parsed.search).toLowerCase();

    // 1. Media, static assets, and infrastructure paths
    if (COMMON_IMAGE_OR_MEDIA_EXT.test(pathname) || /\/(?:cdn-cgi|api|feed|rss|wp-json|wp-includes|wp-content\/plugins)(?:\/|$)/i.test(pathname)) {
        return 'IRRELEVANT';
    }

    // 2. Account / Cart / Checkout / Administrative paths
    if (/\/(?:cart|checkout|basket|bag|account|my-account|login|signin|register|signup|logout|wishlist|order-tracking|track-order|order-status|wp-admin|admin|cpanel)(?:\/|$)/i.test(pathname)) {
        return 'ACCOUNT_CART_CHECKOUT';
    }

    // 3. Search / Filter / Sort / Refinement query strings
    for (const key of parsed.searchParams.keys()) {
        const lowerKey = key.toLowerCase();
        if (
            FILTER_SORT_PARAM_REGEX.test(lowerKey) ||
            /^filter[._\[]|sort[._\[]|refinement|hierarchicalmenu|menu\[/i.test(lowerKey)
        ) {
            return 'FILTER_SORT_SEARCH';
        }
    }
    if (/\/(?:search|find|filter|browse)(?:\/|$)/i.test(pathname)) {
        return 'FILTER_SORT_SEARCH';
    }

    // 4. Pagination
    if (PAGINATION_PATH_REGEX.test(pathname)) {
        return 'PAGINATION';
    }
    for (const key of parsed.searchParams.keys()) {
        if (PAGINATION_PARAM_REGEX.test(key) && parsed.searchParams.get(key) !== '1') {
            return 'PAGINATION';
        }
    }

    // 5. Individual Product Detail Page — EXPLICIT product patterns MUST precede policies and categories
    // Canonical ecommerce single product patterns:
    // /products/classic-polo
    // /product/74223-mens-premium-activewear-edition-trouser-voltage
    // /item/handcrafted-kurti
    // /p/smartphone-pro-max
    // /dp/B08N5WRWNW
    // /product-detail/samsung-galaxy-s24
    const isExplicitProduct =
        /\/(?:products?|items?|p|dp|good|goods|product-detail)\/([a-z0-9_\-\.]+)/i.test(pathname) ||
        (/\.html?$/i.test(pathname) && /(?:product|item|detail)/i.test(pathname));

    if (isExplicitProduct) {
        return 'PRODUCT_PAGE';
    }

    // 6. Policy & Business Info pages (with strict word boundaries)
    if (/(?:^|\/|[-_])(?:faqs?|frequently-asked(?:-questions?)?|q-and-a|help-center|knowledge-base)(?:[-_/]|$)/i.test(pathname)) {
        return 'FAQ';
    }
    if (/(?:^|\/|[-_])(?:delivery|shipping|courier|dispatch|delivery-charge|shipping-policy)(?:[-_/]|$)/i.test(pathname)) {
        return 'POLICY_INFO';
    }
    if (/(?:^|\/|[-_])(?:return|returns|refund|refunds|exchange|cancellation|replacement)(?:[-_/]|$)/i.test(pathname)) {
        return 'POLICY_INFO';
    }
    if (/(?:^|\/|[-_])(?:cash-on-delivery|cod|payment|payment-methods?|emi|terms|terms-and-conditions|privacy|privacy-policy|policy|policies|warranty|guarantee)(?:[-_/]|$)/i.test(pathname)) {
        return 'POLICY_INFO';
    }
    if (/(?:^|\/|[-_])(?:contact|contact-us|support|store-location|locations?|outlets?|showrooms?|branches?|find-us)(?:[-_/]|$)/i.test(pathname)) {
        return 'CONTACT_LOCATION';
    }
    if (/(?:^|\/|[-_])(?:about|about-us|our-story|who-we-are|company)(?:[-_/]|$)/i.test(pathname)) {
        return 'POLICY_INFO';
    }

    // 7. Blog / Content / Editorial
    if (/\/(?:blog|news|articles?|posts?|journal|press|stories|events?|tag|author|category\/blog)(?:\/|$)/i.test(pathname)) {
        return 'BLOG_CONTENT';
    }

    // 8. Category / Collection listing pages (MUST be checked before individual products)
    // Common ecommerce category patterns:
    // /collections/mens-fashion (without /products/)
    // /category/shirts
    // /product-category/accessories
    // /shop/men
    // /catalog/women
    const isCategoryPath =
        /\/(?:collections?|categories|product-category|category|c|catalog|department|brand|brands|type)\/([^/]+)(?:\/)?$/i.test(pathname) ||
        pathname === '/shop' ||
        pathname === '/products' ||
        pathname === '/collections' ||
        pathname === '/catalog';

    if (isCategoryPath && !/\/(?:products?|items?|p|dp)\/[^/]+/i.test(pathname)) {
        return pathname.includes('collection') ? 'COLLECTION_PAGE' : 'CATEGORY_PAGE';
    }

    // Deep path under /shop/ or category that looks like a leaf product slug (e.g. /shop/dresses/summer-floral-maxi)
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && ['shop', 'store', 'catalog', 'collection'].includes(segments[0])) {
        const lastSegment = segments[segments.length - 1];
        // If the last segment looks like a slug (has hyphens and reasonable length)
        if (lastSegment.includes('-') && lastSegment.length > 3) {
            return 'PRODUCT_PAGE';
        }
        return 'CATEGORY_PAGE';
    }

    return 'IRRELEVANT';
}

/**
 * Determines whether a URL is eligible for discovery crawling.
 * - Real product pages and informative business pages are high priority.
 * - Category listing pages are useful for discovering products, but never as product candidates.
 * - Search, filter, account, checkout, and media URLs are excluded.
 */
export function isCrawlableDiscoveryUrl(urlStr: string): boolean {
    const type = classifyUrlType(urlStr);
    return !['IRRELEVANT', 'ACCOUNT_CART_CHECKOUT', 'FILTER_SORT_SEARCH'].includes(type);
}

export const normalizeUrl = normalizeDiscoveryUrl;
export const classifyUrl = (url: string, _baseUrl?: string) => ({ type: classifyUrlType(url) });
export const isLikelyProductUrl = (url: string, _baseUrl?: string) => classifyUrlType(url) === 'PRODUCT_PAGE';
export const isTraversableListingOrPaginationUrl = (url: string, _baseUrl?: string) => ['CATEGORY_PAGE', 'COLLECTION_PAGE', 'PAGINATION'].includes(classifyUrlType(url));
export const isIrrelevantUrl = (url: string, _baseUrl?: string) => ['IRRELEVANT', 'ACCOUNT_CART_CHECKOUT'].includes(classifyUrlType(url));

