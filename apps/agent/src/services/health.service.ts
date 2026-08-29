import mongoose from 'mongoose';
import Redis from 'ioredis';
import { getAIConfiguration, getRedisConfig, getRuntimeStatus, validateConfiguration } from '../config/runtime';

export type RedisHealth = 'connected' | 'not_configured' | 'unavailable';

export async function checkRedis(): Promise<RedisHealth> {
    const config = getRedisConfig();
    if (!config) return 'not_configured';
    const client = new Redis({ ...config, lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 0, enableOfflineQueue: false });
    try {
        await client.connect();
        return await client.ping() === 'PONG' ? 'connected' : 'unavailable';
    } catch {
        return 'unavailable';
    } finally {
        client.disconnect();
    }
}

export async function getHealthStatus() {
    const runtime = getRuntimeStatus();
    const mongo = mongoose.connection.readyState === 1 ? 'connected' : 'unavailable';
    const redis = await checkRedis();
    return {
        status: mongo === 'connected' ? 'ok' : 'degraded',
        api: 'up',
        mongo,
        redis,
        worker: 'external',
        aiProvider: getAIConfiguration().provider,
        aiConfigured: runtime.aiConfigured,
        facebook: runtime.facebookConfigured ? 'configured' : 'not_configured',
        steadfastEncryption: runtime.steadfastEncryptionConfigured ? 'configured' : 'not_configured',
    };
}

export function printDeveloperStatus(mongo: 'Connected' | 'Unavailable') {
    const runtime = getRuntimeStatus();
    const missingCore = validateConfiguration().filter((item) => item.category === 'core' && !item.configured).map((item) => item.name);
    const lines = [
        'SellPilot Agent',
        `MongoDB: ${mongo}`,
        `AI: ${runtime.aiProvider === 'groq' ? 'Groq' : 'OpenAI'} ${runtime.aiConfigured ? 'configured' : 'not configured'}`,
        `Redis: ${runtime.redisConfigured ? 'Configured' : 'Not configured'}`,
        `Queue features: ${runtime.redisConfigured ? 'Available (worker runs separately)' : 'Disabled'}`,
        `Facebook: ${runtime.facebookConfigured ? 'Configured' : 'Not configured'}`,
        `Steadfast: ${runtime.steadfastEncryptionConfigured ? 'Configured' : 'Not configured'}`,
    ];
    if (missingCore.length) lines.push(`Configuration needed: ${missingCore.join(', ')}`);
    console.log(lines.join('\n'));
}
