import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAdmin } from '../models/PlatformAdmin';
import { ensurePlatformAdmin } from './platform-admin-bootstrap.service';

describe('platform administrator bootstrap password validation', () => {
    const originalEmail = process.env.PLATFORM_ADMIN_EMAIL;
    const originalPassword = process.env.PLATFORM_ADMIN_PASSWORD;

    beforeEach(() => {
        vi.restoreAllMocks();
        process.env.PLATFORM_ADMIN_EMAIL = 'admin@example.com';
    });

    afterEach(() => {
        if (originalEmail === undefined) delete process.env.PLATFORM_ADMIN_EMAIL;
        else process.env.PLATFORM_ADMIN_EMAIL = originalEmail;
        if (originalPassword === undefined) delete process.env.PLATFORM_ADMIN_PASSWORD;
        else process.env.PLATFORM_ADMIN_PASSWORD = originalPassword;
    });

    it('accepts a strong platform administrator password', async () => {
        process.env.PLATFORM_ADMIN_PASSWORD = 'AdminPass1!';
        vi.spyOn(PlatformAdmin, 'findOne').mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) } as any);
        const create = vi.spyOn(PlatformAdmin, 'create').mockResolvedValue({} as any);

        await expect(ensurePlatformAdmin()).resolves.toBeUndefined();
        expect(create).toHaveBeenCalledOnce();
    });

    it('rejects a seven-character platform administrator password', async () => {
        process.env.PLATFORM_ADMIN_PASSWORD = '1234567';
        const create = vi.spyOn(PlatformAdmin, 'create');

        await expect(ensurePlatformAdmin()).rejects.toThrow('at least 10 characters');
        expect(create).not.toHaveBeenCalled();
    });
});
