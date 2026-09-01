import axios from 'axios';
import * as cheerio from 'cheerio';
import { canonicalUrl, normalizeCurrency, normalizeMoney, stableFingerprint } from './normalization';
import { Resolver, validatePublicUrl } from './url-security';
import { normalizeProductAvailability } from './product-availability';

export interface ExtractedProduct {
    name: string; description: string; category?: string; basePrice?: number; salePrice?: number; currency?: string;
    sku?: string; barcode?: string; brand?: string; canonicalUrl?: string; images: string[];
    stock?: number; availability?: string; variants: Array<{ name: string; sku?: string; price?: number; currency?: string; stock?: number; availability?: string; images: string[]; specs?: Record<string, unknown> }>;
    specs: Record<string, unknown>;
}
export interface ExtractedKnowledge { title: string; content: string; type: 'FAQ' | 'POLICY' | 'GUIDE'; sourceUrl: string; topic?: PageType; confidence?: number; }
export type PageType = 'PRODUCT' | 'CATEGORY' | 'COLLECTION' | 'CONTACT' | 'FAQ' | 'DELIVERY' | 'PAYMENT' | 'COD' | 'RETURN' | 'ABOUT' | 'STORE_LOCATION' | 'TERMS' | 'POLICY' | 'BUSINESS_INFO' | 'OTHER_RELEVANT' | 'IGNORE';
export interface WebsiteExtraction {
    pages: number; products: ExtractedProduct[]; knowledge: ExtractedKnowledge[]; business: Record<string, string>; warnings: string[];
    crawl?: { discovered: number; productUrls: number; processed: number; remaining: number; failed: number; fetches: number; aiCalls: number; pagesWithoutAI: number; unchanged: number; changed: number; newPages: number; durationMs: number; pages: Array<{ url: string; fingerprint?: string; pageType: PageType; status: 'pending'|'processed'|'unchanged'|'failed'; error?: string; lastSeenAt: Date }> };
}

export type WebsiteIngestionErrorCode = 'TIMEOUT' | 'BLOCKED' | 'UNREACHABLE' | 'CRAWLER_FAILURE';
export class WebsiteIngestionError extends Error {
    constructor(public readonly code: WebsiteIngestionErrorCode, message: string) { super(message); this.name = 'WebsiteIngestionError'; }
}

const MAX_BYTES = Number(process.env.INGESTION_MAX_RESPONSE_BYTES || 2_000_000);
const MAX_PAGES = Math.min(500, Math.max(1, Number(process.env.INGESTION_MAX_PAGES || 50)));
const MAX_DISCOVERED = Math.min(10_000, Math.max(MAX_PAGES, Number(process.env.INGESTION_MAX_DISCOVERED_URLS || 2_000)));
const TIMEOUT_MS = Math.min(30_000, Math.max(1_000, Number(process.env.INGESTION_FETCH_TIMEOUT_MS || 10_000)));
const USER_AGENT = 'SellPilotBusinessImporter/1.0 (+merchant-authorized-public-data)';

function flattenJsonLd(value: any): any[] {
    if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
    if (!value || typeof value !== 'object') return [];
    return [value, ...flattenJsonLd(value['@graph'])];
}
function typesOf(value: any): string[] { return (Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']]).filter(Boolean); }
function absolute(value: unknown, pageUrl: string): string | undefined {
    if (!value) return undefined;
    try { return new URL(String(value), pageUrl).toString(); } catch { return undefined; }
}
function offerFrom(node: any): any {
    const offers = Array.isArray(node?.offers) ? node.offers : node?.offers ? [node.offers] : [];
    return offers[0] || {};
}
function availabilityStock(value: unknown): number | undefined {
    const text = String(value || '').toLowerCase();
    if (text.includes('outofstock') || text.includes('soldout')) return 0;
    return undefined;
}
function normalizedAvailability(value: unknown): ExtractedProduct['availability'] {
    if (String(value || '').toLowerCase().includes('preorder')) return 'preorder';
    return normalizeProductAvailability(value);
}
function productPrice(value: unknown, supportingText?: unknown): number | undefined {
    const direct = normalizeMoney(value);
    if (direct !== undefined && direct > 0) return direct;
    const text = String(supportingText || '').replace(/,/g, ' ');
    const match = text.match(/(?:price[^.\d]{0,45}(?:is|starts?\s+from|from)?|starts?\s+from)\s*(?:bdt|tk\.?|taka|৳)?\s*(\d{2,9}(?:\.\d{1,2})?)/i);
    return match ? normalizeMoney(match[1]) : undefined;
}

function productSpecs($: cheerio.CheerioAPI): Record<string, string> {
    const specs: Record<string, string> = {};
    $('table tr').each((_index, row) => {
        const cells = $(row).find('th,td').map((_i, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
        if (cells.length >= 2 && cells[0].length > 1 && cells[0].length <= 80 && cells[1].length <= 500) specs[cells[0]] = cells[1];
    });
    $('dt').each((_index, term) => {
        const key = $(term).text().replace(/\s+/g, ' ').trim(); const value = $(term).next('dd').text().replace(/\s+/g, ' ').trim();
        if (key.length > 1 && key.length <= 80 && value && value.length <= 500) specs[key] = value;
    });
    const pageText = $('main, article, [role="main"], body').first().text().replace(/\s+/g, ' ');
    const knownLabels = ['Display', 'Processor', 'Chipset', 'CPU', 'GPU', 'RAM', 'Storage', 'Camera System', 'Rear Camera', 'Main Camera', 'Front Camera', 'Selfie Camera', 'Battery', 'Charging', 'Operating System', 'OS', 'Warranty', 'Material', 'Fit', 'Multiple Store Locations'];
    for (const label of ['Display', 'Processor', 'Chipset', 'RAM', 'Storage', 'Main Camera', 'Selfie Camera', 'Battery', 'Operating System', 'OS', 'Warranty', 'Material', 'Fit']) {
        if (specs[label]) continue;
        const match = new RegExp(`${label.replace(/ /g, '\\s+')}\\s*:\\s*`, 'i').exec(pageText);
        if (!match) continue;
        let tail = pageText.slice(match.index + match[0].length, match.index + match[0].length + 300);
        const nextLabel = knownLabels.filter((item) => item !== label).map((item) => tail.search(new RegExp(`${item.replace(/ /g, '\\s+')}\\s*:`, 'i'))).filter((index) => index > 0).sort((a, b) => a - b)[0];
        if (nextLabel) tail = tail.slice(0, nextLabel);
        const sentenceEnd = tail.search(/\.(?:\s+)?(?=[A-Z])/); if (sentenceEnd > 0) tail = tail.slice(0, sentenceEnd + 1);
        const value = tail.trim().replace(new RegExp(`(?:${knownLabels.map((item) => item.replace(/ /g, '\\s+')).join('|')})$`, 'i'), '').replace(/[;,\s]+$/, '').slice(0, 240);
        if (value) specs[label] = value;
    }
    return Object.fromEntries(Object.entries(specs).slice(0, 60));
}

export function classifyPageUrl(input: string): PageType {
    const { pathname, search } = new URL(input);
    const path = decodeURIComponent(pathname).toLowerCase();
    if (/\/(?:cart|checkout|account|login|register|wishlist|search)(?:\/|$)/.test(path) || /(?:^|[?&])(filter|sort|tag|q)=/i.test(search)) return 'IGNORE';
    if (/\/(?:products?|items?|p)\//.test(path)) return 'PRODUCT';
    if (/faq|frequently-asked/.test(path)) return 'FAQ';
    if (/delivery|shipping/.test(path)) return 'DELIVERY';
    if (/cash-on-delivery|\bcod\b/.test(path)) return 'COD';
    if (/payment|\bemi\b/.test(path)) return 'PAYMENT';
    if (/return|refund|exchange/.test(path)) return 'RETURN';
    if (/contact/.test(path)) return 'CONTACT';
    if (/store-location|locations?|showrooms?/.test(path)) return 'STORE_LOCATION';
    if (/about|our-story/.test(path)) return 'ABOUT';
    if (/terms/.test(path)) return 'TERMS';
    if (/policy|warranty/.test(path)) return 'POLICY';
    if (/collections?/.test(path)) return 'COLLECTION';
    if (/categor(?:y|ies)|catalog|shop/.test(path)) return 'CATEGORY';
    return 'OTHER_RELEVANT';
}

function uniqueUrls(values: Array<string | undefined>): string[] {
    return [...new Set(values.map((value) => canonicalUrl(value)).filter(Boolean) as string[])];
}

function relevantProductImage(value: string | undefined, pageUrl: string): string | undefined {
    const resolved = absolute(value, pageUrl);
    if (!resolved || !/^https?:/.test(resolved)) return undefined;
    const text = resolved.toLowerCase();
    if (/logo|favicon|sprite|icon|payment|bkash|nagad|visa|mastercard|banner|placeholder|avatar|badge/.test(text)) return undefined;
    return resolved;
}

function cleanContentRoot($: cheerio.CheerioAPI) {
    const root = $('main, article, [role="main"], .page-content, .entry-content').first().length
        ? $('main, article, [role="main"], .page-content, .entry-content').first().clone()
        : $('body').first().clone();
    root.find('script,style,noscript,template,svg,header,nav,footer,aside,form,button,[role="navigation"],[aria-label*="breadcrumb" i],.breadcrumb,.breadcrumbs,.menu,.mega-menu,.navbar,.footer,.header,.sidebar,.related,.recommendations,.newsletter,.cookie,.social-share').remove();
    return root;
}

const NOISE_ONLY = /^(home|shop|cart|login|register|search|menu|read more|learn more|buy now|add to cart|order tracking|follow us|subscribe|newsletter)$/i;
export function knowledgeQuality(content: string): 'ready' | 'review' | 'noise' {
    const text = content.replace(/\s+/g, ' ').trim();
    if (text.length < 20 || NOISE_ONLY.test(text)) return 'noise';
    const words = text.split(/\s+/).filter(Boolean);
    const unique = new Set(words.map((word) => word.toLowerCase()));
    if (words.length > 20 && unique.size / words.length < .28) return 'noise';
    if ((text.match(/\b(home|shop|cart|login|brands?|categories|menu)\b/gi) || []).length >= 5) return 'review';
    return 'ready';
}

function structuredKnowledge($: cheerio.CheerioAPI, pageUrl: string, pageTitle: string, pageType: PageType): ExtractedKnowledge[] {
    if (!['CONTACT','FAQ','DELIVERY','PAYMENT','COD','RETURN','ABOUT','STORE_LOCATION','TERMS','POLICY','BUSINESS_INFO'].includes(pageType)) return [];
    const root = cleanContentRoot($);
    const items: ExtractedKnowledge[] = [];
    if (pageType === 'FAQ') {
        root.find('details').each((_index, element) => {
            const question = root.find(element).find('summary').first().text().replace(/\s+/g, ' ').trim();
            const answerRoot = root.find(element).clone(); answerRoot.find('summary').remove();
            const answer = answerRoot.text().replace(/\s+/g, ' ').trim();
            if (question && knowledgeQuality(answer) !== 'noise') items.push({ title: question.slice(0, 200), content: answer.slice(0, 4_000), type: 'FAQ', sourceUrl: pageUrl, topic: 'FAQ', confidence: .95 });
        });
    }
    const blocks = root.find('p, li').map((_index, element) => root.find(element).text().replace(/\s+/g, ' ').trim()).get()
        .filter((text) => text.length >= 20 && text.length <= 1_500 && knowledgeQuality(text) !== 'noise');
    const factual = blocks.filter((text) => {
        if (['DELIVERY','PAYMENT','COD','RETURN'].includes(pageType)) return /\b(deliver|shipping|dhaka|charge|day|cash on delivery|cod|payment|bkash|nagad|card|bank|emi|return|refund|exchange|warranty)\b|৳|\btk\.?\s*\d|\d+\s*(?:days?|দিন)/i.test(text);
        if (pageType === 'CONTACT' || pageType === 'STORE_LOCATION') return /@|\+?\d[\d\s-]{7,}|address|location|hours?|support|contact|road|ঢাকা|ফোন/i.test(text);
        return true;
    });
    const content = [...new Set(factual)].slice(0, 12).join('\n');
    if (content && knowledgeQuality(content) !== 'noise') items.push({ title: pageTitle.slice(0, 200), content: content.slice(0, 8_000), type: pageType === 'FAQ' ? 'FAQ' : pageType === 'ABOUT' ? 'GUIDE' : 'POLICY', sourceUrl: pageUrl, topic: pageType, confidence: knowledgeQuality(content) === 'ready' ? .9 : .65 });
    return items;
}

export function pageContentFingerprint(html: string): string {
    const $ = cheerio.load(html);
    const structured = $('script[type="application/ld+json"]').map((_index, element) => $(element).text().replace(/\s+/g, ' ').trim()).get();
    $('script,style,noscript,template,svg').remove();
    const content = cleanContentRoot($).text().replace(/\s+/g, ' ').trim();
    return stableFingerprint({ structured, content });
}

export function extractFromHtml(html: string, pageUrl: string): Omit<WebsiteExtraction, 'pages' | 'warnings'> & { links: string[] } {
    const $ = cheerio.load(html);
    const products: ExtractedProduct[] = [];
    const knowledge: ExtractedKnowledge[] = [];
    const business: Record<string, string> = {};
    const nodes: any[] = [];
    $('script[type="application/ld+json"]').each((_index, element) => {
        try { nodes.push(...flattenJsonLd(JSON.parse($(element).text()))); } catch { /* malformed third-party metadata */ }
    });
    $('script,style,noscript,template,svg').remove();
    const pageSpecs = productSpecs($);
    const domGallery = uniqueUrls($('[itemprop="image"], [class*="product"] img, [class*="gallery"] img, [class*="swiper"] img').map((_index, element) => relevantProductImage($(element).attr('data-src') || $(element).attr('data-lazy-src') || $(element).attr('srcset')?.split(',')[0]?.trim().split(/\s+/)[0] || $(element).attr('src'), pageUrl)).get()).slice(0, 12);
    for (const node of nodes) {
        const types = typesOf(node);
        if (types.some((type) => ['Product', 'ProductGroup'].includes(type)) && node.name) {
            const offer = offerFrom(node);
            const imageValues = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
            const images = uniqueUrls([...imageValues.map((image: any) => relevantProductImage(image?.url || image, pageUrl)), relevantProductImage($('meta[property="og:image"]').attr('content'), pageUrl), ...domGallery]).slice(0, 12);
            const variants = (node.hasVariant || []).map((variant: any) => {
                const variantOffer = offerFrom(variant);
                return {
                    name: String(variant.name || variant.color || variant.size || 'Variant'), sku: variant.sku ? String(variant.sku) : undefined,
                    price: normalizeMoney(variantOffer.price), currency: normalizeCurrency(variantOffer.priceCurrency, variantOffer.price), stock: availabilityStock(variantOffer.availability), availability: normalizedAvailability(variantOffer.availability), images: [],
                    specs: { color: variant.color, size: variant.size },
                };
            });
            products.push({
                name: String(node.name).trim(), description: String(node.description || '').trim(), category: String(node.category || '').trim() || undefined,
                basePrice: productPrice(offer.price || offer.lowPrice, `${node.description || ''} ${$('meta[name="description"]').attr('content') || ''}`), salePrice: productPrice(offer.salePrice), currency: normalizeCurrency(offer.priceCurrency, offer.price, offer.lowPrice, node.description), sku: node.sku ? String(node.sku) : undefined,
                barcode: node.gtin || node.gtin13 || node.gtin12 || node.mpn, brand: String(node.brand?.name || node.brand || '').trim() || undefined,
                canonicalUrl: canonicalUrl(absolute(node.url, pageUrl) || pageUrl), images, stock: availabilityStock(offer.availability), availability: normalizedAvailability(offer.availability),
                variants, specs: { ...pageSpecs, ...Object.fromEntries((node.additionalProperty || []).filter((item: any) => item?.name).map((item: any) => [item.name, item.value])), ...(node.color ? { color: node.color } : {}), ...(node.size ? { size: node.size } : {}) },
            });
        }
        if (types.includes('FAQPage')) {
            for (const question of node.mainEntity || []) {
                const answer = question.acceptedAnswer?.text;
                if (question.name && answer) knowledge.push({ title: String(question.name), content: String(answer), type: 'FAQ', sourceUrl: pageUrl });
            }
        }
        if (types.some((type) => ['Organization', 'LocalBusiness', 'Store'].includes(type))) {
            if (node.name) business.name = String(node.name);
            if (node.description) business.description = String(node.description);
            if (node.telephone) business.phone = String(node.telephone);
            if (node.email) business.email = String(node.email);
            if (node.address) business.address = typeof node.address === 'string' ? node.address : [node.address.streetAddress, node.address.addressLocality, node.address.addressCountry].filter(Boolean).join(', ');
            if (node.openingHours) business.openingHours = Array.isArray(node.openingHours) ? node.openingHours.join(', ') : String(node.openingHours);
            if (node.sameAs) business.socialLinks = (Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs]).join(', ');
        }
    }
    if (!products.length) {
        const likelyProductPage = /product|shop\/[^/]+|item/.test(new URL(pageUrl).pathname.toLowerCase()) || /product/i.test(String($('meta[property="og:type"]').attr('content') || ''));
        const name = String($('meta[property="og:title"]').attr('content') || $('h1').first().text()).trim();
        const priceText = $('meta[property="product:price:amount"]').attr('content') || $('[itemprop="price"]').first().attr('content') || $('[itemprop="price"]').first().text() || $('[class*="price"]').first().text();
        const price = productPrice(priceText, $('meta[name="description"]').attr('content'));
        if (likelyProductPage && name && price !== undefined) {
            const gallery = $('[itemprop="image"], [class*="product"] img, [class*="gallery"] img, [class*="swiper"] img').map((_index, element) => relevantProductImage($(element).attr('data-src') || $(element).attr('data-lazy-src') || $(element).attr('src'), pageUrl)).get();
            const image = relevantProductImage($('meta[property="og:image"]').attr('content') || $('[itemprop="image"]').first().attr('src'), pageUrl);
            products.push({ name, description: String($('meta[name="description"]').attr('content') || $('[itemprop="description"]').first().text()).trim(), basePrice: price, currency: normalizeCurrency($('meta[property="product:price:currency"]').attr('content'), $('[itemprop="priceCurrency"]').first().attr('content'), priceText),
                sku: String($('[itemprop="sku"]').first().attr('content') || $('[itemprop="sku"]').first().text() || $('[data-sku]').first().attr('data-sku') || '').trim() || undefined,
                canonicalUrl: canonicalUrl(pageUrl), images: uniqueUrls([image, ...gallery]).slice(0, 12), variants: [], specs: pageSpecs,
            });
        }
    }
    const canonical = absolute($('link[rel="canonical"]').attr('href'), pageUrl);
    const pageTitle = $('h1').first().text().trim() || $('title').text().trim();
    const pageType = classifyPageUrl(pageUrl);
    knowledge.push(...structuredKnowledge($, canonical || pageUrl, pageTitle, pageType));
    const phone = $('a[href^="tel:"]').first().attr('href')?.replace(/^tel:/, '').trim();
    const email = $('a[href^="mailto:"]').first().attr('href')?.replace(/^mailto:/, '').split('?')[0].trim();
    if (phone && !business.phone) business.phone = phone;
    if (email && !business.email) business.email = email;
    const socialLinks = $('a[href*="facebook.com"],a[href*="instagram.com"],a[href*="linkedin.com"],a[href*="youtube.com"]').map((_i, item) => absolute($(item).attr('href'), pageUrl)).get().filter(Boolean);
    if (socialLinks.length && !business.socialLinks) business.socialLinks = [...new Set(socialLinks)].slice(0, 10).join(', ');
    const metaDescription = String($('meta[name="description"]').attr('content') || '').trim();
    if (new URL(pageUrl).pathname === '/' && !business.description && metaDescription) business.description = metaDescription;
    const links = $('a[href]').map((_i, item) => absolute($(item).attr('href'), pageUrl)).get().filter(Boolean);
    return { products, knowledge, business, links };
}

export async function fetchPublicText(input: string, redirects = 0, resolver?: Resolver): Promise<{ url: string; text: string; contentType: string }> {
    if (redirects > 5) throw new Error('Website redirected too many times');
    const safeUrl = await validatePublicUrl(input, resolver);
    const response = await axios.get<ArrayBuffer>(safeUrl.toString(), {
        responseType: 'arraybuffer', timeout: TIMEOUT_MS, maxContentLength: MAX_BYTES, maxBodyLength: MAX_BYTES,
        maxRedirects: 0, validateStatus: (status) => status >= 200 && status < 400,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.8' },
    });
    if (response.status >= 300) {
        const location = response.headers.location;
        if (!location) throw new Error('Website redirect has no destination');
        return fetchPublicText(new URL(location, safeUrl).toString(), redirects + 1, resolver);
    }
    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (!/text\/html|application\/xhtml\+xml|application\/xml|text\/xml|text\/plain|application\/json/.test(contentType)) throw new Error('Website returned an unsupported content type');
    return { url: safeUrl.toString(), text: Buffer.from(response.data).toString('utf8'), contentType };
}

export function discoveryPriority(url: string): number {
    const type = classifyPageUrl(url);
    if (type === 'PRODUCT') return 1;
    if (['CONTACT','FAQ','DELIVERY','PAYMENT','COD','RETURN','ABOUT','STORE_LOCATION','TERMS','POLICY','BUSINESS_INFO'].includes(type)) return 2;
    if (type === 'COLLECTION') return 3;
    if (type === 'CATEGORY') return 4;
    if (type === 'IGNORE') return 9;
    return 5;
}

const businessUrlHints: Record<string, string[]> = {
    VISA_CONSULTANCY: ['visa', 'country', 'document', 'eligibility', 'consultation', 'appointment'],
    EDUCATION_CONSULTANCY: ['country', 'university', 'program', 'intake', 'admission', 'scholarship'],
    EDTECH: ['course', 'batch', 'class', 'subject', 'teacher', 'schedule', 'enroll'],
    AGENCY: ['service', 'package', 'portfolio', 'pricing', 'quote'], REAL_ESTATE: ['property', 'listing', 'apartment', 'flat', 'rent', 'sale'],
    CLINIC_SERVICE: ['service', 'doctor', 'specialist', 'appointment', 'clinic'], RESTAURANT: ['menu', 'food', 'delivery', 'reservation'],
    SAAS: ['plan', 'pricing', 'feature', 'integration', 'trial', 'support'], OTHER: ['service', 'offering', 'about', 'faq'],
};

export function selectDiscoveryLinks(urls: string[], limit: number, businessType?: string): string[] {
    const unique = [...new Set(urls.map((url) => canonicalUrl(url)).filter(Boolean) as string[])];
    const usable = unique.filter((url) => discoveryPriority(url) < 9);
    const products = usable.filter((url) => discoveryPriority(url) === 1);
    const knowledge = usable.filter((url) => discoveryPriority(url) === 2);
    const categories = usable.filter((url) => [3, 4].includes(discoveryPriority(url))).sort((a, b) => discoveryPriority(a) - discoveryPriority(b));
    const other = usable.filter((url) => discoveryPriority(url) === 5);
    const hints = businessUrlHints[String(businessType || '').toUpperCase()] || [];
    const businessRelevant = hints.length ? usable.filter((url) => hints.some((hint) => decodeURIComponent(url).toLowerCase().includes(hint))) : [];
    const selected = [
        ...businessRelevant.slice(0, Math.max(1, Math.ceil(limit * 0.6))),
        ...products.slice(0, Math.max(1, Math.ceil(limit * 0.55))),
        ...knowledge.slice(0, Math.max(1, Math.ceil(limit * 0.25))),
        ...categories.slice(0, Math.max(1, Math.ceil(limit * 0.2))),
    ];
    const remainder = [...products, ...knowledge, ...categories, ...other].filter((url) => !selected.includes(url));
    return [...new Set([...selected, ...remainder])].slice(0, limit);
}

export async function ingestWebsite(input: string, onProgress?: (stage: string, progress: number, stats?: { discovered: number; pages: number; productUrls: number; remaining: number; failed: number; fetches: number }) => Promise<void>, options?: { previousPages?: Array<{ url: string; fingerprint?: string; status?: string }>; retryUrls?: string[]; businessType?: string }): Promise<WebsiteExtraction> {
    const startedAt = Date.now();
    const start = await validatePublicUrl(input);
    const origin = start.origin;
    const retryUrls = uniqueUrls(options?.retryUrls || []).filter((url) => new URL(url).origin === origin);
    const queue = retryUrls.length ? [...retryUrls] : [start.toString()];
    const seen = new Set<string>();
    const result: WebsiteExtraction = { pages: 0, products: [], knowledge: [], business: {}, warnings: [] };
    const disallowed: string[] = [];
    const sitemapSeeds: string[] = [];
    let fetches = 0;
    let unchanged = 0; let changed = 0; let newPages = 0;
    const previous = new Map((options?.previousPages || []).map((page) => [canonicalUrl(page.url), page.fingerprint]));
    const previousStatus = new Map((options?.previousPages || []).map((page) => [canonicalUrl(page.url), page.status]));
    const pageStates: NonNullable<WebsiteExtraction['crawl']>['pages'] = [];
    try {
        const robots = await fetchPublicText(new URL('/robots.txt', origin).toString());
        let applies = false;
        for (const rawLine of robots.text.split(/\r?\n/)) {
            const line = rawLine.split('#')[0].trim();
            if (/^user-agent\s*:/i.test(line)) applies = /^user-agent\s*:\s*\*/i.test(line);
            else if (/^sitemap\s*:/i.test(line)) {
                const value = line.replace(/^sitemap\s*:/i, '').trim();
                if (value) sitemapSeeds.push(value);
            }
            else if (applies && /^disallow\s*:/i.test(line)) {
                const path = line.replace(/^disallow\s*:/i, '').trim();
                if (path) disallowed.push(path);
            }
        }
        if (disallowed.includes('/')) throw new WebsiteIngestionError('BLOCKED', 'This website does not allow automated access.');
    } catch (error) {
        if (error instanceof WebsiteIngestionError) throw error;
    }
    await onProgress?.(retryUrls.length ? 'Retrying failed pages' : 'Connecting', 8);
    for (const endpoint of retryUrls.length ? [] : ['/products.json?limit=250', '/wp-json/wc/store/v1/products?per_page=100']) {
        try {
            const feed = await fetchPublicText(new URL(endpoint, origin).toString());
            const parsed = JSON.parse(feed.text);
            const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [];
            for (const row of rows.slice(0, 500)) {
                const shopify = Boolean(row.title || row.body_html);
                const feedCurrency = normalizeCurrency(row.prices?.currency_code, row.currency);
                const variants = (row.variants || []).map((variant: any) => ({ name: variant.title || 'Variant', sku: variant.sku, price: normalizeMoney(variant.price), currency: normalizeCurrency(variant.currency, feedCurrency), stock: Number.isFinite(variant.inventory_quantity) ? Math.max(0, variant.inventory_quantity) : undefined, availability: Number.isFinite(variant.inventory_quantity) ? normalizeProductAvailability(undefined, variant.inventory_quantity) : 'unknown', images: [], specs: {} }));
                const minorUnit = Number(row.prices?.currency_minor_unit || 0);
                const rawPrice = row.prices?.price !== undefined ? Number(row.prices.price) / Math.pow(10, minorUnit) : undefined;
                const name = String(row.name || row.title || '').trim();
                const price = normalizeMoney(rawPrice ?? variants[0]?.price);
                if (!name || price === undefined) continue;
                const images = (row.images || []).map((image: any) => absolute(image.src || image.thumbnail || image, origin)).filter(Boolean) as string[];
                result.products.push({ name, description: cheerio.load(String(row.description || row.short_description || row.body_html || '')).text().trim(), category: row.categories?.[0]?.name || row.product_type,
                    basePrice: price, currency: feedCurrency || variants[0]?.currency, sku: row.sku || variants[0]?.sku, brand: row.vendor, canonicalUrl: canonicalUrl(row.permalink || (shopify && row.handle ? new URL(`/products/${row.handle}`, origin).toString() : undefined)),
                    images, stock: row.is_in_stock === false ? 0 : undefined, availability: row.is_in_stock === false ? 'out_of_stock' : 'unknown', variants, specs: {},
                });
            }
            if (result.products.length) break;
        } catch { /* not this ecommerce platform */ }
    }
    const sitemapQueue = retryUrls.length ? [] : [...new Set([...sitemapSeeds, new URL('/sitemap.xml', origin).toString()])];
    const seenSitemaps = new Set<string>();
    const discovered = new Set<string>(retryUrls.length ? queue : [...queue, ...(options?.previousPages || []).map((page) => page.url)]);
    while (sitemapQueue.length && seenSitemaps.size < 20 && discovered.size < MAX_DISCOVERED) {
        const sitemapUrl = sitemapQueue.shift()!;
        if (seenSitemaps.has(sitemapUrl)) continue;
        seenSitemaps.add(sitemapUrl);
        try {
            const sitemap = await fetchPublicText(sitemapUrl); fetches += 1;
            const urls = [...sitemap.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
            for (const url of urls) {
                try {
                    if (new URL(url).origin !== origin) continue;
                    if (/\.xml(?:$|\?)/i.test(new URL(url).pathname)) sitemapQueue.push(url);
                    else if (classifyPageUrl(url) !== 'IGNORE' && discovered.size < MAX_DISCOVERED) discovered.add(url);
                } catch { /* ignore malformed sitemap entries */ }
            }
        } catch { /* try the next sitemap or link discovery */ }
    }
    if (discovered.size === 1) result.warnings.push('Sitemap was unavailable; discovered pages from website links instead.');
    if (!retryUrls.length) {
        const ordered = selectDiscoveryLinks([...discovered].filter((url) => url !== start.toString()), MAX_DISCOVERED, options?.businessType);
        const unprocessed = ordered.filter((url) => !previous.has(canonicalUrl(url)) || ['pending','failed'].includes(previousStatus.get(canonicalUrl(url)) || ''));
        const firstBatch = selectDiscoveryLinks(unprocessed.length ? unprocessed : ordered, MAX_PAGES, options?.businessType);
        queue.push(...firstBatch, ...ordered.filter((url) => !firstBatch.includes(url)));
    }
    while (queue.length && seen.size < MAX_PAGES) {
        const next = canonicalUrl(queue.shift());
        if (!next || seen.has(next) || new URL(next).origin !== origin) continue;
        if (disallowed.some((path) => new URL(next).pathname.startsWith(path))) continue;
        seen.add(next);
        await onProgress?.(seen.size === 1 ? 'Discovering pages' : classifyPageUrl(next) === 'PRODUCT' ? 'Reading products' : 'Reading business information', Math.min(80, 10 + seen.size * (65 / MAX_PAGES)), {
            discovered: discovered.size, pages: result.pages, productUrls: [...discovered].filter((url) => classifyPageUrl(url) === 'PRODUCT').length,
            remaining: Math.max(0, discovered.size - seen.size), failed: pageStates.filter((page) => page.status === 'failed').length, fetches,
        });
        try {
            const page = await fetchPublicText(next); fetches += 1;
            const fingerprint = pageContentFingerprint(page.text);
            const oldFingerprint = previous.get(next);
            if (oldFingerprint && oldFingerprint === fingerprint) {
                unchanged += 1; result.pages += 1;
                pageStates.push({ url: next, fingerprint, pageType: classifyPageUrl(next), status: 'unchanged', lastSeenAt: new Date() });
                continue;
            }
            if (oldFingerprint) changed += 1; else newPages += 1;
            const extracted = extractFromHtml(page.text, page.url);
            result.pages += 1;
            pageStates.push({ url: next, fingerprint, pageType: classifyPageUrl(next), status: 'processed', lastSeenAt: new Date() });
            result.products.push(...extracted.products);
            result.knowledge.push(...extracted.knowledge);
            Object.assign(result.business, Object.fromEntries(Object.entries(extracted.business).filter(([, value]) => value)));
            const links = extracted.links.filter((url) => { try { return new URL(url).origin === origin; } catch { return false; } });
            for (const link of selectDiscoveryLinks(links, MAX_DISCOVERED, options?.businessType)) {
                if (discovered.size >= MAX_DISCOVERED) break;
                if (!discovered.has(link)) { discovered.add(link); queue.push(link); }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'could not be read';
            result.warnings.push(`${new URL(next).pathname}: ${message}`);
            pageStates.push({ url: next, pageType: classifyPageUrl(next), status: 'failed', error: message, lastSeenAt: new Date() });
        }
    }
    if (!result.pages) {
        const failures = result.warnings.join(' ').toLowerCase();
        if (/timeout|econnaborted|timed out/.test(failures)) throw new WebsiteIngestionError('TIMEOUT', 'The website did not respond in time.');
        if (/403|401|forbidden|robots|blocked/.test(failures)) throw new WebsiteIngestionError('BLOCKED', 'The website blocked automated access.');
        if (/enotfound|econnrefused|network|socket|dns/.test(failures)) throw new WebsiteIngestionError('UNREACHABLE', 'The website could not be reached.');
        throw new WebsiteIngestionError('CRAWLER_FAILURE', 'No accessible website pages were found.');
    }
    if (!result.products.length && !result.knowledge.length && !Object.values(result.business).some(Boolean) && !unchanged) throw new WebsiteIngestionError('CRAWLER_FAILURE', 'The website was reachable, but no useful business information was found.');
    const remaining = [...discovered].filter((url) => !seen.has(canonicalUrl(url) || '')).length;
    const stateUrls = new Set(pageStates.map((page) => canonicalUrl(page.url)));
    for (const url of discovered) {
        const normalized = canonicalUrl(url);
        if (!normalized || stateUrls.has(normalized)) continue;
        pageStates.push({ url: normalized, fingerprint: previous.get(normalized), pageType: classifyPageUrl(normalized), status: 'pending', lastSeenAt: new Date() });
    }
    result.crawl = {
        discovered: discovered.size,
        productUrls: [...discovered].filter((url) => classifyPageUrl(url) === 'PRODUCT').length,
        processed: result.pages, remaining, failed: result.warnings.filter((warning) => warning.startsWith('/')).length,
        fetches, aiCalls: 0, pagesWithoutAI: result.pages, unchanged, changed, newPages, durationMs: Date.now() - startedAt, pages: pageStates,
    };
    await onProgress?.('Organizing information', 85);
    return result;
}
