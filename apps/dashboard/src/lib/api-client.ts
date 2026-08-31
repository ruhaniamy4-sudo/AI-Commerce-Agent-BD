import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';
import type { Session } from 'next-auth';

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

export function shouldRetryQuery(failureCount: number, error: unknown) {
    return !(error instanceof ApiError && error.status === 401) && failureCount < 2;
}

const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const AUTHENTICATION_REQUIRED_EVENT = 'sellpilot:authentication-required';

let cachedSession: Session | null | undefined;
let sessionRequest: Promise<Session | null> | undefined;
let authenticationRequired = false;

function sessionToken(session: Session | null | undefined) {
    return session?.accessToken || session?.accountToken;
}

export function setApiSession(session: Session | null | undefined) {
    cachedSession = session;
    if (sessionToken(session)) authenticationRequired = false;
}

export function resetApiSessionForTests() {
    cachedSession = undefined;
    sessionRequest = undefined;
    authenticationRequired = false;
}

async function getApiSession() {
    if (cachedSession !== undefined) return cachedSession;
    if (!sessionRequest) {
        sessionRequest = getSession()
            .then((session) => {
                cachedSession = session;
                return session;
            })
            .finally(() => {
                sessionRequest = undefined;
            });
    }
    return sessionRequest;
}

function notifyAuthenticationRequired() {
    cachedSession = undefined;
    if (authenticationRequired || typeof window === 'undefined') return;
    authenticationRequired = true;
    window.dispatchEvent(new Event(AUTHENTICATION_REQUIRED_EVENT));
}

// Request Interceptor
axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            config.headers.delete('Content-Type');
        }
        const token = sessionToken(await getApiSession());
        if (token) config.headers.Authorization = `Bearer ${token}`;
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
        if (status === 401) notifyAuthenticationRequired();
        const data = error.response?.data as Record<string, unknown>;
        const message = (data?.message as string) || (data?.error as string) || error.message || 'An unexpected error occurred';

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
