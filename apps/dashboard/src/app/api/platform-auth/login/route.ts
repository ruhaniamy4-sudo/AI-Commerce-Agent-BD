import { NextResponse } from 'next/server';
const cookieName = 'sellpilot-platform-session';
export async function POST(request: Request) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) return NextResponse.json({ error: 'Agent API is not configured' }, { status: 503 });
    const upstream = await fetch(`${apiBase}/platform-auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()), cache: 'no-store' });
    const body = await upstream.json();
    if (!upstream.ok) return NextResponse.json({ error: body.error || 'Sign in failed' }, { status: upstream.status });
    const response = NextResponse.json({ admin: body.admin });
    response.cookies.set(cookieName, body.platformToken, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 });
    return response;
}
