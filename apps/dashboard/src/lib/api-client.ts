import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public response?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const session = await getSession();
        if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Response Interceptor
axiosInstance.interceptors.response.use(
    (response) => response.data,
    (error: AxiosError) => {
        const status = error.response?.status || 500;
        const data = error.response?.data as Record<string, unknown>;
        const message = (data?.message as string) || error.message || 'An unexpected error occurred';

        throw new ApiError(message, status, data);
    }
);

export const apiClient = {
    get: <T>(endpoint: string, options?: { params?: Record<string, string | number | boolean | undefined | null> }): Promise<T> =>
        axiosInstance.get(endpoint, { params: options?.params }),

    post: <T>(endpoint: string, data?: unknown): Promise<T> =>
        axiosInstance.post(endpoint, data),

    put: <T>(endpoint: string, data?: unknown): Promise<T> =>
        axiosInstance.put(endpoint, data),

    patch: <T>(endpoint: string, data?: unknown): Promise<T> =>
        axiosInstance.patch(endpoint, data),

    delete: <T>(endpoint: string): Promise<T> =>
        axiosInstance.delete(endpoint),
};
