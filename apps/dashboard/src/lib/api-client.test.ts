import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const requestUse = vi.fn();
    const responseUse = vi.fn();
    return {
        getSession: vi.fn(),
        requestUse,
        responseUse,
        instance: {
            interceptors: {
                request: { use: requestUse },
                response: { use: responseUse },
            },
            get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
        },
    };
});

vi.mock('axios', () => ({ default: { create: () => mocks.instance } }));
vi.mock('next-auth/react', () => ({ getSession: mocks.getSession }));

import { ApiError, resetApiSessionForTests, shouldRetryQuery } from './api-client';

describe('shared Agent API authentication', () => {
    const requestInterceptor = () => mocks.requestUse.mock.calls[0][0];
    const responseErrorInterceptor = () => mocks.responseUse.mock.calls[0][1];

    beforeEach(() => {
        resetApiSessionForTests();
        mocks.getSession.mockReset();
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

    it('treats a 401 as terminal and emits only one authentication event', () => {
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { dispatchEvent });
        const failure = { response: { status: 401, data: { error: 'expired' } }, message: 'unauthorized' };

        expect(() => responseErrorInterceptor()(failure)).toThrow(ApiError);
        expect(() => responseErrorInterceptor()(failure)).toThrow(ApiError);

        expect(dispatchEvent).toHaveBeenCalledTimes(1);
        expect(shouldRetryQuery(0, new ApiError('expired', 401))).toBe(false);
        expect(shouldRetryQuery(0, new ApiError('temporary', 503))).toBe(true);
        expect(shouldRetryQuery(2, new ApiError('temporary', 503))).toBe(false);
    });
});
