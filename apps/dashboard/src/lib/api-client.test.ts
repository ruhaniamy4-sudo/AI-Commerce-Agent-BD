import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const requestUse = vi.fn();
    const responseUse = vi.fn();
    const instance = {
        interceptors: {
            request: { use: requestUse },
            response: { use: responseUse },
        },
        get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), request: vi.fn(),
    };
    return {
        getSession: vi.fn(),
        requestUse,
        responseUse,
        instance,
        create: vi.fn(() => instance),
    };
});

vi.mock('axios', () => ({ default: { create: mocks.create } }));
vi.mock('next-auth/react', () => ({ getSession: mocks.getSession }));

import { ApiError, resetApiSessionForTests, shouldRetryQuery } from './api-client';

describe('shared Agent API authentication', () => {
    const requestInterceptor = () => mocks.requestUse.mock.calls[0][0];
    const responseErrorInterceptor = () => mocks.responseUse.mock.calls[0][1];

    beforeEach(() => {
        resetApiSessionForTests();
        mocks.getSession.mockReset();
        mocks.instance.request.mockReset();
        vi.unstubAllGlobals();
    });

    it('deduplicates session lookup and adds the merchant bearer token centrally', async () => {
        mocks.getSession.mockResolvedValue({ accessToken: 'merchant-token' });
        const first = { headers: { delete: vi.fn() } };
        const second = { headers: { delete: vi.fn() } };

        await Promise.all([requestInterceptor()(first), requestInterceptor()(second)]);

        expect(mocks.getSession).toHaveBeenCalledTimes(1);
        expect(first.headers).toMatchObject({ Authorization: 'Bearer merchant-token' });
        expect(second.headers).toMatchObject({ Authorization: 'Bearer merchant-token' });
    });

    it('treats an unrefreshable 401 as terminal and emits only one authentication event', async () => {
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { dispatchEvent });
        const failure = { response: { status: 401, data: { error: 'expired' } }, message: 'unauthorized' };

        await expect(responseErrorInterceptor()(failure)).rejects.toBeInstanceOf(ApiError);
        await expect(responseErrorInterceptor()(failure)).rejects.toBeInstanceOf(ApiError);

        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        expect(shouldRetryQuery(0, new ApiError('expired', 401))).toBe(false);
        expect(shouldRetryQuery(0, new ApiError('temporary', 503))).toBe(true);
        expect(shouldRetryQuery(2, new ApiError('temporary', 503))).toBe(false);
    });

    it('refreshes the NextAuth session once and retries with a rotated access token', async () => {
        mocks.getSession.mockResolvedValue({ accessToken: 'rotated-token' });
        mocks.instance.request.mockResolvedValue({ ok: true });
        const failure = {
            response: { status: 401, data: { error: 'expired' } }, message: 'unauthorized',
            config: { headers: { Authorization: 'Bearer expired-token' } },
        };
        await expect(responseErrorInterceptor()(failure)).resolves.toEqual({ ok: true });
        expect(failure.config.headers.Authorization).toBe('Bearer rotated-token');
        expect(mocks.instance.request).toHaveBeenCalledTimes(1);
    });

    it('uses bounded no-cache requests and recovers once from a stale 304 response', async () => {
        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
            timeout: 15_000,
            headers: expect.objectContaining({ 'Cache-Control': 'no-cache' }),
        }));
        mocks.instance.request.mockResolvedValue({ business: { name: 'Merchant' } });
        const failure = {
            response: { status: 304, data: undefined }, message: 'Not Modified',
            config: { headers: {}, params: {} },
        };
        await expect(responseErrorInterceptor()(failure)).resolves.toEqual({ business: { name: 'Merchant' } });
        expect(failure.config.params).toEqual(expect.objectContaining({ _fresh: expect.any(Number) }));
        expect(mocks.instance.request).toHaveBeenCalledTimes(1);
    });
});
