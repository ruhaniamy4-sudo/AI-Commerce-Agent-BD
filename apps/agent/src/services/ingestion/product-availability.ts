export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'unknown';

export function normalizeProductAvailability(value: unknown, stock?: unknown): ProductAvailability {
    const text = String(value || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (text.includes('outofstock') || text.includes('soldout') || text.includes('unavailable') || text.includes('discontinued')) return 'out_of_stock';
    if (text.includes('instock') || text.includes('available')) return 'in_stock';
    const quantity = typeof stock === 'number' ? stock : Number(stock);
    if (Number.isFinite(quantity)) return quantity > 0 ? 'in_stock' : 'out_of_stock';
    return 'unknown';
}
