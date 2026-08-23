import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

interface LoginResponse {
    accessToken: string;
    role: 'Owner' | 'Admin' | 'Staff';
    business: { id: string; name: string; slug: string };
    user: { id: string; name: string; email: string };
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                businessId: { label: 'Business ID', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials.password) return null;
                const apiBaseUrl = process.env.AGENT_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
                if (!apiBaseUrl) throw new Error('Agent API URL is not configured');

                const response = await fetch(`${apiBaseUrl}/auth/login`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        email: credentials.email,
                        password: credentials.password,
                        businessId: credentials.businessId || undefined,
                    }),
                });
                if (!response.ok) return null;
                const result = (await response.json()) as LoginResponse;
                return {
                    id: result.user.id,
                    name: result.user.name,
                    email: result.user.email,
                    accessToken: result.accessToken,
                    businessId: result.business.id,
                    businessName: result.business.name,
                    role: result.role,
                };
            },
        }),
    ],
    pages: { signIn: '/login' },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.accessToken = user.accessToken;
                token.businessId = user.businessId;
                token.businessName = user.businessName;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) session.user.id = token.sub;
            session.accessToken = token.accessToken;
            session.businessId = token.businessId;
            session.businessName = token.businessName;
            session.role = token.role;
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};
