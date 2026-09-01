const symbols: Record<string, string> = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹' };

export function formatCurrency(amount: number, currency = 'BDT') {
    const code = String(currency || 'BDT').toUpperCase();
    const formatted = Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return symbols[code] ? `${symbols[code]}${formatted}` : `${code} ${formatted}`;
}

export function stockLabel(product: { stock?: number | null; availability?: string }) {
    if (product.availability === 'out_of_stock') return 'Out of Stock';
    if (product.availability === 'preorder') return 'Preorder';
    if (typeof product.stock === 'number') return product.stock === 0 ? '0 units' : `${product.stock} units`;
    if (product.availability === 'in_stock') return 'In Stock';
    return 'Stock unknown';
}
