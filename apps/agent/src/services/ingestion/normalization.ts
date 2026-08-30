import crypto from 'node:crypto';

export function normalizedText(value: unknown): string {
    return String(value ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/৳|tk\.?|taka/gi, ' bdt ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function canonicalUrl(value?: string): string | undefined {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        url.hash = '';
        for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
        }
        url.hostname = url.hostname.toLowerCase();
        if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
        return url.toString();
    } catch {
        return undefined;
    }
}

export function stableFingerprint(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function normalizeSku(value?: unknown): string | undefined {
    const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
    return normalized || undefined;
}

export function normalizeMoney(value: unknown): number | undefined {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined;
    const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function productKey(product: Record<string, any>): string {
    const sku = normalizeSku(product.sku || product.variants?.[0]?.sku);
    if (sku) return `sku:${sku}`;
    if (product.barcode) return `barcode:${normalizedText(product.barcode)}`;
    const url = canonicalUrl(product.canonicalUrl || product.url);
    if (url) return `url:${url}`;
    return `name:${normalizedText(product.name)}|price:${normalizeMoney(product.basePrice ?? product.price) ?? ''}`;
}

export function knowledgeFact(value: unknown): string {
    return normalizedText(value)
        .replace(/inside dhaka|within dhaka|dhaka city|ঢাকার ভিতরে|ঢাকার মধ্যে/g, ' dhaka inside ')
        .replace(/delivery (fee|charge)|shipping (fee|charge)|ডেলিভারি চার্জ/g, ' delivery charge ')
        .replace(/\bdhaka\b(?!\s+inside)/g, 'dhaka inside')
        .replace(/\b(bdt|taka|tk)\s*(\d+)/g, '$2 bdt')
        .replace(/\b(\d+)\s+(bdt|taka|tk)\b/g, '$1 bdt')
        .replace(/\b(is|the|a|an)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function tokenSimilarity(left: string, right: string): number {
    const a = new Set(normalizedText(left).split(' ').filter(Boolean));
    const b = new Set(normalizedText(right).split(' ').filter(Boolean));
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter((value) => b.has(value)).length;
    return intersection / (a.size + b.size - intersection);
}

export function classifyProductSimilarity(left: Record<string, any>, right: Record<string, any>): 'exact' | 'probable' | 'different' {
    const leftSku = normalizeSku(left.sku || left.variants?.[0]?.sku);
    const rightSku = normalizeSku(right.sku || right.variants?.[0]?.sku);
    if (leftSku && rightSku && leftSku === rightSku) return 'exact';
    if (left.barcode && right.barcode && normalizedText(left.barcode) === normalizedText(right.barcode)) return 'exact';
    const leftUrl = canonicalUrl(left.canonicalUrl || left.url);
    const rightUrl = canonicalUrl(right.canonicalUrl || right.url);
    if (leftUrl && rightUrl && leftUrl === rightUrl) return 'exact';
    const similarity = tokenSimilarity(left.name, right.name);
    const leftTokens = new Set(normalizedText(left.name).split(' ').filter(Boolean));
    const rightTokens = new Set(normalizedText(right.name).split(' ').filter(Boolean));
    const contained = [...leftTokens].filter((value) => rightTokens.has(value)).length / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
    const leftPrice = normalizeMoney(left.basePrice ?? left.price);
    const rightPrice = normalizeMoney(right.basePrice ?? right.price);
    const priceClose = leftPrice !== undefined && rightPrice !== undefined && Math.abs(leftPrice - rightPrice) <= Math.max(10, leftPrice * 0.05);
    return (similarity >= 0.72 || contained >= 0.8) && priceClose ? 'probable' : 'different';
}
