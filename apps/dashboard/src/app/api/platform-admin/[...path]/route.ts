import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
async function proxy(request: Request, context: { params: { path: string[] } }) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const token = cookies().get('sellpilot-platform-session')?.value;
    if (!token) return NextResponse.json({ error: 'Platform administrator authentication required' }, { status: 401 });
    const source = new URL(request.url); const target = `${apiBase}/platform-admin/${context.params.path.join('/')}${source.search}`;
    const upstream = await fetch(target, { method: request.method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: ['GET','HEAD'].includes(request.method) ? undefined : await request.text(), cache: 'no-store' });
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' } });
}
export const GET = proxy; export const POST = proxy; export const PATCH = proxy; export const PUT = proxy; export const DELETE = proxy;
