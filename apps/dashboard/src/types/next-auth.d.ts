import 'next-auth';
import 'next-auth/jwt';
type BusinessRole = 'Owner' | 'Admin' | 'Staff';
declare module 'next-auth' {
    interface Session { accessToken?: string; accountToken?: string; businessId?: string; businessName?: string; role?: BusinessRole; needsOnboarding: boolean; onboardingComplete?: boolean; authError?: string; user: { id?: string; name?: string | null; email?: string | null; image?: string | null }; }
    interface User { accessToken?: string; accountToken?: string; refreshToken?: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string; businessId?: string; businessName?: string; role?: BusinessRole; needsOnboarding: boolean; onboardingComplete?: boolean; }
}
declare module 'next-auth/jwt' { interface JWT { accessToken?: string; accountToken?: string; refreshToken?: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string; businessId?: string; businessName?: string; role?: BusinessRole; needsOnboarding: boolean; onboardingComplete?: boolean; authError?: string; } }
