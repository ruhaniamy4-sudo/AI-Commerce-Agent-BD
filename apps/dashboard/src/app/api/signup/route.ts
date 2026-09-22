import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    try {
        const upstream = await fetch(`${apiBase}/auth/signup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(await request.json()),
            cache: 'no-store',
        });
        // Anything that is not JSON — a proxy error page, a crash — used to throw
        // here and surface as a blank 500 rather than a message the visitor can act on.
        const body = await upstream.json().catch(() => null);
        if (!body) return NextResponse.json({ error: 'The account service is unavailable. Please try again.' }, { status: upstream.ok ? 502 : upstream.status });
        return NextResponse.json(body, { status: upstream.status });
    } catch (error) {
        console.error('[SIGNUP] Could not reach the agent:', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'The account service is unreachable. Please try again in a moment.' }, { status: 503 });
    }
}
