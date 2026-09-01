import crypto from 'node:crypto';
import { ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS, MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS } from '@edutechs/shared';
import { BusinessRole } from '../tenancy/context';

export interface AccessTokenPayload {
    sub: string;
    purpose: 'merchant';
    businessId: string;
    membershipId: string;
    role: BusinessRole;
    sid?: string;
    iat: number;
    exp: number;
}

export interface AccountTokenPayload {
    sub: string;
    purpose: 'account';
    sid?: string;
    iat: number;
    exp: number;
}

export interface PlatformAdminTokenPayload {
    sub: string;
    purpose: 'platform-admin';
    iat: number;
    exp: number;
}

function secret() {
    const value = process.env.AUTH_JWT_SECRET;
    if (!value || value.length < 32) throw new Error('AUTH_JWT_SECRET must contain at least 32 characters');
    return value;
}

function encode(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signPayload(payload: Record<string, unknown>, ttlSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const body = encode({ ...payload, iat: now, exp: now + ttlSeconds });
    const signature = crypto.createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyPayload(token: string): Record<string, unknown> {
    const [header, body, suppliedSignature] = token.split('.');
    if (!header || !body || !suppliedSignature) throw new Error('Malformed access token');
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') throw new Error('Unsupported access token');
    const expected = crypto.createHmac('sha256', secret()).update(`${header}.${body}`).digest();
    const supplied = Buffer.from(suppliedSignature, 'base64url');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error('Invalid access token');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('Access token expired');
    return payload;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'purpose'>, ttlSeconds = MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS) {
    return signPayload({ ...payload, purpose: 'merchant' }, ttlSeconds);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    const payload = verifyPayload(token) as unknown as AccessTokenPayload;
    if (!payload.sub || payload.purpose !== 'merchant' || !payload.businessId || !payload.membershipId || !payload.role) throw new Error('Invalid merchant token claims');
    return payload;
}

export function signAccountToken(userId: string, sessionId?: string, ttlSeconds = ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS) {
    return signPayload({ sub: userId, purpose: 'account', ...(sessionId ? { sid: sessionId } : {}) }, ttlSeconds);
}

export function verifyAccountToken(token: string): AccountTokenPayload {
    const payload = verifyPayload(token) as unknown as AccountTokenPayload;
    if (!payload.sub || payload.purpose !== 'account') throw new Error('Invalid account token claims');
    return payload;
}

export function signPlatformAdminToken(adminId: string, ttlSeconds = 3600) {
    return signPayload({ sub: adminId, purpose: 'platform-admin' }, ttlSeconds);
}

export function verifyPlatformAdminToken(token: string): PlatformAdminTokenPayload {
    const payload = verifyPayload(token) as unknown as PlatformAdminTokenPayload;
    if (!payload.sub || payload.purpose !== 'platform-admin') throw new Error('Invalid platform admin token claims');
    return payload;
}
