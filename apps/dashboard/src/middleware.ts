import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
export default withAuth(function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const platformCookie = req.cookies.get('sellpilot-platform-session')?.value;
    if (pathname === '/admin/login') return platformCookie ? NextResponse.redirect(new URL('/platform-admin', req.url)) : NextResponse.next();
    if (pathname.startsWith('/platform-admin')) return platformCookie ? NextResponse.next() : NextResponse.redirect(new URL('/admin/login', req.url));
    if (token?.needsOnboarding && pathname !== '/onboarding') return NextResponse.redirect(new URL('/onboarding', req.url));
    if (!token?.needsOnboarding && pathname === '/onboarding') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
}, { callbacks: { authorized: ({ req, token }) => req.nextUrl.pathname === '/admin/login' || req.nextUrl.pathname.startsWith('/platform-admin') ? true : Boolean(token) } });
export const config = { matcher: ['/((?!api|login|signup|forgot-password|reset-password|verify-email|resend-verification|_next/static|_next/image|favicon.ico).*)'] };
