import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PLATFORM_COOKIE, renewPlatformToken, setPlatformCookie, shouldRenewPlatformToken } from '@/lib/platform-session';

async function proxy(request: Request, context: { params: { path: string[] } }) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const token = cookies().get(PLATFORM_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: 'Platform administrator authentication required' }, { status: 401 });
    const source = new URL(request.url); const target = `${apiBase}/platform-admin/${context.params.path.join('/')}${source.search}`;
    const upstream = await fetch(target, { method: request.method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: ['GET','HEAD'].includes(request.method) ? undefined : await request.text(), cache: 'no-store' });
    const text = await upstream.text();
    const response = new NextResponse(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' } });
    // Platform admins have no refresh-token family, so an admin who is still
    // working slides their token forward here instead of being signed out mid-task.
    if (upstream.ok && shouldRenewPlatformToken(token)) {
        const renewed = await renewPlatformToken(apiBase, token);
        if (renewed) setPlatformCookie(response, renewed);
    }
    return response;
}
export const GET = proxy; export const POST = proxy; export const PATCH = proxy; export const PUT = proxy; export const DELETE = proxy;
