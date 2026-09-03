import { NextResponse } from 'next/server';

const endpoints: Record<string, string> = {
    'password-reset-request': '/auth/password-reset/request',
    'password-reset-confirm': '/auth/password-reset/confirm',
    'email-verification-request': '/auth/email-verification/request',
    'email-verification-confirm': '/auth/email-verification/confirm',
};

export async function POST(request: Request, { params }: { params: { action: string } }) {
    const endpoint = endpoints[params.action];
    if (!endpoint) return NextResponse.json({ error: 'Unknown authentication action' }, { status: 404 });
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    try {
        const response = await fetch(`${apiBase}${endpoint}`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()), cache: 'no-store',
        });
        const body = await response.json().catch(() => ({ error: 'Authentication service is unavailable' }));
        return NextResponse.json(body, { status: response.status });
    } catch {
        return NextResponse.json({ error: 'Authentication service is unavailable' }, { status: 502 });
    }
}
