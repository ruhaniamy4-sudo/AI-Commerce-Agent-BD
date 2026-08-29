import { afterEach, describe, expect, it } from 'vitest';
import { getAIConfiguration, getRedisConfig, requireRedisConfig, validateConfiguration } from './runtime';

describe('runtime configuration', () => {
    afterEach(() => {
        delete process.env.REDIS_URL;
        delete process.env.REDIS_HOST;
        delete process.env.REDIS_PORT;
    });

    it('parses REDIS_URL including TLS and credentials', () => {
        const config = getRedisConfig({ REDIS_URL: 'rediss://user:p%40ss@redis.example.com:6380/2' });
        expect(config).toMatchObject({ host: 'redis.example.com', port: 6380, username: 'user', password: 'p@ss', db: 2, tls: {} });
    });

    it('prioritizes REDIS_URL over legacy host and port', () => {
        const config = getRedisConfig({ REDIS_URL: 'redis://managed:6380', REDIS_HOST: 'legacy', REDIS_PORT: '6379' });
        expect(config).toMatchObject({ host: 'managed', port: 6380 });
    });

    it('supports REDIS_HOST and REDIS_PORT fallback', () => {
        expect(getRedisConfig({ REDIS_HOST: 'localhost', REDIS_PORT: '6381' })).toMatchObject({ host: 'localhost', port: 6381 });
    });

    it('allows core mode without Redis while requiring it for workers', () => {
        expect(getRedisConfig({})).toBeUndefined();
        expect(() => requireRedisConfig({})).toThrow('Redis is not configured');
    });

    it('categorizes core, feature, and optional settings without globally requiring integrations', () => {
        const checks = validateConfiguration({ MONGODB_URI: 'mongodb+srv://example', AUTH_JWT_SECRET: 'secret', AI_PROVIDER: 'groq', GROQ_API_KEY: 'key' });
        expect(checks.filter((item) => item.category === 'core').every((item) => item.configured)).toBe(true);
        expect(checks.find((item) => item.feature === 'facebook')).toMatchObject({ category: 'feature', configured: false });
        expect(checks.find((item) => item.feature === 'google')).toMatchObject({ category: 'optional', configured: false });
    });

    it('selects Groq by default and preserves OpenAI selection', () => {
        expect(getAIConfiguration({ GROQ_API_KEY: 'groq' })).toMatchObject({ provider: 'groq', configured: true });
        expect(getAIConfiguration({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'openai' })).toMatchObject({ provider: 'openai', configured: true });
    });

    it('validates bootstrap and platform-admin passwords at eight characters', () => {
        const short = validateConfiguration({ BOOTSTRAP_OWNER_EMAIL: 'owner@example.com', BOOTSTRAP_OWNER_PASSWORD: '1234567', PLATFORM_ADMIN_EMAIL: 'admin@example.com', PLATFORM_ADMIN_PASSWORD: '1234567' });
        expect(short.find((item) => item.feature === 'bootstrap-owner')?.configured).toBe(false);
        expect(short.find((item) => item.feature === 'platform-admin')?.configured).toBe(false);

        const valid = validateConfiguration({ BOOTSTRAP_OWNER_EMAIL: 'owner@example.com', BOOTSTRAP_OWNER_PASSWORD: '12345678', PLATFORM_ADMIN_EMAIL: 'admin@example.com', PLATFORM_ADMIN_PASSWORD: '12345678' });
        expect(valid.find((item) => item.feature === 'bootstrap-owner')?.configured).toBe(true);
        expect(valid.find((item) => item.feature === 'platform-admin')?.configured).toBe(true);
    });
});
