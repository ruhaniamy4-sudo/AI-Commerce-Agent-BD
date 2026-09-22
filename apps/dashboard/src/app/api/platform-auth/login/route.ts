import { NextResponse } from 'next/server';
import { setPlatformCookie } from '@/lib/platform-session';

export async function POST(request: Request) {
    const apiBase = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

    let upstream: Response;
    try {
        upstream = await fetch(`${apiBase}/platform-auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(await request.json()),
            cache: 'no-store',
        });
    } catch (error) {
        // An agent that is down used to throw here and reach the admin as an
        // unhandled 500, which reads on screen as "wrong password".
        console.error('[PLATFORM_AUTH] Sign-in could not reach the agent:', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'The administration service is unreachable. Try again in a moment.' }, { status: 503 });
    }

    // A proxy or crash page answers with HTML, not JSON, and parsing it threw
    // away both the real status and any chance of telling the admin what broke.
    const body = await upstream.json().catch(() => null) as { error?: string; admin?: unknown; platformToken?: string } | null;
    if (!upstream.ok || !body) {
        return NextResponse.json(
            { error: body?.error || 'Sign in failed' },
            { status: upstream.ok ? 502 : upstream.status },
        );
    }
    if (!body.platformToken) {
        console.error('[PLATFORM_AUTH] Agent accepted the sign-in but returned no token');
        return NextResponse.json({ error: 'Sign in failed' }, { status: 502 });
    }

    const response = NextResponse.json({ admin: body.admin });
    setPlatformCookie(response, body.platformToken);
    return response;
}
