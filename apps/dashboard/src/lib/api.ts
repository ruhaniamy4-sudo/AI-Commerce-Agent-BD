import type {
  AgentStatusResponse,
  Conversation,
  Knowledge,
  Message,
  PaginatedResponse,
  SystemPrompt,
  Product,
  Category,
  Order,
  OrderItem,
  Customer,
  Meeting,
  AvailabilitySettings,
  MeetingHost,
  UnansweredQuestion,
  AnalyticsResponse,
  ErrorLog,
} from "@/types";
import type {
  TrainingCandidate,
  TrainingOverview,
  TrainingRun,
  TrainingSource,
} from "@/types";
import { apiClient } from "./api-client";
import type { SubscriptionPlan, Subscription } from "./platform-api";
import { TEST_AI_API } from "@edutechs/shared";

export const agentApi = {
  getStatus: () => apiClient.get<AgentStatusResponse>("/agent/status"),
  start: () => apiClient.post<{ success: boolean }>("/agent/start"),
  stop: () => apiClient.post<{ success: boolean }>("/agent/stop"),
};
export type AIAccessReason='BUSINESS_SUSPENDED'|'PLATFORM_SUSPENDED'|'SUBSCRIPTION_INACTIVE'|'MERCHANT_DISABLED'|'REQUEST_LIMIT_REACHED'|'TOKEN_LIMIT_REACHED';
/** Whether the AI is currently allowed to reply, and how much of the allowance is gone. */
export interface MerchantAIAccess {allowed:boolean;reason:AIAccessReason|null;limits:{requests:number|null;tokens:number|null;source:'plan'|'override'|'mixed'|'none';plan?:string}|null;consumed:number|null;warnAt:number}
export interface MerchantBilling {subscription?:Subscription;plans:SubscriptionPlan[];transactions:Array<{_id:string;type:string;amount:number;currency:string;status:string;paymentMethod?:string;provider?:string;providerReference?:string;invoiceNumber?:string;paidAt?:string;createdAt:string}>;usage:{requests:number;tokens:number};aiAccess:MerchantAIAccess;paymentProviderConfigured:boolean}
export const billingApi={get:()=>apiClient.get<MerchantBilling>('/api/billing'),checkout:(planSlug:string,billingPeriod:'monthly'|'annual')=>apiClient.post<{status:string;error?:string}>('/api/billing/checkout',{planSlug,billingPeriod})};
/** Separate from billing so Admins see the quota warning without seeing invoices. */
export const aiAccessApi={get:()=>apiClient.get<MerchantAIAccess>('/api/ai-access')};

/** One inbox row, plus the per-tab counts the merchant navigates by. */
export interface InboxConversation extends Conversation {
  channel?: "messenger" | "whatsapp" | "web" | "test" | "other";
  psid?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastCustomerMessageAt?: string;
  unread?: boolean;
}

/** The few numbers the inbox polls for; the heavy list is refetched only when `version` moves. */
export interface InboxPulse {
  version: string;
  lastActivityAt: string | null;
  unread: number;
  needsAttention: number;
}

export interface ConversationContext {
  customer: {
    _id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    language: string | null;
    tags: string[];
    firstSeenAt: string | null;
    address: { line1: string; city: string; zone: string; phone: string } | null;
  } | null;
  stats: { orders: number; spent: number; currency: string; lastOrderAt: string | null };
  recentOrders: Array<{
    _id: string;
    orderNumber: string;
    status: string;
    paymentStatus?: string;
    total: number;
    currency: string;
    items: number;
    createdAt: string;
  }>;
  draft: {
    stage: string;
    items: Array<{ name: string; code: string | null; quantity: number; unitPrice: number; currency: string }>;
    total: number;
    fullName: string | null;
    phone: string | null;
    address: string | null;
  } | null;
}

export interface InboxResponse {
  data: InboxConversation[];
  counts?: { all: number; messenger: number; whatsapp: number; web: number; test: number; needsAttention: number; unread: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const conversationsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: "asc" | "desc";
    channel?: string;
    state?: string;
  }) =>
    apiClient.get<InboxResponse>("/admin/conversations", {
      params,
    }),
  getMessages: (id: string) =>
    apiClient.get<Message[]>(`/admin/conversations/${id}/messages`),
  getById: (id: string) =>
    apiClient.get<InboxConversation>(`/admin/conversations/${id}`),
  takeOver: (id: string) =>
    apiClient.post<Conversation>(`/admin/conversations/${id}/take-over`),
  returnToAI: (id: string) =>
    apiClient.post<Conversation>(`/admin/conversations/${id}/return-to-ai`),
  reply: (id: string, content: string) =>
    apiClient.post<{ message: Message; delivery: "sent" | "stored" }>(`/admin/conversations/${id}/messages`, { content }),
  pulse: () => apiClient.get<InboxPulse>("/admin/conversations/pulse"),
  markRead: (id: string) =>
    apiClient.post<{ conversationId: string; unread: boolean }>(`/admin/conversations/${id}/read`),
  getContext: (id: string) =>
    apiClient.get<ConversationContext>(`/admin/conversations/${id}/context`),
};

// Customers API (Replaces Clients)
export const customersApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    language?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.search) searchParams.append("search", params.search);
    if (params?.language) searchParams.append("language", params.language);

    const queryString = searchParams.toString();
    // Use /api/customers as defined in app.ts and customers.routes.ts
    const url = `/api/customers${queryString ? `?${queryString}` : ""}`;
    return apiClient.get<PaginatedResponse<Customer>>(url);
  },
  getById: (id: string) =>
    apiClient.get<{
      customer: Customer;
      orders: Order[];
      conversations: Conversation[];
    }>(`/api/customers/${id}`),
  create: (data: Partial<Customer>) =>
    apiClient.post<Customer>("/api/customers", data),
  update: (id: string, data: Partial<Customer>) =>
    apiClient.patch<Customer>(`/api/customers/${id}`, data),
  addAddress: (id: string, address: Record<string, unknown>) =>
    apiClient.post<Customer>(`/api/customers/${id}/addresses`, address),
};

export const knowledgeApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<Knowledge>>("/admin/knowledge", {
      params,
    }),
  create: (data: Partial<Knowledge>) =>
    apiClient.post<Knowledge>("/admin/knowledge", data),
  update: (id: string, data: Partial<Knowledge>) =>
    apiClient.patch<Knowledge>(`/admin/knowledge/${id}`, data),
  delete: (id: string) => apiClient.delete(`/admin/knowledge/${id}`),
};

export const chatApi = {
  send: (message: string, conversationId?: string, imageUrl?: string) =>
    apiClient.post<{ reply: string; conversationId: string }>("/chat", {
      message,
      conversationId,
      imageUrl,
    }),
  uploadImage: (file: File, purpose = "chat-tests") => {
    const body = new FormData();
    body.append("file", file);
    body.append("purpose", purpose);
    return apiClient.post<{ url: string }>("/api/upload/image", body);
  },
};

export const systemPromptsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<SystemPrompt>>("/admin/system-prompts", {
      params,
    }),
  getActive: () => apiClient.get<SystemPrompt>("/admin/system-prompts/active"),
  create: (data: {
    name: string;
    content: string;
    description?: string;
    isActive?: boolean;
  }) => apiClient.post<SystemPrompt>("/admin/system-prompts", data),
  update: (id: string, data: Partial<SystemPrompt>) =>
    apiClient.patch<SystemPrompt>(`/admin/system-prompts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/admin/system-prompts/${id}`),
};

export const productsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; aiSellingStatus?:string;categoryId?:string;includeInactive?:string }) =>
    apiClient.get<PaginatedResponse<Product>>("/api/products", {
      params,
    }),
  create: (data: Partial<Product>) =>
    apiClient.post<Product>("/api/products", data),
  update: (id: string, data: Partial<Product>) =>
    apiClient.patch<Product>(`/api/products/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/products/${id}`),
  bulkDelete: (ids: string[]) =>
    apiClient.post<{ deleted: number; requested: number }>("/api/products/bulk-delete", { ids }),
  bulkImport: (products: Record<string, unknown>[]) =>
    apiClient.post<BulkImportResponse>("/api/products/bulk-import", { products }),
};

export interface BulkImportRowResult {
  row: number;
  name?: string;
  status: "created" | "error";
  id?: string;
  error?: string;
}

export interface BulkImportResponse {
  message: string;
  created: number;
  failed: number;
  results: BulkImportRowResult[];
}

export const categoriesApi = {
  getAll: (params?: { parentId?: string | null }) =>
    apiClient.get<Category[]>("/api/categories", { params }),
  getById: (id: string) =>
    apiClient.get<{ category: Category; products: Product[] }>(
      `/api/categories/${id}`,
    ),
  create: (data: Partial<Category>) =>
    apiClient.post<Category>("/api/categories", data),
  update: (id: string, data: Partial<Category>) =>
    apiClient.patch<Category>(`/api/categories/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/categories/${id}`),
};

export const ordersApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<PaginatedResponse<Order>>("/api/orders", { params }),
  getById: (id: string) => apiClient.get<Order>(`/api/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    apiClient.patch<Order>(`/api/orders/${id}/status`, { status }),
  createManual: (
    data: Partial<Order> & { items: OrderItem[]; customerId: string },
  ) => apiClient.post<Order>("/api/orders/manual", data),
  updatePaymentStatus: (id: string, paymentStatus: string, note?: string) =>
    apiClient.patch<Order>(`/api/orders/${id}/payment-status`, {
      paymentStatus,
      note,
    }),
  getCourier: (id: string) =>
    apiClient.get<CourierActionResponse>(`/api/orders/${id}/courier`),
  createCourier: (id: string) =>
    apiClient.post<CourierActionResponse>(`/api/orders/${id}/courier/create`),
  syncCourier: (id: string) =>
    apiClient.post<CourierActionResponse>(`/api/orders/${id}/courier/sync`),
  getAnalytics: (dateRange?: string) =>
    apiClient.get<{
      revenue: { total: number; period: string };
      ordersByStatus: Record<string, number>;
      ordersByPaymentStatus: Record<string, number>;
      ordersByShippingMethod: Record<string, number>;
      recentOrders: Order[];
    }>("/api/orders/analytics", { params: { dateRange } }),
};

export interface CourierIntegrationStatus {
  provider: "steadfast";
  configured: boolean;
  connected: boolean;
  status: "connected" | "disabled" | "error" | "not_configured";
  deliveryType: 0 | 1;
  lastTestedAt?: string;
  lastErrorCode?: string;
}

export interface CourierActionResponse {
  created?: boolean;
  idempotent?: boolean;
  courier: Order["courier"];
  orderStatus?: Order["status"];
  orderNumber?: string;
}

export const courierIntegrationsApi = {
  getSteadfast: () =>
    apiClient.get<CourierIntegrationStatus>(
      "/api/courier-integrations/steadfast",
    ),
  saveSteadfast: (data: {
    apiKey: string;
    secretKey: string;
    deliveryType: 0 | 1;
  }) =>
    apiClient.put<CourierIntegrationStatus>(
      "/api/courier-integrations/steadfast",
      data,
    ),
  testSteadfast: () =>
    apiClient.post<{
      provider: "steadfast";
      configured: true;
      connected: true;
    }>("/api/courier-integrations/steadfast/test"),
  disconnectSteadfast: () =>
    apiClient.delete<CourierIntegrationStatus>(
      "/api/courier-integrations/steadfast",
    ),
};

export interface FacebookConnection {
  id: string;
  pageName: string;
  pagePicture?: string;
  pageCategory?: string;
  connectionStatus:
    | "CONNECTED"
    | "NEEDS_ATTENTION"
    | "REAUTHORIZATION_REQUIRED"
    | "DISCONNECTED"
    | "ERROR"
    | "CONNECTING"
    | "NOT_CONNECTED";
  capabilities: Record<string, boolean>;
  connectedAt?: string;
  lastVerifiedAt?: string;
  lastEventAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  reauthorizationRequired: boolean;
  aiEnabled: boolean;
  lastErrorCode?: string;
}
export interface FacebookPageChoice {
  choiceId: string;
  name: string;
  picture?: string;
  category?: string;
}
/** A connected WhatsApp Business number, as the Integrations page shows it. */
export interface WhatsAppConnection {
  id: string;
  phoneNumberId: string;
  wabaId?: string;
  name: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  platformType?: string;
  /** "guided" came through Meta's signup dialog; "manual" was a pasted token. */
  setupMode?: "guided" | "manual";
  connectionStatus: string;
  aiEnabled: boolean;
  subscription?: { subscribed: boolean; fields: string[]; verifiedAt?: string };
  connectedAt?: string;
  lastEventAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastVerifiedAt?: string;
  lastErrorCode?: string;
  reauthorizationRequired: boolean;
}

/** What this deployment can offer on the Integrations page, decided server-side. */
export interface WhatsAppSetupOptions {
  guidedAvailable: boolean;
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  webhookUrl: string | null;
}

export interface WhatsAppNumberChoice {
  choiceId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
}

/** Either the number was connected outright, or the account holds several. */
export type WhatsAppSignupResult =
  | { connection: WhatsAppConnection }
  | { sessionId: string; wabaName?: string; subscribed: boolean; numbers: WhatsAppNumberChoice[] };

/** One line of the connection-health checklist. */
export interface HealthCheck {
  key: string;
  label: string;
  state: "pass" | "warn" | "fail" | "unknown";
  detail: string;
  action?: "verify" | "reconnect" | "resubscribe" | "enable_ai" | "configure_webhook";
}

export interface ChannelHealthReport {
  channel: "messenger" | "whatsapp";
  id: string;
  name: string;
  state: "connected" | "attention" | "disconnected" | "idle";
  checks: HealthCheck[];
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastVerifiedAt?: string;
}

export interface IntegrationHealth {
  platform: {
    messengerReady: boolean;
    whatsappReady: boolean;
    /** Whether one-click WhatsApp setup can be offered at all. */
    whatsappGuidedReady?: boolean;
    queueReady: boolean;
    webhooks: { messenger: string; whatsapp: string } | null;
  };
  channels: ChannelHealthReport[];
}

export const integrationHealthApi = {
  get: () => apiClient.get<IntegrationHealth>("/api/integrations/health"),
};

export const whatsappIntegrationsApi = {
  list: () =>
    apiClient.get<{ channels: WhatsAppConnection[] }>("/api/integrations/whatsapp"),
  setup: () =>
    apiClient.get<WhatsAppSetupOptions>("/api/integrations/whatsapp/setup"),
  /** Finishes Meta's own signup dialog: the browser only ever forwards the code. */
  connectGuided: (input: {
    code: string;
    wabaId?: string;
    phoneNumberId?: string;
    coexistence?: boolean;
  }) =>
    apiClient.post<WhatsAppSignupResult>("/api/integrations/whatsapp/connect", input),
  confirmNumber: (sessionId: string, choiceId: string) =>
    apiClient.post<{ connection: WhatsAppConnection }>(
      "/api/integrations/whatsapp/connect/confirm",
      { sessionId, choiceId },
    ),
  resubscribe: (id: string) =>
    apiClient.post<WhatsAppConnection>(
      `/api/integrations/whatsapp/${id}/resubscribe`,
    ),
  connectManually: (phoneNumberId: string, accessToken: string) =>
    apiClient.post<{ connected: boolean }>("/api/integrations/whatsapp", {
      phoneNumberId,
      accessToken,
    }),
  verify: (id: string) =>
    apiClient.post<{ verified: boolean; subscribed?: boolean; name: string; displayPhoneNumber?: string }>(
      `/api/integrations/whatsapp/${id}/verify`,
    ),
  setAI: (id: string, enabled: boolean) =>
    apiClient.patch<{ aiEnabled: boolean }>(`/api/integrations/whatsapp/${id}/ai`, { enabled }),
  disconnect: (id: string) =>
    apiClient.delete<{ disconnected: boolean }>(`/api/integrations/whatsapp/${id}`),
};

export const facebookIntegrationsApi = {
  list: () => apiClient.get<FacebookConnection[]>("/api/facebook/connections"),
  start: (includeContent = false) =>
    apiClient.post<{ authorizationUrl: string; expiresAt: string }>(
      "/api/facebook/connect/start",
      { includeContent },
    ),
  session: (id: string) =>
    apiClient.get<{ id: string; pages: FacebookPageChoice[] }>(
      `/api/facebook/connect/session/${id}`,
    ),
  confirm: (sessionId: string, choiceId: string) =>
    apiClient.post<FacebookConnection>("/api/facebook/connect/confirm", {
      sessionId,
      choiceId,
      termsAccepted: true,
    }),
  verify: (id: string) =>
    apiClient.post<FacebookConnection>(
      `/api/facebook/connections/${id}/verify`,
    ),
  setAI: (id: string, enabled: boolean) =>
    apiClient.patch<FacebookConnection>(`/api/facebook/connections/${id}/ai`, {
      enabled,
    }),
  resubscribe: (id: string) =>
    apiClient.post<FacebookConnection>(
      `/api/facebook/connections/${id}/resubscribe`,
    ),
  disconnect: (id: string) =>
    apiClient.delete<FacebookConnection>(`/api/facebook/connections/${id}`),
};

export const meetingsApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Meeting>>("/google/list-events", {
      params,
    }),
  update: (id: string, data: Partial<Meeting>) =>
    apiClient.patch<Meeting>(`/admin/meetings/${id}`, data),
  delete: (id: string) => apiClient.delete(`/admin/meetings/${id}`),
};

export const unansweredApi = {
  getAll: () => apiClient.get<UnansweredQuestion[]>("/admin/unanswered"),
  resolve: (id: string) =>
    apiClient.post(`/admin/unanswered/${id}/resolve`, {}),
};

export const availabilityApi = {
  get: () => apiClient.get<AvailabilitySettings>("/admin/availability"),
  update: (data: Partial<AvailabilitySettings>) =>
    apiClient.patch<AvailabilitySettings>("/admin/availability", data),
};

export const meetingHostsApi = {
  getAll: () => apiClient.get<MeetingHost[]>("/admin/hosts"),
  update: (id: string, data: Partial<MeetingHost>) =>
    apiClient.patch<MeetingHost>(`/admin/hosts/${id}`, data),
  bulkUpdate: (data: MeetingHost[]) =>
    apiClient.post<MeetingHost[]>("/admin/hosts/bulk", { hosts: data }),
};

export const analyticsApi = {
  get: () => apiClient.get<AnalyticsResponse>("/admin/analytics"),
};

export const errorsApi = {
  getAll: () => apiClient.get<ErrorLog[]>("/admin/errors"),
  delete: (id: string) => apiClient.delete(`/admin/errors/${id}`),
  clearAll: () => apiClient.post("/admin/errors/clear", {}),
};

export const aiUsageApi = {
  summary: (days = 30) =>
    apiClient.get<{
      period: { from: string; to: string; days: number };
      requests: number;
      llmCalls: number;
      nonGenerationAiCalls: number;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      totalTokens: number;
      estimatedCost: number | null;
    }>("/api/ai-usage/summary", { params: { days } }),
};

export interface SetupStatus {
  business: boolean;
  productAdded: boolean;
  knowledgeAdded: boolean;
  aiTested: boolean;
  facebookConnected: boolean;
  websiteConnected: boolean;
  steadfastConnected: boolean;
  completed: boolean;
}
export const onboardingApi = {
  status: () => apiClient.get<SetupStatus>("/onboarding/status"),
  createBusiness: (data: Record<string, unknown>) =>
    apiClient.post<{
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: string;
      refreshTokenExpiresAt: string;
      business: { id: string; name: string };
      role: "Owner";
      needsOnboarding: false;
    }>("/auth/business", data),
  addProduct: (data: Record<string, unknown>) =>
    apiClient.post("/onboarding/product", data),
  addKnowledge: (data: Record<string, unknown>) =>
    apiClient.post("/onboarding/knowledge", data),
  configureChannel: () =>
    apiClient.post("/onboarding/channel", { platform: "web" }),
  complete: () => apiClient.post<SetupStatus>("/onboarding/complete"),
};

export interface TestAiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  products?: Array<{
    id?: string;
    name: string;
    price?: number;
    currency?: string;
    stock?: number | null;
    availability?: string;
    image?: string;
  }>;
  createdAt: string;
  intent?: string;
}
export interface TestAiState {
  conversation: {
    id: string;
    controlMode: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  messages: TestAiMessage[];
  usage: {
    aiReplies: number;
    llmCalls: number;
    nonGenerationAiCalls: number;
    zeroLlmResponses: number;
    llmAssistedResponses: number;
    providers: string[];
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    averageTokensPerReply: number;
    estimatedCost: number | null;
  };
  reply?: string;
  context?: { salesStage: string; intentScore: number; nextBestAction: string; knowledgeUsed: boolean; businessType?: string; businessName?: string };
}
export const testAiApi = {
  current: () =>
    apiClient.get<TestAiState>(
      `${TEST_AI_API.base}${TEST_AI_API.currentConversation}`,
    ),
  history: () =>
    apiClient.get<TestAiState>(
      `${TEST_AI_API.base}${TEST_AI_API.currentMessages}`,
    ),
  newConversation: () =>
    apiClient.post<TestAiState>(
      `${TEST_AI_API.base}${TEST_AI_API.conversations}`,
    ),
  send: (message: string, imageUrl?: string) =>
    apiClient.post<TestAiState>(
      `${TEST_AI_API.base}${TEST_AI_API.currentMessages}`,
      { message, imageUrl },
    ),
};

export interface MerchantOverview {
  business: {
    name: string;
    onboardingComplete: boolean;
    onboarding: Record<string, unknown>;
  } | null;
  conversations: number;
  humanControlled: number;
  customers: number;
  newCustomers: number;
  products: number;
  knowledge: number;
  orders: Record<string, number>;
  revenue: number;
  salesOrders: number;
  usage: { requests: number; totalTokens: number; estimatedCost: number };
  channels: Array<{
    _id: string;
    platform: string;
    name: string;
    status: string;
  }>;
  courier: string;
  recentOrders: Array<{
    _id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
  agentStatus: string;
}
export const dashboardApi = {
  overview: () => apiClient.get<MerchantOverview>("/api/dashboard/overview"),
};

export interface PlatformNotice {
  _id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  dismissible: boolean;
  publishedAt?: string;
}

/**
 * Announcements aimed at this workspace, the feature flags it resolves to, and the
 * platform settings the dashboard renders — one request, because all three come
 * from the same operator configuration and change at the same cadence.
 */
export interface PlatformNoticeFeed {
  announcements: PlatformNotice[];
  /** Published since this user last opened the panel. */
  unreadCount: number;
  seenAt: string | null;
  flags: Record<string, boolean>;
  settings: Record<string, unknown>;
}

export const platformNoticeApi = {
  get: () => apiClient.get<PlatformNoticeFeed>("/api/dashboard/platform-notices"),
  markSeen: () => apiClient.post<{ seenAt: string }>("/api/dashboard/platform-notices/seen"),
};

export const trainingApi = {
  status: () => apiClient.get<TrainingOverview>("/api/training/status"),
  candidates: (params?: {
    status?: string;
    kind?: string;
    availability?: string;
    category?: string;
    search?: string;
    sourceId?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<{
      data: TrainingCandidate[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      availabilityCounts: Record<string, number>;
      categories: string[];
    }>("/api/training/candidates", { params }),
  connectWebsite: (url: string) =>
    apiClient.post<{ source: TrainingSource; run: TrainingRun }>(
      "/api/training/sources/website",
      { url },
    ),
  connectFacebook: (connectionId: string) =>
    apiClient.post<{ source: TrainingSource; run: TrainingRun }>(
      "/api/training/sources/facebook",
      { connectionId },
    ),
  addReference: (url: string, label?: string) =>
    apiClient.post<TrainingSource>("/api/training/sources/reference", {
      url,
      label,
    }),
  updateBusinessProfile: (data: {
    businessType: string;
    businessSubType?: string;
    customBusinessType?: string;
    secondaryBusinessTypes?: string[];
  }) => apiClient.patch("/api/training/business-profile", data),
  saveBusinessFact: (key: string, value: string | string[]) =>
    apiClient.put<{
      key: string;
      value: string | string[];
      updatedAt: string;
      businessType: string;
      merchantConfirmed: true;
      source: "BUSINESS_SETUP";
    }>(`/api/training/business-facts/${encodeURIComponent(key)}`, {
      value,
      merchantConfirmed: true,
    }),
  confirmBusinessType: (businessType?: string) =>
    apiClient.post("/api/training/business-profile/confirm", { businessType }),
  uploadFile: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiClient.post<{
      source: TrainingSource;
      run: TrainingRun;
      summary: { products: number; knowledge: number; warnings: string[] };
    }>("/api/training/sources/file", body);
  },
  addManual: (kind: "faq" | "information", title: string, content: string) =>
    apiClient.post("/api/training/sources/manual", { kind, title, content }),
  rescan: (id: string) => apiClient.post(`/api/training/sources/${id}/rescan`),
  retryFailed: (id: string) =>
    apiClient.post(`/api/training/sources/${id}/retry-failed`),
  setImportPreference: (
    id: string,
    importPreference: "in_stock_only" | "all" | "ask_during_review",
  ) =>
    apiClient.patch<TrainingSource>(
      `/api/training/sources/${id}/import-preference`,
      { importPreference },
    ),
  clearSourceStaged: (id: string) =>
    apiClient.post<{ cleared: number }>(
      `/api/training/sources/${id}/clear-staged`,
      { confirm: "CLEAR_STAGED_CANDIDATES" },
    ),
  startFresh: (id: string) =>
    apiClient.post(`/api/training/sources/${id}/start-fresh`, {
      confirm: "START_FRESH_SCAN",
    }),
  approveSafe: (data?: {
    ids?: string[];
    filter?: Record<string, string>;
    retryFailed?: boolean;
  }) =>
    apiClient.post<{
      processed: number;
      approved: number;
      failed: number;
      remaining: number;
      batchSize: number;
      errors: Array<{ id: string; error: string }>;
    }>("/api/training/approve-safe", data || {}),
  clearCandidates: (data: {
    ids?: string[];
    filter?: Record<string, string>;
    confirm: "CLEAR_STAGED_CANDIDATES";
  }) =>
    apiClient.post<{ cleared: number }>("/api/training/candidates/clear", data),
  approve: (id: string) =>
    apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/approve`),
  reject: (id: string) =>
    apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/reject`),
  keepSeparate: (id: string) =>
    apiClient.post<TrainingCandidate>(
      `/api/training/candidates/${id}/keep-separate`,
    ),
  merge: (id: string) =>
    apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/merge`),
  resolve: (
    id: string,
    decisions: Record<
      string,
      { choice: "current" | "imported" | "custom"; value?: unknown }
    >,
  ) =>
    apiClient.post<TrainingCandidate>(
      `/api/training/candidates/${id}/resolve`,
      { decisions },
    ),
  edit: (id: string, payload: Record<string, unknown>, title?: string) =>
    apiClient.patch<TrainingCandidate>(`/api/training/candidates/${id}`, {
      payload,
      title,
    }),
};

export interface TeamMember {
  _id: string;
  role: "Owner" | "Admin" | "Staff";
  status: string;
  userId: { _id: string; name: string; email: string; status: string };
}
export interface BrandVoiceProfile {
  tone: "friendly" | "professional" | "casual" | "premium" | "custom";
  replyLength: "short" | "balanced" | "detailed";
  language: "auto" | "bn" | "en" | "banglish";
  salesBehavior: "helpful" | "balanced" | "sales_focused";
  emoji: "none" | "light" | "normal";
  customTone?: string;
  examples: string[];
}
export interface CommerceSettings {
  storeEnabled: boolean;
  paymentMethods: string[];
  deliveryFees: { insideDhaka: number; outsideDhaka: number };
  deliveryPolicy?: string;
  returnPolicy?: string;
  salesChannel?: string;
}
export interface StorefrontSettings {
  primaryColor: string;
  accentColor: string;
  heroTitle: string;
  heroSubtitle?: string;
  layout: "grid" | "editorial";
}
export interface BusinessProfile {
  _id: string;
  name: string;
  businessType?: string;
  phone?: string;
  website?: string;
  preferredLanguage: "bn" | "en";
  currency: "BDT";
  brandVoice?: BrandVoiceProfile;
  commerce?: CommerceSettings;
  storefront?: StorefrontSettings;
  aiAccess?: { status?: string; pausedReply?: string };
  /** Write-only: the update endpoint stores this on aiAccess.pausedReply. */
  pausedReply?: string;
}
export interface SecuritySession {
  id: string;
  type: "account" | "merchant";
  userAgent?: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
  revokedAt?: string;
  current: boolean;
}
export const businessApi = {
  get: () => apiClient.get<BusinessProfile>("/auth/business"),
  update: (data: Partial<BusinessProfile>) =>
    apiClient.patch<BusinessProfile>("/auth/business", data),
  updateBrandVoice: (data: Partial<BrandVoiceProfile>) =>
    apiClient.patch<BusinessProfile>("/auth/business/brand-voice", data),
  updateCommerce: (data: CommerceSettings) =>
    apiClient.patch<BusinessProfile>("/auth/business/commerce", data),
  updateStorefront: (data: StorefrontSettings) =>
    apiClient.patch<BusinessProfile>("/auth/business/storefront", data),
  members: () => apiClient.get<TeamMember[]>("/auth/members"),
  addMember: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
  }) => apiClient.post<TeamMember>("/auth/members", data),
  updateMember: (id: string, data: { role?: string; status?: string }) =>
    apiClient.patch<TeamMember>(`/auth/members/${id}`, data),
  channels: () =>
    apiClient.get<
      Array<{ _id: string; platform: string; name: string; status: string }>
    >("/auth/channels"),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post<{ passwordChanged: true; allSessionsRevoked: true }>(
      "/auth/password/change",
      data,
    ),
  sessions: () => apiClient.get<SecuritySession[]>("/auth/sessions"),
  revokeSession: (id: string) => apiClient.delete<void>(`/auth/sessions/${id}`),
};
