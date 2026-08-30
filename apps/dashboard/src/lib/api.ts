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
    ErrorLog
} from '@/types';
import type { TrainingCandidate, TrainingOverview, TrainingRun, TrainingSource } from '@/types';
import { apiClient } from './api-client';
import { TEST_AI_API } from '@edutechs/shared';

export const agentApi = {
    getStatus: () => apiClient.get<AgentStatusResponse>('/agent/status'),
    start: () => apiClient.post<{ success: boolean }>('/agent/start'),
    stop: () => apiClient.post<{ success: boolean }>('/agent/stop'),
};

export const conversationsApi = {
    getAll: (params?: {
        page?: number;
        limit?: number;
        search?: string;
        sortBy?: string;
        order?: 'asc' | 'desc';
    }) =>
        apiClient.get<PaginatedResponse<Conversation>>('/admin/conversations', {
            params,
        }),
    getMessages: (id: string) =>
        apiClient.get<Message[]>(`/admin/conversations/${id}/messages`),
    getById: (id: string) => apiClient.get<Conversation>(`/admin/conversations/${id}`),
    takeOver: (id: string) => apiClient.post<Conversation>(`/admin/conversations/${id}/take-over`),
    returnToAI: (id: string) => apiClient.post<Conversation>(`/admin/conversations/${id}/return-to-ai`),
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
        if (params?.page) searchParams.append('page', params.page.toString());
        if (params?.limit) searchParams.append('limit', params.limit.toString());
        if (params?.search) searchParams.append('search', params.search);
        if (params?.language) searchParams.append('language', params.language);

        const queryString = searchParams.toString();
        // Use /api/customers as defined in app.ts and customers.routes.ts
        const url = `/api/customers${queryString ? `?${queryString}` : ''}`;
        return apiClient.get<PaginatedResponse<Customer>>(url);
    },
    getById: (id: string) => apiClient.get<{ customer: Customer; orders: Order[]; conversations: Conversation[] }>(`/api/customers/${id}`),
    create: (data: Partial<Customer>) => apiClient.post<Customer>('/api/customers', data),
    update: (id: string, data: Partial<Customer>) =>
        apiClient.patch<Customer>(`/api/customers/${id}`, data),
    addAddress: (id: string, address: Record<string, unknown>) => apiClient.post<Customer>(`/api/customers/${id}/addresses`, address)
};

export const knowledgeApi = {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
        apiClient.get<PaginatedResponse<Knowledge>>('/admin/knowledge', {
            params,
        }),
    create: (data: Partial<Knowledge>) => apiClient.post<Knowledge>('/admin/knowledge', data),
    update: (id: string, data: Partial<Knowledge>) =>
        apiClient.patch<Knowledge>(`/admin/knowledge/${id}`, data),
    delete: (id: string) => apiClient.delete(`/admin/knowledge/${id}`),
};

export const chatApi = {
    send: (message: string, conversationId?: string, imageUrl?: string) =>
        apiClient.post<{ reply: string; conversationId: string }>('/chat', {
            message,
            conversationId,
            imageUrl
        }),
    getSignature: (folder: string) =>
        apiClient.get<{
            timestamp: number;
            signature: string;
            apiKey: string;
            cloudName: string;
            folder: string;
        }>('/api/upload/signature', { params: { folder } }),
};

export const systemPromptsApi = {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
        apiClient.get<PaginatedResponse<SystemPrompt>>('/admin/system-prompts', {
            params,
        }),
    getActive: () => apiClient.get<SystemPrompt>('/admin/system-prompts/active'),
    create: (data: {
        name: string;
        content: string;
        description?: string;
        isActive?: boolean;
    }) => apiClient.post<SystemPrompt>('/admin/system-prompts', data),
    update: (id: string, data: Partial<SystemPrompt>) =>
        apiClient.patch<SystemPrompt>(`/admin/system-prompts/${id}`, data),
    delete: (id: string) => apiClient.delete(`/admin/system-prompts/${id}`),
};

export const productsApi = {
    getAll: (params?: { page?: number; limit?: number; search?: string }) =>
        apiClient.get<PaginatedResponse<Product>>('/api/products', {
            params,
        }),
    create: (data: Partial<Product>) => apiClient.post<Product>('/api/products', data),
    update: (id: string, data: Partial<Product>) =>
        apiClient.patch<Product>(`/api/products/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/products/${id}`),
};

export const categoriesApi = {
    getAll: (params?: { parentId?: string | null }) =>
        apiClient.get<Category[]>('/api/categories', { params }),
    getById: (id: string) => apiClient.get<{ category: Category; products: Product[] }>(`/api/categories/${id}`),
    create: (data: Partial<Category>) => apiClient.post<Category>('/api/categories', data),
    update: (id: string, data: Partial<Category>) =>
        apiClient.patch<Category>(`/api/categories/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/categories/${id}`),
};

export const ordersApi = {
    getAll: (params?: { page?: number; limit?: number; status?: string }) =>
        apiClient.get<PaginatedResponse<Order>>('/api/orders', { params }),
    getById: (id: string) => apiClient.get<Order>(`/api/orders/${id}`),
    updateStatus: (id: string, status: string) =>
        apiClient.patch<Order>(`/api/orders/${id}/status`, { status }),
    createManual: (data: Partial<Order> & { items: OrderItem[]; customerId: string }) =>
        apiClient.post<Order>('/api/orders/manual', data),
    updatePaymentStatus: (id: string, paymentStatus: string, note?: string) =>
        apiClient.patch<Order>(`/api/orders/${id}/payment-status`, { paymentStatus, note }),
    getCourier: (id: string) => apiClient.get<CourierActionResponse>(`/api/orders/${id}/courier`),
    createCourier: (id: string) => apiClient.post<CourierActionResponse>(`/api/orders/${id}/courier/create`),
    syncCourier: (id: string) => apiClient.post<CourierActionResponse>(`/api/orders/${id}/courier/sync`),
    getAnalytics: (dateRange?: string) =>
        apiClient.get<{
            revenue: { total: number; period: string };
            ordersByStatus: Record<string, number>;
            ordersByPaymentStatus: Record<string, number>;
            ordersByShippingMethod: Record<string, number>;
            recentOrders: Order[];
        }>('/api/orders/analytics', { params: { dateRange } }),
};

export interface CourierIntegrationStatus {
    provider: 'steadfast';
    configured: boolean;
    connected: boolean;
    status: 'connected' | 'disabled' | 'error' | 'not_configured';
    deliveryType: 0 | 1;
    lastTestedAt?: string;
    lastErrorCode?: string;
}

export interface CourierActionResponse {
    created?: boolean;
    idempotent?: boolean;
    courier: Order['courier'];
    orderStatus?: Order['status'];
    orderNumber?: string;
}

export const courierIntegrationsApi = {
    getSteadfast: () => apiClient.get<CourierIntegrationStatus>('/api/courier-integrations/steadfast'),
    saveSteadfast: (data: { apiKey: string; secretKey: string; deliveryType: 0 | 1 }) =>
        apiClient.put<CourierIntegrationStatus>('/api/courier-integrations/steadfast', data),
    testSteadfast: () => apiClient.post<{ provider: 'steadfast'; configured: true; connected: true }>('/api/courier-integrations/steadfast/test'),
    disconnectSteadfast: () => apiClient.delete<CourierIntegrationStatus>('/api/courier-integrations/steadfast'),
};



export const meetingsApi = {
    getAll: (params?: { page?: number; limit?: number }) =>
        apiClient.get<PaginatedResponse<Meeting>>('/google/list-events', { params }),
    update: (id: string, data: Partial<Meeting>) =>
        apiClient.patch<Meeting>(`/admin/meetings/${id}`, data),
    delete: (id: string) => apiClient.delete(`/admin/meetings/${id}`),
};

export const unansweredApi = {
    getAll: () => apiClient.get<UnansweredQuestion[]>('/admin/unanswered'),
    resolve: (id: string) => apiClient.post(`/admin/unanswered/${id}/resolve`, {}),
};

export const availabilityApi = {
    get: () => apiClient.get<AvailabilitySettings>('/admin/availability'),
    update: (data: Partial<AvailabilitySettings>) =>
        apiClient.patch<AvailabilitySettings>('/admin/availability', data),
};

export const meetingHostsApi = {
    getAll: () => apiClient.get<MeetingHost[]>('/admin/hosts'),
    update: (id: string, data: Partial<MeetingHost>) =>
        apiClient.patch<MeetingHost>(`/admin/hosts/${id}`, data),
    bulkUpdate: (data: MeetingHost[]) =>
        apiClient.post<MeetingHost[]>('/admin/hosts/bulk', { hosts: data }),
};

export const analyticsApi = {
    get: () => apiClient.get<AnalyticsResponse>('/admin/analytics'),
};

export const errorsApi = {
    getAll: () => apiClient.get<ErrorLog[]>('/admin/errors'),
    delete: (id: string) => apiClient.delete(`/admin/errors/${id}`),
    clearAll: () => apiClient.post('/admin/errors/clear', {}),
};

export const aiUsageApi = {
    summary: (days = 30) => apiClient.get<{ period: { from: string; to: string; days: number }; requests: number; inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number | null }>('/api/ai-usage/summary', { params: { days } }),
};

export interface SetupStatus {
    business: boolean; productAdded: boolean; knowledgeAdded: boolean; aiTested: boolean;
    facebookConnected: boolean; websiteConnected: boolean; steadfastConnected: boolean; completed: boolean;
}
export const onboardingApi = {
    status: () => apiClient.get<SetupStatus>('/onboarding/status'),
    createBusiness: (data: Record<string, unknown>) => apiClient.post<{ accessToken: string; business: { id: string; name: string }; role: 'Owner'; needsOnboarding: false }>('/auth/business', data),
    addProduct: (data: Record<string, unknown>) => apiClient.post('/onboarding/product', data),
    addKnowledge: (data: Record<string, unknown>) => apiClient.post('/onboarding/knowledge', data),
    configureChannel: () => apiClient.post('/onboarding/channel', { platform: 'web' }),
    complete: () => apiClient.post<SetupStatus>('/onboarding/complete'),
};

export interface TestAiMessage { id: string; role: 'user' | 'assistant'; content: string; imageUrl?: string; createdAt: string; }
export interface TestAiState {
    conversation: { id: string; controlMode: string; createdAt: string; updatedAt: string } | null;
    messages: TestAiMessage[];
    usage: { aiReplies: number; totalTokens: number; estimatedCost: number };
    reply?: string;
}
export const testAiApi = {
    current: () => apiClient.get<TestAiState>(`${TEST_AI_API.base}${TEST_AI_API.currentConversation}`),
    history: () => apiClient.get<TestAiState>(`${TEST_AI_API.base}${TEST_AI_API.currentMessages}`),
    newConversation: () => apiClient.post<TestAiState>(`${TEST_AI_API.base}${TEST_AI_API.conversations}`),
    send: (message: string, imageUrl?: string) => apiClient.post<TestAiState>(`${TEST_AI_API.base}${TEST_AI_API.currentMessages}`, { message, imageUrl }),
};

export interface MerchantOverview {
    business: { name: string; onboardingComplete: boolean; onboarding: Record<string, unknown> } | null;
    conversations: number; humanControlled: number; customers: number; newCustomers: number; products: number; knowledge: number;
    orders: Record<string, number>; revenue: number; salesOrders: number;
    usage: { requests: number; totalTokens: number; estimatedCost: number };
    channels: Array<{ _id: string; platform: string; name: string; status: string }>;
    courier: string; recentOrders: Array<{ _id: string; orderNumber: string; total: number; status: string; createdAt: string }>; agentStatus: string;
}
export const dashboardApi = { overview: () => apiClient.get<MerchantOverview>('/api/dashboard/overview') };

export const trainingApi = {
    status: () => apiClient.get<TrainingOverview>('/api/training/status'),
    candidates: (params?: { status?: string; kind?: string }) => apiClient.get<TrainingCandidate[]>('/api/training/candidates', { params }),
    connectWebsite: (url: string) => apiClient.post<{ source: TrainingSource; run: TrainingRun }>('/api/training/sources/website', { url }),
    connectFacebook: (pageId: string) => apiClient.post<{ source: TrainingSource; run: TrainingRun }>('/api/training/sources/facebook', { pageId }),
    uploadFile: (file: File) => { const body = new FormData(); body.append('file', file); return apiClient.post<{ source: TrainingSource; run: TrainingRun; summary: { products: number; knowledge: number; warnings: string[] } }>('/api/training/sources/file', body); },
    addManual: (kind: 'faq'|'information', title: string, content: string) => apiClient.post('/api/training/sources/manual', { kind, title, content }),
    rescan: (id: string) => apiClient.post(`/api/training/sources/${id}/rescan`),
    retryFailed: (id: string) => apiClient.post(`/api/training/sources/${id}/retry-failed`),
    approveSafe: () => apiClient.post<{ approved: number; errors: Array<{ id: string; error: string }> }>('/api/training/approve-safe'),
    approve: (id: string) => apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/approve`),
    reject: (id: string) => apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/reject`),
    keepSeparate: (id: string) => apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/keep-separate`),
    merge: (id: string) => apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/merge`),
    resolve: (id: string, decisions: Record<string, { choice: 'current'|'imported'|'custom'; value?: unknown }>) => apiClient.post<TrainingCandidate>(`/api/training/candidates/${id}/resolve`, { decisions }),
    edit: (id: string, payload: Record<string, unknown>, title?: string) => apiClient.patch<TrainingCandidate>(`/api/training/candidates/${id}`, { payload, title }),
};

export interface TeamMember { _id: string; role: 'Owner'|'Admin'|'Staff'; status: string; userId: { _id: string; name: string; email: string; status: string } }
export interface BrandVoiceProfile { tone: 'friendly'|'professional'|'casual'|'premium'|'custom'; replyLength: 'short'|'balanced'|'detailed'; language: 'auto'|'bn'|'en'|'banglish'; salesBehavior: 'helpful'|'balanced'|'sales_focused'; emoji: 'none'|'light'|'normal'; customTone?: string; examples: string[] }
export interface BusinessProfile { _id: string; name: string; businessType?: string; phone?: string; website?: string; preferredLanguage: 'bn'|'en'; currency: 'BDT'; brandVoice?: BrandVoiceProfile }
export const businessApi = {
    get: () => apiClient.get<BusinessProfile>('/auth/business'), update: (data: Partial<BusinessProfile>) => apiClient.patch<BusinessProfile>('/auth/business', data),
    updateBrandVoice: (data: Partial<BrandVoiceProfile>) => apiClient.patch<BusinessProfile>('/auth/business/brand-voice', data),
    members: () => apiClient.get<TeamMember[]>('/auth/members'), addMember: (data: {name:string;email:string;password:string;role:string}) => apiClient.post<TeamMember>('/auth/members', data),
    updateMember: (id:string,data:{role?:string;status?:string}) => apiClient.patch<TeamMember>(`/auth/members/${id}`,data),
    channels: () => apiClient.get<Array<{_id:string;platform:string;name:string;status:string}>>('/auth/channels'),
};
