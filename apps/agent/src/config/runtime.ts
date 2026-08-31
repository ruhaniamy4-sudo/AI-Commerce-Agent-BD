import type { RedisOptions } from 'ioredis';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';

export type ConfigCategory = 'core' | 'feature' | 'optional';

export interface ConfigCheck {
    name: string;
    category: ConfigCategory;
    configured: boolean;
    feature?: string;
}

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function getAIProvider(env: Environment = process.env): 'groq' | 'openai' {
    return String(env.AI_PROVIDER || 'groq').trim().toLowerCase() === 'openai' ? 'openai' : 'groq';
}

export function getAIConfiguration(env: Environment = process.env) {
    const provider = getAIProvider(env);
    if (provider === 'groq') {
        return { provider, configured: Boolean(env.GROQ_API_KEY), apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' } as const;
    }
    return { provider, configured: Boolean(env.OPENAI_API_KEY), apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || 'gpt-5.2', baseURL: undefined } as const;
}

export function getRedisConfig(env: Environment = process.env): RedisOptions | undefined {
    const redisUrl = String(env.REDIS_URL || '').trim();
    if (redisUrl) {
        const parsed = new URL(redisUrl);
        if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') throw new Error('REDIS_URL must use redis:// or rediss://');
        const database = parsed.pathname.replace(/^\//, '');
        return {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : 6379,
            username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            db: database ? Number(database) : undefined,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
            maxRetriesPerRequest: null,
        };
    }
    const host = String(env.REDIS_HOST || '').trim();
    const port = String(env.REDIS_PORT || '').trim();
    if (!host && !port) return undefined;
    return { host: host || '127.0.0.1', port: port ? Number(port) : 6379, password: env.REDIS_PASSWORD, maxRetriesPerRequest: null };
}

export function requireRedisConfig(env: Environment = process.env) {
    const connection = getRedisConfig(env);
    if (!connection) throw new Error('Redis is not configured. Queue-based integrations are disabled. Set REDIS_URL to enable them.');
    return connection;
}

export function validateConfiguration(env: Environment = process.env): ConfigCheck[] {
    const ai = getAIConfiguration(env);
    return [
        { name: 'MONGODB_URI', category: 'core', configured: Boolean(env.MONGODB_URI) },
        { name: 'AUTH_JWT_SECRET', category: 'core', configured: Boolean(env.AUTH_JWT_SECRET) },
        { name: ai.provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY', category: 'core', configured: ai.configured },
        { name: 'REDIS_URL', category: 'feature', feature: 'queues', configured: Boolean(getRedisConfig(env)) },
        { name: 'FB_APP_SECRET', category: 'feature', feature: 'facebook', configured: Boolean((env.FB_APP_ID || env.FACEBOOK_APP_ID) && env.FB_APP_SECRET && env.FB_VERIFY_TOKEN && env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY && env.PUBLIC_AGENT_URL && env.DASHBOARD_URL) },
        { name: 'COURIER_CREDENTIALS_ENCRYPTION_KEY', category: 'feature', feature: 'steadfast', configured: Boolean(env.COURIER_CREDENTIALS_ENCRYPTION_KEY) },
        { name: 'CLOUDINARY', category: 'optional', feature: 'uploads', configured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) },
        { name: 'GOOGLE_OAUTH', category: 'optional', feature: 'google', configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) },
        { name: 'BOOTSTRAP_OWNER_PASSWORD', category: 'feature', feature: 'bootstrap-owner', configured: Boolean(env.BOOTSTRAP_OWNER_EMAIL && env.BOOTSTRAP_OWNER_PASSWORD && env.BOOTSTRAP_OWNER_PASSWORD.length >= PASSWORD_MIN_LENGTH) },
        { name: 'PLATFORM_ADMIN_PASSWORD', category: 'optional', feature: 'platform-admin', configured: Boolean(env.PLATFORM_ADMIN_EMAIL && env.PLATFORM_ADMIN_PASSWORD && env.PLATFORM_ADMIN_PASSWORD.length >= PASSWORD_MIN_LENGTH) },
    ];
}

export function getRuntimeStatus(env: Environment = process.env) {
    const ai = getAIConfiguration(env);
    return {
        aiProvider: ai.provider,
        aiConfigured: ai.configured,
        redisConfigured: Boolean(getRedisConfig(env)),
        facebookConfigured: Boolean((env.FB_APP_ID || env.FACEBOOK_APP_ID) && env.FB_APP_SECRET && env.FB_VERIFY_TOKEN && env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY && env.PUBLIC_AGENT_URL && env.DASHBOARD_URL),
        steadfastEncryptionConfigured: Boolean(env.COURIER_CREDENTIALS_ENCRYPTION_KEY),
    };
}
