export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}
export interface RevenueSummary {
  revenue?: number;
  refunds?: number;
  newRevenue?: number;
  renewalRevenue?: number;
}
export interface UsageSummary {
  requests: number;
  totalTokens: number;
  estimatedCost: number | null;
  knownEstimatedCost: number;
  unknownCostRequests: number;
}
export interface Trend {
  _id: string;
  value: number;
}
export interface SubscriptionPlan {
  _id: string; name: string; slug: string; description: string;
  monthlyPrice: number; annualPrice: number; currency: string; trialDays: number;
  limits: { messages: number; tokens: number; teamMembers: number; channels: number };
  features: string[]; enabled: boolean; featured: boolean; sortOrder: number;
}
export interface PlatformSetting { _id: string; key: string; value: unknown; category: string; description?: string; updatedAt: string }
export interface PlatformOverview {
  period: { name: string; from: string; to: string };
  businesses: {
    total: number;
    newThisMonth: number;
    active: number;
    suspended: number;
  };
  users: {
    total: number;
    activeNow: number;
    activeToday: number;
    activeThisMonth: number;
  };
  activeBusinesses: { today: number; thisMonth: number };
  subscriptions: Record<string, number> & {
    newThisMonth: number;
    renewalsThisMonth: number;
  };
  revenue: {
    today: RevenueSummary;
    thisMonth: RevenueSummary;
    previousMonth: RevenueSummary;
    total: RevenueSummary;
    mrr: number;
  };
  ai: {
    states: Record<string, number>;
    today: UsageSummary;
    month: UsageSummary;
    previousMonth: UsageSummary;
    total: UsageSummary;
  };
  trends: {
    businessGrowth: Trend[];
    revenue: Trend[];
    aiUsage: Array<{
      _id: string;
      requests: number;
      tokens: number;
      knownCost: number;
      unknownCost: number;
    }>;
  };
}
export interface Subscription {
  _id: string;
  businessId: string;
  business?: { name: string };
  plan: string;
  status: string;
  billingPeriod: string;
  price: number;
  currency: string;
  startedAt: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  renewedAt?: string;
  cancelledAt?: string;
}
export interface PlatformBusiness {
  _id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  businessType?: string;
  createdAt: string;
  aiAccess?: { status: string; reason?: string; monthlyRequestLimit?: number; monthlyTokenLimit?: number };
  owner?: { name?: string; email?: string };
  merchantUsers: number;
  subscription?: Subscription;
  usage: { requests: number; tokens: number; cost: number; unknown: number };
  revenue: number;
  lastActive?: string;
  integrations: { website: number; facebook: number; courier: number };
}
export interface PlatformUser {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  status: string;
  lastSeenAt?: string;
  createdAt: string;
  memberships: Array<{
    role: string;
    status: string;
    business?: { _id: string; name: string };
  }>;
}
export interface PlatformUsage {
  businessId: string;
  businessName: string;
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number | null;
  knownCost: number;
  unknownCostRequests: number;
}
export interface PlatformIntegrations {
  channels: Array<{ _id: Record<string, string>; count: number }>;
  couriers: Array<{ _id: Record<string, string>; count: number }>;
  training: Array<{
    _id: Record<string, string>;
    count: number;
    lastSuccessful?: string;
    failedScans: number;
    products: number;
    knowledge: number;
    needsReview: number;
  }>;
  businesses: number;
  aiProviderConfigured: boolean;
  storageConfigured: boolean;
  facebookConnections: Array<{ _id: string; businessName?: string; pageName: string; pageCategory?: string; connectionStatus: string; lastEventAt?: string; lastVerifiedAt?: string; reauthorizationRequired?: boolean; lastErrorCode?: string }>;
}
export interface PlatformHealth {
  status: string;
  api: string;
  mongo: string;
  redis: string;
  worker: string;
  aiProvider: "groq" | "openai";
  aiConfigured: boolean;
  facebook: string;
  steadfastEncryption: string;
  facebookChannels: number;
  steadfastConnections: number;
  storage: string;
}
export interface PlatformError {
  _id: string;
  type: string;
  message: string;
  timestamp: string;
}
export interface AuditRow {
  _id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
  admin?: { name: string; email: string };
  business?: { id: string; name: string };
  previousValue?: unknown;
  newValue?: unknown;
}
export interface BusinessDetail {
  business: {
    _id: string;
    name: string;
    businessType?: string;
    status: "active" | "suspended";
    createdAt: string;
    aiAccess?: { status: string; monthlyRequestLimit?: number; monthlyTokenLimit?: number; warningThresholdPercent?: number; pausedReply?: string };
  };
  members: Array<{
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      status: string;
      lastSeenAt?: string;
    };
  }>;
  subscription?: Subscription;
  subscriptionHistory: Array<{
    _id: string;
    type: string;
    reason: string;
    createdAt: string;
  }>;
  revenue: RevenueSummary;
  aiUsage: {
    requests: number;
    tokens: number;
    knownCost: number;
    unknown: number;
  };
  counts: Record<string, number>;
  integrations: {
    channels: Array<{
      _id: string;
      platform: string;
      name: string;
      status: string;
    }>;
    couriers: Array<{
      _id: string;
      provider: string;
      status: string;
      lastErrorCode?: string;
    }>;
    training: Array<{
      _id: string;
      type: string;
      status: string;
      stats?: {
        products?: number;
        knowledge?: number;
        needsAttention?: number;
      };
    }>;
  };
  lastActivity?: string;
}
export interface BillingRow {
  _id: string;
  businessName?: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string;
  providerReference?: string;
  paidAt?: string;
  isTest?: boolean;
}
export interface RevenueResponse {
  period: { from: string; to: string };
  summary: RevenueSummary;
  byPlan: Trend[];
  trend: Trend[];
  data: BillingRow[];
  pagination: Pagination;
}

// --- Control plane -------------------------------------------------------------

export interface PlatformIdentity {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}
export interface RoleDefinition { role: string; description: string; permissions: string[] }
export interface TeamMember {
  _id: string; name: string; email: string; role: string; permissions: string[];
  effectivePermissions: string[]; status: "active" | "disabled"; mustChangePassword?: boolean;
  notes?: string; lastLoginAt?: string; createdAt: string;
}
export interface Announcement {
  _id: string; title: string; body: string; severity: "info" | "success" | "warning" | "critical";
  audience: "all" | "plan" | "status" | "business"; planSlugs: string[]; subscriptionStatuses: string[];
  businessIds: string[]; status: "draft" | "scheduled" | "published" | "expired";
  dismissible: boolean; emailDelivery: boolean; startsAt?: string; endsAt?: string;
  publishedAt?: string; authorName?: string; createdAt: string;
}
export interface FeatureFlagRow {
  _id: string; key: string; label: string; description: string; enabled: boolean;
  rolloutPercent: number; planSlugs: string[]; businessIds: string[]; killSwitch: boolean; updatedAt: string;
}
export interface CouponRow {
  _id: string; code: string; description: string; type: "PERCENT" | "FIXED" | "TRIAL_EXTENSION";
  value: number; currency: string; planSlugs: string[]; maxRedemptions: number; redemptions: number;
  recurringPeriods: number; validFrom?: string; validUntil?: string; enabled: boolean;
  rejection: string | null; createdAt: string;
}
export interface SettingRow {
  key: string; label: string; description: string; category: string; group: string;
  type: "boolean" | "number" | "string" | "text" | "select" | "list" | "json";
  default: unknown; options?: string[]; unit?: string; value: unknown; isDefault: boolean;
}
export interface AiOverview {
  month: { requests: number; totalTokens: number; knownCost: number };
  byModel: Array<{ _id: { provider: string; model: string }; requests: number; tokens: number; cost: number }>;
  topBusinesses: Array<{ _id: string; businessName: string; requests: number; tokens: number; cost: number }>;
  states: Record<string, number>;
  ceiling: { limit: number; spend: number; percent: number | null; warnAt: number };
  runtime: { provider: string; deploymentModel: string; effectiveModel: string; maxOutputTokens: number; groqConfigured: boolean; openAiConfigured: boolean };
}
export interface PromptRow { _id: string; name: string; description?: string; content: string; isActive: boolean; updatedAt: string }
export interface NotificationTemplateRow { _id: string; event: string; locale: string; subject: string; body: string; enabled: boolean; updatedAt: string }
export interface QueueRow {
  name: string; available: boolean; error?: string; paused: boolean;
  counts: Record<string, number>;
  failures: Array<{ id: string; name: string; attempts: number; failedReason: string; timestamp: number }>;
}
export interface ProviderRow { id: string; label: string; settingKey: string; enabled: boolean; credentials: boolean; total: number; connected: number }
export interface ProvidersResponse {
  channels: ProviderRow[]; couriers: ProviderRow[];
  infrastructure: { ai: { groq: boolean; openai: boolean }; storage: boolean; email: boolean; redis: boolean; sandbox: boolean };
}
export interface CatalogOverview {
  totals: { products: number; orders: number; conversations: number; customers: number; knowledge: number; messages: number };
  topProducts: Array<{ _id: string; name?: string; count: number }>;
  topOrders: Array<{ _id: string; name?: string; count: number; value: number }>;
  topConversations: Array<{ _id: string; name?: string; count: number }>;
}
export interface CatalogOrder { _id: string; orderNumber: string; status: string; paymentStatus: string; total: number; createdAt: string; itemCount: number; customerName?: string; businessId: string; businessName?: string }
export interface CatalogProduct { _id: string; name: string; sku?: string; price: number; stock?: number; isActive: boolean; updatedAt: string; businessId: string; businessName?: string }
export interface OnboardingPipeline {
  funnel: Record<string, number>;
  stuck: Array<{ _id: string; name: string; status: string; stage: string; createdAt: string; ageDays: number; onboarding?: Record<string, boolean> }>;
}
export interface SecurityPosture {
  admins: Array<{ _id: string; name: string; email: string; role: string; status: string; lastLoginAt?: string; mustChangePassword?: boolean; logins30d: number }>;
  sensitiveEvents: Array<{ _id: string; action: string; targetId: string; reason: string; createdAt: string }>;
  activeMerchantUsers24h: number;
}
export interface ComplianceOverview {
  datasets: Array<{ id: string; label: string; settingKey: string; days: number; total: number; expired: number }>;
  requests: Array<{ _id: string; providerUserHash: string; status: string; completedAt?: string; createdAt: string; overdue: boolean }>;
  sla: number;
  exportEnabled: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/platform-admin/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Platform request failed");
  return body as T;
}
export const platformApi = {
  overview: (period = "30d") =>
    request<PlatformOverview>(`overview?period=${period}`),
  businesses: (search = "", filter = "", page = 1) =>
    request<Paginated<PlatformBusiness>>(
      `businesses?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&page=${page}`,
    ),
  business: (id: string) => request<BusinessDetail>(`businesses/${id}`),
  setBusinessStatus: (
    id: string,
    status: "active" | "suspended",
    reason: string,
  ) =>
    request(`businesses/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
  setAIStatus: (
    id: string,
    status: "ENABLED" | "SUSPENDED_BY_PLATFORM",
    reason: string,
  ) =>
    request(`businesses/${id}/ai-access`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
  users: (search = "", page = 1) =>
    request<Paginated<PlatformUser>>(
      `users?search=${encodeURIComponent(search)}&page=${page}`,
    ),
  setUserStatus: (id: string, status: "active" | "disabled", reason: string) =>
    request(`users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
  subscriptions: (search = "", status = "", page = 1) =>
    request<Paginated<Subscription>>(
      `subscriptions?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page}`,
    ),
  plans: () => request<SubscriptionPlan[]>("plans"),
  createPlan: (payload: Omit<SubscriptionPlan, "_id">) => request<SubscriptionPlan>("plans", { method: "POST", body: JSON.stringify(payload) }),
  updatePlan: (id: string, payload: Omit<SubscriptionPlan, "_id">) => request<SubscriptionPlan>(`plans/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  setSubscription: (businessId: string, payload: Record<string, unknown>) =>
    request<Subscription>(`businesses/${businessId}/subscription`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  revenue: (period = "30d", search = "", page = 1) =>
    request<RevenueResponse>(
      `revenue?period=${period}&search=${encodeURIComponent(search)}&page=${page}`,
    ),
  adjustBilling: (payload: Record<string, unknown>) =>
    request("billing/adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  usage: (period = "30d") =>
    request<{
      period: { from: string; to: string };
      total: UsageSummary;
      data: PlatformUsage[];
    }>(`usage?period=${period}`),
  integrations: () => request<PlatformIntegrations>("integrations"),
  health: () => request<PlatformHealth>("health"),
  errors: () => request<PlatformError[]>("errors"),
  audit: (search = "", action = "", page = 1) =>
    request<Paginated<AuditRow>>(
      `audit?search=${encodeURIComponent(search)}&action=${encodeURIComponent(action)}&page=${page}`,
    ),
  me: () => request<PlatformIdentity>("me"),
  activity: () => request<{merchantActivity:Array<{_id:string;businessName?:string;userName?:string;userEmail?:string;lastSeenAt:string}>;events:Array<{_id:string;action:string;reason:string;businessName?:string;createdAt:string}>}>("activity"),
  settings: () => request<PlatformSetting[]>("settings"),
  updateSetting: (key:string,payload:{value:unknown;category:string;description?:string}) => request<PlatformSetting>(`settings/${encodeURIComponent(key)}`, {method:"PUT",body:JSON.stringify(payload)}),
  // --- Control plane ---------------------------------------------------------
  roles: () => request<RoleDefinition[]>("roles"),
  team: () => request<TeamMember[]>("team"),
  createTeamMember: (payload: Record<string, unknown>) => request<TeamMember>("team", { method: "POST", body: JSON.stringify(payload) }),
  updateTeamMember: (id: string, payload: Record<string, unknown>) => request<TeamMember>(`team/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  resetTeamPassword: (id: string, password: string, reason: string) => request(`team/${id}/password`, { method: "POST", body: JSON.stringify({ password, reason }) }),

  announcements: () => request<Announcement[]>("announcements"),
  createAnnouncement: (payload: Record<string, unknown>) => request<Announcement>("announcements", { method: "POST", body: JSON.stringify(payload) }),
  updateAnnouncement: (id: string, payload: Record<string, unknown>) => request<Announcement>(`announcements/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  setAnnouncementStatus: (id: string, status: string, reason?: string) => request(`announcements/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason }) }),
  deleteAnnouncement: (id: string) => request(`announcements/${id}`, { method: "DELETE" }),

  flags: () => request<FeatureFlagRow[]>("flags"),
  createFlag: (payload: Record<string, unknown>) => request<FeatureFlagRow>("flags", { method: "POST", body: JSON.stringify(payload) }),
  updateFlag: (id: string, payload: Record<string, unknown>) => request<FeatureFlagRow>(`flags/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteFlag: (id: string) => request(`flags/${id}`, { method: "DELETE" }),

  coupons: () => request<CouponRow[]>("coupons"),
  createCoupon: (payload: Record<string, unknown>) => request<CouponRow>("coupons", { method: "POST", body: JSON.stringify(payload) }),
  updateCoupon: (id: string, payload: Record<string, unknown>) => request<CouponRow>(`coupons/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCoupon: (id: string) => request(`coupons/${id}`, { method: "DELETE" }),

  registry: () => request<SettingRow[]>("settings/registry"),
  saveSetting: (key: string, value: unknown) => request<{ value: unknown }>(`settings/registry/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value }) }),
  resetSetting: (key: string) => request<{ value: unknown }>(`settings/registry/${encodeURIComponent(key)}/reset`, { method: "POST" }),

  aiOverview: () => request<AiOverview>("ai/overview"),
  setAiLimits: (businessId: string, payload: {monthlyRequestLimit:number;monthlyTokenLimit:number;warningThresholdPercent:number;pausedReply:string;reason:string}) => request(`businesses/${businessId}/ai-limits`, { method: "PATCH", body: JSON.stringify(payload) }),
  prompts: () => request<PromptRow[]>("prompts"),
  createPrompt: (payload: Record<string, unknown>) => request<PromptRow>("prompts", { method: "POST", body: JSON.stringify(payload) }),
  updatePrompt: (id: string, payload: Record<string, unknown>) => request<PromptRow>(`prompts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  activatePrompt: (id: string, reason: string) => request(`prompts/${id}/activate`, { method: "POST", body: JSON.stringify({ reason }) }),
  deletePrompt: (id: string) => request(`prompts/${id}`, { method: "DELETE" }),

  notifications: () => request<{ templates: NotificationTemplateRow[]; events: Array<{ event: string; variables: string[] }>; wired: string[] }>("notifications"),
  createTemplate: (payload: Record<string, unknown>) => request<NotificationTemplateRow>("notifications", { method: "POST", body: JSON.stringify(payload) }),
  updateTemplate: (id: string, payload: Record<string, unknown>) => request<NotificationTemplateRow>(`notifications/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  setMembershipRole: (userId: string, businessId: string, role: string, reason: string) => request(`users/${userId}/membership`, { method: "PATCH", body: JSON.stringify({ businessId, role, reason }) }),
  verifyUserEmail: (userId: string, reason: string) => request(`users/${userId}/verify-email`, { method: "POST", body: JSON.stringify({ reason }) }),
  revokeUserSessions: (userId: string, reason: string) => request(`users/${userId}/revoke-sessions`, { method: "POST", body: JSON.stringify({ reason }) }),

  refundPayment: (id: string, payload: Record<string, unknown>) => request(`payments/${id}/refund`, { method: "POST", body: JSON.stringify(payload) }),

  jobs: () => request<{ queues: QueueRow[]; redisConfigured: boolean }>("jobs"),
  runQueueAction: (queue: string, action: string, reason: string) => request(`jobs/${queue}/${action}`, { method: "POST", body: JSON.stringify({ reason }) }),

  providers: () => request<ProvidersResponse>("providers"),
  catalog: () => request<CatalogOverview>("catalog"),
  catalogOrders: (search = "", status = "", page = 1) => request<Paginated<CatalogOrder>>(`catalog/orders?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page}`),
  catalogProducts: (search = "", page = 1) => request<Paginated<CatalogProduct>>(`catalog/products?search=${encodeURIComponent(search)}&page=${page}`),
  onboarding: () => request<OnboardingPipeline>("onboarding"),
  security: () => request<SecurityPosture>("security"),
  compliance: () => request<ComplianceOverview>("compliance"),
  completeDeletionRequest: (id: string, reason: string) => request(`compliance/requests/${id}/complete`, { method: "POST", body: JSON.stringify({ reason }) }),
  purgeRetention: (dataset: string, reason: string) => request<{ deleted: number }>(`compliance/retention/${dataset}/purge`, { method: "POST", body: JSON.stringify({ reason }) }),
  eraseBusiness: (id: string, confirmation: string, reason: string) => request<{ removed: Record<string, number> }>(`businesses/${id}/erase`, { method: "POST", body: JSON.stringify({ confirmation, reason }) }),

  /** Exports stream a file, so they bypass the JSON helper and go straight to a download. */
  exportUrl: (dataset: string, period = "30d") => `/api/platform-admin/exports/${dataset}?period=${period}`,
  businessExportUrl: (id: string) => `/api/platform-admin/businesses/${id}/export`,
};
