import mongoose from 'mongoose';
import { deriveProductCode, Product } from '../models/Product';
import { parseSearchTerms } from './turn-routing.service';

/**
 * Catalog presentation primitives shared by the zero-LLM answer paths and the
 * chat order flow. One definition of "what a product costs and whether it can be
 * sold" keeps the quoted price, the listed price and the charged price identical.
 */

export interface CompactProductCard { id: string; code: string; sku?: string; name: string; price: number; currency: string; salePrice?: number; availability: string; stock?: number | null; image?: string; relevantVariant?: { id: string; name: string; price: number; currency: string; availability: string; stock?: number | null; image?: string }; }

export const PRODUCT_CARD_FIELDS = 'aiSellingStatus aiKnowledge name publicCode barcode slug basePrice salePrice currency stock availability variants images specs brand categoryId isFeatured';

export const COLOR_WORDS: Record<string, string> = {
    'black': 'Black', 'kalo': 'Black', 'কালো': 'Black',
    'white': 'White', 'shada': 'White', 'সাদা': 'White',
    'blue': 'Blue', 'nil': 'Blue', 'neel': 'Blue', 'নীল': 'Blue',
    'navy': 'Navy', 'red': 'Red', 'lal': 'Red', 'লাল': 'Red',
    'green': 'Green', 'sobuj': 'Green', 'সবুজ': 'Green',
    'yellow': 'Yellow', 'holud': 'Yellow', 'হলুদ': 'Yellow',
    'grey': 'Grey', 'gray': 'Grey', 'dhusor': 'Grey', 'ধূসর': 'Grey',
    'maroon': 'Maroon', 'মেরুন': 'Maroon',
    'pink': 'Pink', 'golapi': 'Pink', 'গোলাপি': 'Pink',
    'purple': 'Purple', 'beguni': 'Purple', 'বেগুনি': 'Purple',
    'orange': 'Orange', 'komla': 'Orange', 'কমলা': 'Orange',
    'brown': 'Brown', 'badami': 'Brown', 'বাদামি': 'Brown',
    'olive': 'Olive', 'beige': 'Beige',
};

export function escaped(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function requestedSku(text: string) {
    const explicit = text.match(/\bsku\s*[:#-]?\s*([a-z0-9-]{3,})\b/i)?.[1];
    if (explicit) return explicit;
    // A customer quoting a code from a product list ("MUG-9F2A ta nibo").
    const code = text.match(/(?<![A-Za-z0-9-])([A-Za-z]{2,12}-[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{1,6})?)(?![A-Za-z0-9-])/)?.[1];
    if (code) return code;
    const adjacent = text.match(/\b(?:stock|price)\s+([a-z0-9-]{3,})\b/i)?.[1];
    return adjacent && /\d/.test(adjacent) && /-/.test(adjacent) ? adjacent : undefined;
}

/**
 * The code a customer can quote back to order. A specific variant answers with
 * the merchant's own SKU; otherwise the product's stable public code.
 */
export function productCode(product: any, variant?: any) {
    return String(variant?.sku || product?.publicCode || product?.barcode || deriveProductCode(product?.name, product?._id)).toUpperCase();
}

/** Reply in the customer's own script: Bangla, Banglish, or English. */
export function say(language: string, texts: { en: string; bn: string; banglish: string }) {
    return language === 'en' ? texts.en : language === 'bn' ? texts.bn : texts.banglish;
}

export function money(amount: number, currency: string) { const symbol = ({ BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹' } as Record<string, string>)[currency]; return symbol ? `${symbol}${amount}` : `${currency} ${amount}`; }

export function card(product: any, text = ''): CompactProductCard {
    const terms = parseSearchTerms(text);
    const colorWord = terms.find((word) => COLOR_WORDS[word.toLowerCase()]);
    const color = colorWord ? COLOR_WORDS[colorWord.toLowerCase()].toLowerCase() : undefined;
    const sku = requestedSku(text);
    const variant = sku
        ? (product.variants || []).find((item: any) => String(item.sku).toLowerCase() === sku.toLowerCase())
        : color ? (product.variants || []).find((item: any) => String(item.name || '').toLowerCase().includes(color) || String(item.sku || '').toLowerCase().includes(color)) : undefined;
    const availability = product.aiSellingStatus==='limited' ? (typeof (variant?variant.stock:product.stock)==='number'?((variant?variant.stock:product.stock)>0?'in_stock':'out_of_stock'):'unknown') : variant ? (variant.availability || (typeof variant.stock === 'number' ? (variant.stock > 0 ? 'in_stock' : 'out_of_stock') : 'unknown')) : (product.availability || (typeof product.stock === 'number' ? (product.stock > 0 ? 'in_stock' : 'out_of_stock') : 'unknown'));
    const currency = String(variant?.currency || product.currency || 'BDT').toUpperCase();
    return { id: String(product._id), code: productCode(product, variant), sku: variant?.sku || product.variants?.[0]?.sku, name: product.name, price: product.salePrice ?? variant?.price ?? product.basePrice, currency, salePrice: product.salePrice, availability, stock: variant ? variant.stock : product.stock, image: variant?.images?.[0] || product.images?.[0], relevantVariant: variant ? { id: variant.variantId, name: variant.name, price: product.salePrice ?? variant.price, currency, availability, stock: variant.stock, image: variant.images?.[0] } : undefined };
}

export function cardLines(cards: CompactProductCard[], language: string) {
    return cards.map((item, index) => {
        const soldOut = item.availability === 'out_of_stock' ? (language === 'en' ? ' - out of stock' : language === 'bn' ? ' - stock নেই' : ' - stock nei') : '';
        return `${index + 1}. ${item.name}, ${item.code}, ${money(item.price, item.currency)}${soldOut}`;
    }).join('\n');
}

export function termPredicate(term: string) {
    const pattern = escaped(term);
    return { $or: [
        { name: { $regex: pattern, $options: 'i' } }, { brand: { $regex: pattern, $options: 'i' } },
        { slug: { $regex: pattern, $options: 'i' } }, { aliases: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } }, { 'variants.sku': { $regex: pattern, $options: 'i' } },
        { 'variants.name': { $regex: pattern, $options: 'i' } },
        { compatibilityTags: { $regex: pattern, $options: 'i' } }, { 'intelligence.terms': { $regex: pattern, $options: 'i' } },
        { publicCode: { $regex: pattern, $options: 'i' } }, { barcode: { $regex: pattern, $options: 'i' } },
    ] };
}


export function termMatchScore(product: any, terms: string[]) {
    const name = String(product.name || '').toLowerCase();
    const rest = [product.brand, product.slug, product.description, ...(product.aliases || []), ...(product.compatibilityTags || []), ...((product.variants || []).map((variant: any) => `${variant.name} ${variant.sku}`))].join(' ').toLowerCase();
    return terms.reduce((score, term) => score + (name.includes(term) ? 3 : rest.includes(term) ? 1 : 0), 0);
}

export function sellable(product: any) {
    if (product.availability === 'out_of_stock') return false;
    if (typeof product.stock === 'number' && product.stock <= 0) return (product.variants || []).some((variant: any) => variant.isActive !== false && Number(variant.stock ?? 0) > 0);
    return true;
}

export function availableVariant(product: any) {
    return (product.variants || []).find((variant: any) => variant.isActive !== false && variant.availability !== 'out_of_stock' && (typeof variant.stock !== 'number' || variant.stock > 0));
}

export function catalogQueryable() { return mongoose.connection.readyState === 1 || Boolean((Product.find as any)?.mock); }
