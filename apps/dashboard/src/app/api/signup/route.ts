import { NextResponse } from 'next/server';
export async function POST(request: Request) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) return NextResponse.json({ error: 'Agent API is not configured' }, { status: 503 });
    const response = await fetch(`${apiBase}/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(await request.json()) });
    return NextResponse.json(await response.json(), { status: response.status });
}
