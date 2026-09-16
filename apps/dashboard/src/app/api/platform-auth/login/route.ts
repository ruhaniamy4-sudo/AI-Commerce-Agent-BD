import { NextResponse } from 'next/server';
import { setPlatformCookie } from '@/lib/platform-session';

export async function POST(request: Request) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const upstream = await fetch(`${apiBase}/platform-auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()), cache: 'no-store' });
    const body = await upstream.json();
    if (!upstream.ok) return NextResponse.json({ error: body.error || 'Sign in failed' }, { status: upstream.status });
    const response = NextResponse.json({ admin: body.admin });
    setPlatformCookie(response, body.platformToken);
    return response;
}
