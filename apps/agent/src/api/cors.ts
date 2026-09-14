import type { CorsOptions, CorsOptionsDelegate } from 'cors';
import type { Request } from 'express';

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

/**
 * "http://localhost:3000/", "http://LOCALHOST:3000" and "http://localhost:3000"
 * are one origin as far as a browser is concerned, but string equality said
 * otherwise and the request was refused. Compare the parsed origin instead of
 * however it happened to be typed into the config.
 */
export function canonicalOrigin(value: string): string | undefined {
    const raw = String(value || '').trim();
    if (!raw) return undefined;
    try {
        const url = new URL(raw);
        return `${url.protocol}//${url.host}`.toLowerCase();
    } catch {
        return raw.replace(/\/+$/, '').toLowerCase() || undefined;
    }
}

const DEVELOPMENT_ORIGINS = [
    'http://localhost:3000', 'http://localhost:3001',
    'http://127.0.0.1:3000', 'http://127.0.0.1:3001',
];

export function resolveAllowedOrigins(env: Environment = process.env): Set<string> {
    const configured = [
        ...String(env.CORS_ORIGINS || '').split(','),
        String(env.DASHBOARD_URL || ''),
        String(env.PUBLIC_DASHBOARD_URL || ''),
    ]
        .map(canonicalOrigin)
        .filter((origin): origin is string => Boolean(origin));

    const production = env.NODE_ENV === 'production';
    const origins = new Set(configured.length ? configured : production ? [] : DEVELOPMENT_ORIGINS);

    // A developer who set CORS_ORIGINS to localhost still reaches the dashboard on
    // 127.0.0.1, and the other way round. Outside production these are the same
    // machine, so accept both spellings rather than failing a request that differs
    // only by how the host was typed into the address bar.
    if (!production) {
        for (const origin of [...origins]) {
            if (origin.includes('//localhost')) origins.add(origin.replace('//localhost', '//127.0.0.1'));
            if (origin.includes('//127.0.0.1')) origins.add(origin.replace('//127.0.0.1', '//localhost'));
        }
    }
    return origins;
}

// The headers the dashboard's own client sets today. A header missing from the
// preflight answer fails the whole request, not just that header, so this is a
// floor rather than a restriction: anything else a caller asks for is echoed
// back too. The origin check above is what actually gates access.
const BASELINE_HEADERS = ['Content-Type', 'Authorization', 'Idempotency-Key', 'Cache-Control', 'Pragma', 'X-Request-Id', 'X-Requested-With'];

export function allowedRequestHeaders(requested?: string | string[]) {
    const asked = (Array.isArray(requested) ? requested.join(',') : String(requested || ''))
        .split(',').map((header) => header.trim()).filter(Boolean);
    const seen = new Set(BASELINE_HEADERS.map((header) => header.toLowerCase()));
    return [...BASELINE_HEADERS, ...asked.filter((header) => !seen.has(header.toLowerCase()))];
}

export function buildCorsOptions(env: Environment = process.env, requestedHeaders?: string | string[]): CorsOptions {
    const allowedOrigins = resolveAllowedOrigins(env);
    return {
        origin(origin, callback) {
            // Refusing with an Error routes the request into the error handler,
            // which answers 500 with no CORS headers at all — the browser then
            // reports a bare "CORS error" and the real cause is invisible, even
            // for a preflight. Answering `false` completes the request normally,
            // simply without the allow header.
            const canonical = origin ? canonicalOrigin(origin) : undefined;
            if (!origin || (canonical && allowedOrigins.has(canonical))) return callback(null, true);
            console.warn('Blocked cross-origin request', { origin, allowed: [...allowedOrigins] });
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: allowedRequestHeaders(requestedHeaders),
        exposedHeaders: ['X-Request-Id'],
        maxAge: 600,
        optionsSuccessStatus: 204,
    };
}

/** The middleware options, resolved per request so a preflight's own header list survives. */
export function corsDelegate(env: Environment = process.env): CorsOptionsDelegate<Request> {
    return (request, callback) => callback(null, buildCorsOptions(env, request.headers['access-control-request-headers']));
}
