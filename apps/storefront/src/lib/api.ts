import { PaginatedResponse, Product } from "./types";
import {visitToken} from './tracking';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4000";
const BUSINESS_CHANNEL_ID =
  process.env.NEXT_PUBLIC_BUSINESS_CHANNEL_ID || "storefront";
const CATALOG_URL = `${API_BASE_URL}/public/${encodeURIComponent(BUSINESS_CHANNEL_ID)}`;

export interface StoreSettings {
  name: string;
  description?: string;
  storeEnabled: boolean;
  currency: "BDT";
  paymentMethods: string[];
  deliveryFees: { insideDhaka: number; outsideDhaka: number };
  deliveryPolicy?: string;
  returnPolicy?: string;
  salesChannel?: string;
  storefront?: {
    primaryColor: string;
    accentColor: string;
    heroTitle: string;
    heroSubtitle?: string;
    layout: "grid" | "editorial";
  };
}

export interface CheckoutPayload {
  customer: { fullName: string; phone: string };
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    zone?: string;
  };
  paymentMethod: string;
  customerNote?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
}

export interface CheckoutResult {
  orderNumber: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: "BDT";
  paymentMethod: string;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const response = await fetch(`${CATALOG_URL}/store`, { cache: "no-store" });
  if (!response.ok) throw new Error("Store settings are unavailable");
  return response.json();
}

export async function submitCheckout(
  payload: CheckoutPayload,
  idempotencyKey: string,
): Promise<CheckoutResult> {
  const response = await fetch(`${CATALOG_URL}/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({...payload,visitToken:visitToken()}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not place the order");
  return body;
}

export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${CATALOG_URL}/products?limit=8`, {
      next: { revalidate: 60 }, // Cache for 60s
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
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Failed to fetch product", e);
    return null;
  }
}
