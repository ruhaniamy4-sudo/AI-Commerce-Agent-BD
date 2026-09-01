import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { getRedisConfig } from '../config/runtime';

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();
let requestCount = 0;
let redis: Redis | null | undefined;

function redisClient() {
    if (process.env.NODE_ENV === 'test') return null;
    if (redis !== undefined) return redis;
    const config = getRedisConfig();
    if (!config) return redis = null;
    redis = new Redis({ ...config, lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 1000 });
    redis.on('error', () => undefined);
    return redis;
}

function localHit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    requestCount += 1;
    if (requestCount % 256 === 0) {
        for (const [candidate, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(candidate);
        while (buckets.size > 50_000) buckets.delete(buckets.keys().next().value as string);
    }
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    return { count: bucket.count, resetAt: bucket.resetAt, limit };
}

async function distributedHit(key: string, limit: number, windowMs: number) {
    const client = redisClient();
    if (!client) return null;
    try {
        if (client.status === 'wait') await client.connect();
        const window = Math.floor(Date.now() / windowMs);
        const redisKey = `sellpilot:auth-rate:${key}:${window}`;
        const count = await client.incr(redisKey);
        if (count === 1) await client.pexpire(redisKey, windowMs + 1000);
        return { count, resetAt: (window + 1) * windowMs, limit };
    } catch {
        return null;
    }
}

export function authRateLimit(options: { limit?: number; windowMs?: number } = {}) {
    const limit = options.limit ?? 20;
    const windowMs = options.windowMs ?? 15 * 60 * 1000;
    return async (req: Request, res: Response, next: NextFunction) => {
        const identity = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
        const key = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 32);
        const hit = await distributedHit(key, limit, windowMs) || localHit(key, limit, windowMs);
        res.setHeader('RateLimit-Limit', String(limit));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - hit.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(hit.resetAt / 1000)));
        if (hit.count > limit) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
        return next();
    };
}

export function clearAuthRateLimitsForTests() { buckets.clear(); requestCount = 0; }
