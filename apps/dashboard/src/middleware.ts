import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { PLATFORM_COOKIE, hasLivePlatformToken } from '@/lib/platform-session';
export default withAuth(function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    // The cookie deliberately outlives a single token so an admin returning
    // mid-session has something to renew with, so presence alone is not enough.
    const platformSignedIn = hasLivePlatformToken(req.cookies.get(PLATFORM_COOKIE)?.value);
    if (pathname === '/admin/login') return NextResponse.redirect(new URL(platformSignedIn ? '/platform-admin' : '/login?access=admin', req.url));
    if (pathname.startsWith('/platform-admin')) return platformSignedIn ? NextResponse.next() : NextResponse.redirect(new URL('/login?access=admin', req.url));
    const legacyMerchantRoutes: Record<string, string> = {
        '/agent': '/assistant',
        '/manual-test': '/assistant',
        '/system-prompts': '/training',
        '/unanswered': '/knowledge',
        '/errors': '/',
    };
    if (legacyMerchantRoutes[pathname]) return NextResponse.redirect(new URL(legacyMerchantRoutes[pathname], req.url));
    if (token?.needsOnboarding && pathname !== '/onboarding') return NextResponse.redirect(new URL('/onboarding', req.url));
    // The overview carries revenue and AI cost, which Staff cannot see, so the
    // inbox they actually work is their landing page instead of a 403.
    if (token?.role === 'Staff' && pathname === '/') return NextResponse.redirect(new URL('/conversations', req.url));
    if (!token?.needsOnboarding && token?.onboardingComplete && pathname === '/onboarding') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
}, {
    // The middleware cannot see authOptions — it runs on the edge, in its own
    // module — so naming the pages here is the only thing keeping a signed-out
    // visitor off NextAuth's stock, unbranded /api/auth/signin form. Keep these
    // in step with `pages` in lib/auth.ts.
    pages: { signIn: '/login', error: '/login' },
    callbacks: { authorized: ({ req, token }) => req.nextUrl.pathname === '/admin/login' || req.nextUrl.pathname.startsWith('/platform-admin') ? true : Boolean(token) },
});
export const config = { matcher: ['/((?!api|login|signup|forgot-password|reset-password|verify-email|resend-verification|_next/static|_next/image|favicon.ico).*)'] };
