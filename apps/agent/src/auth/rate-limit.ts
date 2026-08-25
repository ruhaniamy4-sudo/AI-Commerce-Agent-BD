import { NextFunction, Request, Response } from 'express';

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function authRateLimit(options: { limit?: number; windowMs?: number } = {}) {
    const limit = options.limit ?? 20;
    const windowMs = options.windowMs ?? 15 * 60 * 1000;
    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
        const current = buckets.get(key);
        const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
        bucket.count += 1;
        buckets.set(key, bucket);
        res.setHeader('RateLimit-Limit', String(limit));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > limit) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
        return next();
    };
}

export function clearAuthRateLimitsForTests() { buckets.clear(); }
