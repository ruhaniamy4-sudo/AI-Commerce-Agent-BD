import 'next-auth';
import 'next-auth/jwt';

type BusinessRole = 'Owner' | 'Admin' | 'Staff';

declare module 'next-auth' {
    interface Session {
        accessToken: string;
        businessId: string;
        businessName: string;
        role: BusinessRole;
        user: {
            id?: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }

    interface User {
        accessToken: string;
        businessId: string;
        businessName: string;
        role: BusinessRole;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        accessToken: string;
        businessId: string;
        businessName: string;
        role: BusinessRole;
    }
}
