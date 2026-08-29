import { afterEach, describe, expect, it } from 'vitest';
import { getHealthStatus } from './health.service';

describe('health status', () => {
    afterEach(() => {
        delete process.env.REDIS_URL;
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_PORT;
        delete process.env.GROQ_API_KEY;
        delete process.env.AUTH_JWT_SECRET;
    });

    it('reports no-Redis core mode without connecting or crashing', async () => {
        const health = await getHealthStatus();
        expect(health.redis).toBe('not_configured');
        expect(health.worker).toBe('external');
    });

    it('never returns secret values', async () => {
        process.env.GROQ_API_KEY = 'super-secret-groq-value';
        process.env.AUTH_JWT_SECRET = 'super-secret-auth-value';
        const serialized = JSON.stringify(await getHealthStatus());
        expect(serialized).not.toContain(process.env.GROQ_API_KEY);
        expect(serialized).not.toContain(process.env.AUTH_JWT_SECRET);
        expect(serialized).toContain('aiConfigured');
    });
});
