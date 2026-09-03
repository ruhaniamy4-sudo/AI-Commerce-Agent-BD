import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import type { JWT } from 'next-auth/jwt';
import { MERCHANT_SESSION_MAX_AGE_SECONDS } from '@edutechs/shared';

type BusinessRole = 'Owner' | 'Admin' | 'Staff';
interface AgentSession {
    accessToken?: string; accountToken?: string; refreshToken?: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string;
    needsOnboarding: boolean; role?: BusinessRole; verificationRequired?: boolean;
    business?: { id: string; name: string; slug: string; onboardingComplete: boolean };
    user: { id: string; name: string; email: string };
}

async function refreshAgentSession(token: JWT): Promise<JWT> {
    if (!apiBaseUrl || !token.refreshToken) return { ...token, authError: 'RefreshAccessTokenError' };
    try {
        const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ refreshToken: token.refreshToken }),
        });
        if (!response.ok) throw new Error('Session refresh failed');
        const result = await response.json() as AgentSession;
        return {
            ...token,
            accessToken: result.accessToken,
            accountToken: result.accountToken,
            refreshToken: result.refreshToken,
            accessTokenExpiresAt: result.accessTokenExpiresAt,
            refreshTokenExpiresAt: result.refreshTokenExpiresAt,
            needsOnboarding: result.needsOnboarding,
            businessId: result.business?.id,
            businessName: result.business?.name,
            onboardingComplete: result.business?.onboardingComplete,
            role: result.role,
            authError: undefined,
        };
    } catch {
        return { ...token, accessToken: undefined, accountToken: undefined, refreshToken: undefined, authError: 'RefreshAccessTokenError' };
    }
}

const apiBaseUrl = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const providers: NextAuthOptions['providers'] = [CredentialsProvider({
    name: 'Email and password',
    credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' }, businessId: { label: 'Business ID', type: 'text' } },
    async authorize(credentials) {
        if (!apiBaseUrl || !credentials?.email || !credentials.password) return null;
        const response = await fetch(`${apiBaseUrl}/auth/login`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: credentials.email, password: credentials.password, businessId: credentials.businessId || undefined }),
        });
        if (!response.ok) return null;
        const result = await response.json() as AgentSession;
        if (result.verificationRequired || !result.refreshToken ||
            (result.needsOnboarding && !result.accountToken) || (!result.needsOnboarding && !result.accessToken)) return null;
        return { id: result.user.id, name: result.user.name, email: result.user.email,
            accessToken: result.accessToken, accountToken: result.accountToken, refreshToken: result.refreshToken,
            accessTokenExpiresAt: result.accessTokenExpiresAt, refreshTokenExpiresAt: result.refreshTokenExpiresAt, needsOnboarding: result.needsOnboarding,
            businessId: result.business?.id, businessName: result.business?.name,
            onboardingComplete: result.business?.onboardingComplete, role: result.role };
    },
})];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    providers.push(FacebookProvider({
        clientId: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
    }));
}

export const authOptions: NextAuthOptions = {
    providers, pages: { signIn: '/login', error: '/login' }, session: { strategy: 'jwt', maxAge: MERCHANT_SESSION_MAX_AGE_SECONDS },
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === 'credentials') return true;
            const provider = account?.provider;
            const accountId = account?.providerAccountId;
            const email = user?.email;
            const name = user?.name?.trim() || (email ? email.split('@')[0] : 'Merchant');

            const hasSecret = Boolean(process.env.OAUTH_INTERNAL_SECRET && process.env.OAUTH_INTERNAL_SECRET.length >= 32);
            if (!apiBaseUrl || !hasSecret || !accountId || !email) {
                console.warn('[AUTH_DIAGNOSTIC] signIn rejected pre-check:', {
                    provider,
                    emailPresent: Boolean(email),
                    namePresent: Boolean(name),
                    accountIdPresent: Boolean(accountId),
                    apiBaseUrlConfigured: Boolean(apiBaseUrl),
                    secretConfigured: hasSecret,
                    reason: 'missing_prerequisites',
                });
                return false;
            }

            try {
                const response = await fetch(`${apiBaseUrl}/auth/oauth/exchange`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-oauth-internal-secret': process.env.OAUTH_INTERNAL_SECRET!,
                    },
                    body: JSON.stringify({ provider, accountId, email, name }),
                });

                if (!response.ok) {
                    let errData: { error?: string } | null = null;
                    try { errData = await response.json() as { error?: string }; } catch {}
                    console.warn('[AUTH_DIAGNOSTIC] signIn exchange rejected by agent:', {
                        provider,
                        status: response.status,
                        statusText: response.statusText,
                        reason: errData?.error || 'exchange_not_ok',
                    });
                    return false;
                }

                const result = await response.json() as AgentSession;
                console.log('[AUTH_DIAGNOSTIC] signIn exchange approved:', {
                    provider,
                    needsOnboarding: result.needsOnboarding,
                    businessPresent: Boolean(result.business?.id),
                    role: result.role,
                });

                Object.assign(user, {
                    id: result.user.id,
                    accessToken: result.accessToken,
                    accountToken: result.accountToken,
                    refreshToken: result.refreshToken,
                    accessTokenExpiresAt: result.accessTokenExpiresAt,
                    refreshTokenExpiresAt: result.refreshTokenExpiresAt,
                    needsOnboarding: result.needsOnboarding,
                    businessId: result.business?.id,
                    businessName: result.business?.name,
                    onboardingComplete: result.business?.onboardingComplete,
                    role: result.role,
                });
                return true;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'fetch_failed';
                console.error('[AUTH_DIAGNOSTIC] signIn exchange network error:', {
                    provider,
                    error: message,
                });
                return false;
            }
        },
        async jwt({ token, user, trigger, session }) {
            if (user) Object.assign(token, { accessToken: user.accessToken, accountToken: user.accountToken,
                refreshToken: user.refreshToken, accessTokenExpiresAt: user.accessTokenExpiresAt, refreshTokenExpiresAt: user.refreshTokenExpiresAt,
                needsOnboarding: user.needsOnboarding, businessId: user.businessId, businessName: user.businessName,
                onboardingComplete: user.onboardingComplete, role: user.role });
            if (trigger === 'update' && session) {
                const update = session as Record<string, unknown>;
                for (const key of ['accessToken', 'accountToken', 'refreshToken', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'needsOnboarding', 'businessId', 'businessName', 'onboardingComplete', 'role'] as const) if (key in update) token[key] = update[key] as never;
            }
            if (user || trigger === 'update') return token;
            const expiresAt = Date.parse(String(token.accessTokenExpiresAt || ''));
            if (Number.isFinite(expiresAt) && Date.now() < expiresAt - 30_000) return token;
            return refreshAgentSession(token);
        },
        async session({ session, token }) {
            if (session.user) session.user.id = token.sub;
            Object.assign(session, { accessToken: token.accessToken, accountToken: token.accountToken,
                needsOnboarding: token.needsOnboarding, businessId: token.businessId, businessName: token.businessName,
                onboardingComplete: token.onboardingComplete, role: token.role, authError: token.authError });
            return session;
        },
    },
    events: {
        async signOut({ token }) {
            if (!apiBaseUrl || !token?.refreshToken) return;
            await fetch(`${apiBaseUrl}/auth/logout`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ refreshToken: token.refreshToken }),
            }).catch(() => undefined);
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
