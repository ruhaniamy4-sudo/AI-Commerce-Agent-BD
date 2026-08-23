import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import crypto from "crypto"

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "admin@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const adminEmail = process.env.DASHBOARD_ADMIN_EMAIL
                const adminPassword = process.env.DASHBOARD_ADMIN_PASSWORD
                if (!adminEmail || !adminPassword || !credentials?.email || !credentials.password) {
                    return null
                }
                if (safeEqual(credentials.email.toLowerCase(), adminEmail.toLowerCase()) && safeEqual(credentials.password, adminPassword)) {
                    return { id: "admin", name: "Admin", email: adminEmail }
                }
                return null
            }
        })
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.sub
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
}
