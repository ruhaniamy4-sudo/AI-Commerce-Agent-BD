export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown';

export const SEMANTIC_AVAILABILITY = {
    IN_STOCK: 'in_stock' as const,
    OUT_OF_STOCK: 'out_of_stock' as const,
    PREORDER: 'preorder' as const,
    UNKNOWN: 'unknown' as const,
};

/**
 * Normalizes product availability semantically without inventing quantity.
 *
 * Rules:
 * - If value or text indicates preorder -> 'preorder'
 * - If value or text indicates out of stock / sold out -> 'out_of_stock'
 * - If value or text indicates in stock / available -> 'in_stock'
 * - If explicit numeric stock quantity is provided (not null/undefined/empty):
 *     quantity > 0 -> 'in_stock'
 *     quantity === 0 -> 'out_of_stock'
 * - Missing/null stock with NO out-of-stock signal -> DOES NOT become out_of_stock!
 *     Returns 'unknown' if no signals, or 'in_stock' if page said available.
 */
export function normalizeProductAvailability(value: unknown, stock?: unknown): ProductAvailability {
    const text = String(value || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (text.includes('preorder') || text.includes('pre-order')) return 'preorder';
    if (text.includes('outofstock') || text.includes('soldout') || text.includes('unavailable') || text.includes('discontinued')) {
        return 'out_of_stock';
    }
    // If explicit stock is 0, that overrides positive text signals (e.g. template says "In stock" but inventory is 0)
    if (stock !== null && stock !== undefined && stock !== '') {
        const parsed = typeof stock === 'number' ? stock : Number(stock);
        if (Number.isFinite(parsed) && parsed <= 0) {
            return 'out_of_stock';
        }
    }

    if (text.includes('instock') || text.includes('available')) {
        return 'in_stock';
    }

    // Inspect positive stock if no explicit text signal
    if (stock !== null && stock !== undefined && stock !== '') {
        const parsed = typeof stock === 'number' ? stock : Number(stock);
        if (Number.isFinite(parsed)) {
            return parsed > 0 ? 'in_stock' : 'out_of_stock';
        }
    }

    return 'unknown';
}

/**
 * Determines if a product is commercially available for customer recommendation/ordering.
 * Grounded rule: in_stock with stock === null/undefined IS available.
 * Preorder products are also available.
 * Only out_of_stock or explicit stock <= 0 (when not preorder) is unavailable.
 */
export function isProductAvailable(product: { availability?: string; stock?: number | null }): boolean {
    if (product.availability === 'out_of_stock') return false;
    if (product.availability === 'preorder') return true;
    if (typeof product.stock === 'number' && product.stock <= 0) return false;
    if (product.availability === 'in_stock') return true;
    if (typeof product.stock === 'number' && product.stock > 0) return true;
    return false;
}
