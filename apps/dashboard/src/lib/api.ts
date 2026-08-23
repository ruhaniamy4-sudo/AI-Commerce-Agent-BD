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
import { apiClient } from './api-client';

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
    getAnalytics: (dateRange?: string) =>
        apiClient.get<{
            revenue: { total: number; period: string };
            ordersByStatus: Record<string, number>;
            ordersByPaymentStatus: Record<string, number>;
            ordersByShippingMethod: Record<string, number>;
            recentOrders: Order[];
        }>('/api/orders/analytics', { params: { dateRange } }),
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
