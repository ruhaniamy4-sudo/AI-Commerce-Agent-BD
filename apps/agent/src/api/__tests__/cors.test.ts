import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { allowedRequestHeaders, canonicalOrigin, corsDelegate, resolveAllowedOrigins } from '../cors';

const dashboard = 'http://localhost:3000';

function serve(env: Record<string, string | undefined>) {
    return express()
        .use(cors(corsDelegate(env)))
        .get('/api/products', (_request, response) => response.json({ ok: true }))
        .use((_request, response) => response.status(404).json({ error: 'Route not found' }));
}

describe('cross-origin access for the dashboard', () => {
    it('reads an origin however the merchant typed it into the config', () => {
        expect(canonicalOrigin('http://LOCALHOST:3000/')).toBe(dashboard);
        expect(canonicalOrigin('  http://localhost:3000  ')).toBe(dashboard);
        expect(canonicalOrigin('https://app.sellpilot.com/dashboard')).toBe('https://app.sellpilot.com');
    });

    it('allows the dashboard and answers the preflight with the headers it actually sends', async () => {
        const app = serve({ CORS_ORIGINS: dashboard, NODE_ENV: 'test' });
        const preflight = await request(app)
            .options('/api/products')
            .set('Origin', dashboard)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'authorization,idempotency-key,cache-control');

        expect(preflight.status).toBe(204);
        expect(preflight.headers['access-control-allow-origin']).toBe(dashboard);
        expect(preflight.headers['access-control-allow-credentials']).toBe('true');
        // Every header the dashboard's axios client sets has to be named back, or
        // the browser fails the whole request rather than stripping one header.
        const allowed = String(preflight.headers['access-control-allow-headers']).toLowerCase();
        for (const header of ['authorization', 'idempotency-key', 'cache-control', 'pragma', 'content-type']) {
            expect(allowed).toContain(header);
        }
        expect(String(preflight.headers['access-control-expose-headers']).toLowerCase()).toContain('x-request-id');
    });

    it('treats localhost and 127.0.0.1 as the same machine outside production', async () => {
        const app = serve({ CORS_ORIGINS: dashboard, NODE_ENV: 'development' });
        const response = await request(app).get('/api/products').set('Origin', 'http://127.0.0.1:3000');
        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    });

    it('does not answer a blocked origin with a 500', async () => {
        // Rejecting with an Error fell through to the generic error handler, which
        // replied 500 with no CORS headers on it at all — so the browser reported
        // "CORS error" and the server log showed an unhandled request error.
        const app = serve({ CORS_ORIGINS: dashboard, NODE_ENV: 'test' });
        const response = await request(app).get('/api/products').set('Origin', 'http://evil.example');
        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();

        // A blocked preflight is simply not short-circuited by the CORS layer any
        // more: it falls through to the ordinary routing, without an allow header
        // and without an unhandled error.
        const preflight = await request(app)
            .options('/api/products')
            .set('Origin', 'http://evil.example')
            .set('Access-Control-Request-Method', 'POST');
        expect(preflight.status).toBeLessThan(500);
        expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('echoes a header it has never heard of rather than failing the call', async () => {
        // An allowlist that is a ceiling turns any newly added client header into
        // exactly the "CORS error" this is meant to prevent. The origin check is
        // the gate; the header list is a floor.
        expect(allowedRequestHeaders('x-sellpilot-trace')).toContain('x-sellpilot-trace');
        expect(allowedRequestHeaders('authorization')).toEqual(expect.arrayContaining(['Authorization']));
        expect(allowedRequestHeaders('AUTHORIZATION').filter((header) => /^authorization$/i.test(header))).toHaveLength(1);

        const app = serve({ CORS_ORIGINS: dashboard, NODE_ENV: 'test' });
        const preflight = await request(app)
            .options('/api/products')
            .set('Origin', dashboard)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'x-sellpilot-trace');
        expect(String(preflight.headers['access-control-allow-headers']).toLowerCase()).toContain('x-sellpilot-trace');
    });

    it('serves a request that carries no origin at all', async () => {
        const app = serve({ CORS_ORIGINS: dashboard, NODE_ENV: 'test' });
        await request(app).get('/api/products').expect(200);
    });

    it('allows nothing by default in production and the dev dashboard otherwise', () => {
        expect([...resolveAllowedOrigins({ NODE_ENV: 'production' })]).toEqual([]);
        expect(resolveAllowedOrigins({ NODE_ENV: 'development' }).has(dashboard)).toBe(true);
        expect(resolveAllowedOrigins({ NODE_ENV: 'production', DASHBOARD_URL: 'https://app.sellpilot.com' }).has('https://app.sellpilot.com')).toBe(true);
    });
});
