import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
export default withAuth(function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    if (token?.needsOnboarding && pathname !== '/onboarding') return NextResponse.redirect(new URL('/onboarding', req.url));
    if (!token?.needsOnboarding && pathname === '/onboarding') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
}, { callbacks: { authorized: ({ token }) => Boolean(token) } });
export const config = { matcher: ['/((?!api|login|signup|_next/static|_next/image|favicon.ico).*)'] };
