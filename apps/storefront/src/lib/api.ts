import { PaginatedResponse, Product } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const BUSINESS_CHANNEL_ID = process.env.NEXT_PUBLIC_BUSINESS_CHANNEL_ID || 'storefront';
const CATALOG_URL = `${API_BASE_URL}/public/${encodeURIComponent(BUSINESS_CHANNEL_ID)}`;

export async function getFeaturedProducts(): Promise<Product[]> {
    try {
        const res = await fetch(`${CATALOG_URL}/products?limit=8`, {
            next: { revalidate: 60 } // Cache for 60s
        });
        if (!res.ok) return [];
        const data: PaginatedResponse<Product> = await res.json();
        return data.data;
    } catch (e) {
        console.error("Failed to fetch products", e);
        return [];
    }
}

export async function getProduct(slug: string): Promise<Product | null> {
    try {
        const res = await fetch(`${CATALOG_URL}/products/${slug}`, {
            next: { revalidate: 60 }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("Failed to fetch product", e);
        return null;
    }
}
