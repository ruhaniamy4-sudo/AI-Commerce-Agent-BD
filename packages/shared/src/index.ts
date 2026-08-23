export type ID = string;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AgentStatusResponse {
  status: 'active' | 'paused' | 'stopped' | string;
  lastHumanActivity?: number;
  lastActivity?: string;
  autoStartRule?: { enabled: boolean; inactivityMinutes: number };
}

export interface ProductVariant {
  variantId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  images: string[];
  specs?: Record<string, unknown>;
  isActive: boolean;
}

export interface Product {
  _id: ID;
  name: string;
  slug: string;
  description: string;
  categoryId: ID;
  basePrice: number;
  stock: number;
  variants: ProductVariant[];
  specs: Record<string, unknown>;
  compatibilityTags: string[];
  images: string[];
  warrantyMonths: number;
  isReturnable: boolean;
  returnDays?: number;
  isActive: boolean;
  isFeatured: boolean;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: ID;
  name: string;
  slug: string;
  description?: string;
  parentId?: ID | null;
  image?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  label?: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  zone: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export interface Customer {
  _id: ID;
  psid: string;
  name?: string;
  phone?: string;
  email?: string;
  language: 'en' | 'bn' | 'hi';
  addresses: CustomerAddress[];
  tags: string[];
  notes?: string;
  lastMessageAt?: string;
  totalOrders: number;
  totalSpent: number;
  optedOut: boolean;
  metadata?: Record<string, unknown>;
  city?: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationIntent =
  | 'product_inquiry'
  | 'order'
  | 'status_check'
  | 'return_warranty'
  | 'handoff'
  | 'general'
  | 'unknown';

export interface Conversation {
  _id: ID;
  conversationId: string;
  customerId?: ID | Customer;
  customer?: Customer;
  psid?: string;
  platform: 'facebook' | 'whatsapp' | 'web-widget' | 'telegram' | 'instagram' | 'manual';
  aiEnabled: boolean;
  needsHumanHandoff: boolean;
  handoffReason?: string;
  status: 'active' | 'archived' | 'resolved' | 'spam';
  assignedTo?: string;
  currentIntent?: ConversationIntent;
  metadata: Record<string, unknown>;
  messageCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: ID;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: 'text' | 'image' | 'file' | 'audio' | 'video';
  attachments?: Array<{ url?: string; type?: string; filename?: string; size?: number }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Knowledge {
  _id: ID;
  title: string;
  content: string;
  type: 'FAQ' | 'POLICY' | 'GUIDE' | 'TROUBLESHOOT' | 'COMPATIBILITY';
  language: 'en' | 'bn' | 'hi';
  tags: string[];
  status: 'active' | 'inactive';
  sourcePriority: 'high' | 'normal' | 'low';
  createdBy: string;
  updatedBy: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: ID | Product;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  quantity: number;
  unitPriceSnapshot: number;
  subtotal: number;
}

export interface OrderAddress extends CustomerAddress {}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export interface Order {
  _id: ID;
  orderNumber: string;
  invoiceNumber?: string;
  customerId: ID | Customer;
  psid?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  shippingAddress: OrderAddress;
  shippingMethod: 'standard' | 'express' | 'overnight';
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  status: OrderStatus;
  statusHistory: Array<{ status: OrderStatus; timestamp: string; note?: string }>;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  trackingNumber?: string;
  courier?: string;
  customerNote?: string;
  adminNote?: string;
  source: 'messenger' | 'web' | 'admin';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
