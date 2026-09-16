import { PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS, PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS } from '@edutechs/shared';
import type { NextResponse } from 'next/server';

export const PLATFORM_COOKIE = 'sellpilot-platform-session';

/**
 * The cookie outlives a single token so a returning admin still has something to
 * renew with; the agent enforces the real limits either way.
 */
export function setPlatformCookie(response: NextResponse, token: string, maxAgeSeconds = PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS) {
    response.cookies.set(PLATFORM_COOKIE, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: Math.max(60, Math.round(maxAgeSeconds)),
    });
}

/** Runs in the Edge middleware as well as Node, so it cannot reach for Buffer. */
function decodeBase64Url(value: string) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    if (typeof atob === 'function') return atob(base64);
    return Buffer.from(base64, 'base64').toString('binary');
}

/** Reads `exp` without verifying — the agent is the only thing that trusts this token. */
export function tokenSecondsRemaining(token: string) {
    const [, body] = token.split('.');
    if (!body) return 0;
    try {
        const payload = JSON.parse(decodeBase64Url(body)) as { exp?: number };
        if (typeof payload.exp !== 'number') return 0;
        return payload.exp - Math.floor(Date.now() / 1000);
    } catch {
        return 0;
    }
}

/** A cookie whose token has already expired is no longer a signed-in admin. */
export function hasLivePlatformToken(token: string | undefined) {
    return Boolean(token) && tokenSecondsRemaining(token!) > 0;
}

/** Renew once the token is over halfway through its life, not on every request. */
export function shouldRenewPlatformToken(token: string) {
    const remaining = tokenSecondsRemaining(token);
    return remaining > 0 && remaining < PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS / 2;
}

export async function renewPlatformToken(apiBase: string, token: string) {
    try {
        const upstream = await fetch(`${apiBase}/platform-auth/renew`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            cache: 'no-store',
        });
        if (!upstream.ok) return null;
        const body = await upstream.json() as { platformToken?: string };
        return body.platformToken || null;
    } catch {
        // A renewal that cannot reach the agent must not break the request it rode along with.
        return null;
    }
}
