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
  aiAccess?: { status: string; reason?: string };
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
    aiAccess?: { status: string };
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
  me: () => request<{ id: string; name: string; email: string }>("me"),
};
