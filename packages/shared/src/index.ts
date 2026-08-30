export type ID = string;
export type BusinessRole = 'Owner' | 'Admin' | 'Staff';
export const PASSWORD_MIN_LENGTH = 8;

export const TEST_AI_API = {
  base: '/api/test-ai',
  currentConversation: '/conversations/current',
  currentMessages: '/conversations/current/messages',
  conversations: '/conversations',
} as const;

export interface TenantEntity {
  businessId: ID;
}

export interface Business {
  _id: ID;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
}

export interface User {
  _id: ID;
  name: string;
  email: string;
  status: 'active' | 'disabled';
}

export interface BusinessMember {
  _id: ID;
  businessId: ID;
  userId: ID | User;
  role: BusinessRole;
  status: 'active' | 'invited' | 'disabled';
}

export interface BusinessChannel {
  _id: ID;
  businessId: ID;
  platform: 'facebook' | 'web';
  externalId: string;
  name: string;
  status: 'active' | 'disabled';
}

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

export type ProductImageSource = 'local' | 'managed' | 'external' | 'invalid' | 'missing';
export function classifyProductImageSource(value?: string | null): ProductImageSource {
  const source = String(value || '').trim();
  if (!source) return 'missing';
  if (source.startsWith('/') && !source.startsWith('//')) return 'local';
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol)) return 'invalid';
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' ? 'managed' : 'external';
  } catch { return 'invalid'; }
}

export interface Product extends TenantEntity {
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
  imageImports?: Array<{ sourceUrl: string; managedUrl?: string; status: 'managed' | 'mirrored' | 'external_fallback'; errorCode?: string }>;
  warrantyMonths: number;
  isReturnable: boolean;
  returnDays?: number;
  isActive: boolean;
  isFeatured: boolean;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category extends TenantEntity {
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

export interface Customer extends TenantEntity {
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

export interface Conversation extends TenantEntity {
  _id: ID;
  conversationId: string;
  customerId?: ID | Customer;
  customer?: Customer;
  psid?: string;
  platform: 'facebook' | 'whatsapp' | 'web-widget' | 'telegram' | 'instagram' | 'manual';
  aiEnabled: boolean;
  needsHumanHandoff: boolean;
  controlMode: 'AI_ACTIVE' | 'HUMAN_ACTIVE';
  summary?: string;
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

export interface Message extends TenantEntity {
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

export interface Knowledge extends TenantEntity {
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

export type TrainingStatus = 'not_started' | 'learning' | 'needs_review' | 'ready' | 'syncing' | 'error';
export interface TrainingSource extends TenantEntity {
  _id: ID; type: 'website' | 'facebook' | 'file' | 'manual'; name: string; url?: string; externalId?: string;
  status: 'connected' | 'learning' | 'ready' | 'needs_attention' | 'error'; lastSyncedAt?: string;
  errorCode?: string; errorMessage?: string;
  stats: { pages: number; discovered: number; productUrls: number; remaining: number; failed: number; fetches: number; aiCalls: number; pagesWithoutAI: number; unchanged: number; changed: number; newPages: number; durationMs: number; products: number; knowledge: number; duplicates: number; conflicts: number; needsAttention: number };
}
export interface TrainingRun extends TenantEntity {
  _id: ID; sourceId: ID; status: 'queued' | 'learning' | 'needs_review' | 'ready' | 'partial' | 'error';
  stage: string; progress: number; errorMessage?: string;
  stats: { pages: number; discovered: number; productUrls: number; remaining: number; failed: number; fetches: number; aiCalls: number; pagesWithoutAI: number; unchanged: number; changed: number; newPages: number; durationMs: number; products: number; knowledge: number; duplicates: number; conflicts: number; needsAttention: number };
}
export interface TrainingCandidate extends TenantEntity {
  _id: ID; kind: 'product' | 'knowledge' | 'business';
  status: 'ready' | 'possible_duplicate' | 'conflict' | 'needs_attention' | 'approved' | 'rejected' | 'imported';
  title: string; confidence: number; payload: Record<string, any>; duplicateKind?: 'exact' | 'probable';
  conflictFields: Array<{ field: string; currentValue: unknown; importedValue: unknown }>;
  source: { type: string; url?: string; externalId?: string; lastSeenAt: string };
}
export interface TrainingOverview {
  training: { status: TrainingStatus; lastSyncedAt?: string; productsImported?: number; knowledgeImported?: number; needsReview?: number };
  sources: TrainingSource[]; latestRun: TrainingRun | null; candidateCounts: Record<string, number>;
  suggestedQuestions: string[]; missing: string[];
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

export type ShipmentStatus =
  | 'pending'
  | 'submitted'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'failed'
  | 'unknown';

export interface OrderCourier {
  provider: 'steadfast';
  externalId: string;
  consignmentId?: string;
  trackingCode?: string;
  status: ShipmentStatus;
  rawStatus?: string;
  creationStatus: 'creating' | 'created' | 'failed' | 'uncertain';
  createdAt?: string;
  lastSyncedAt?: string;
  error?: { code: string; message: string; at: string };
}

export interface Order extends TenantEntity {
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
  courier?: OrderCourier;
  customerNote?: string;
  adminNote?: string;
  source: 'messenger' | 'web' | 'admin';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
