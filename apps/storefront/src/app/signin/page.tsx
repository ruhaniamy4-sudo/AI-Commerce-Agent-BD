import { redirect } from 'next/navigation';
import { AuthExperience } from '@/components/auth-experience';

export default function SignInPage() {
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
    if (dashboardUrl) {
        redirect(`${dashboardUrl}/login`);
    }
    if (process.env.NODE_ENV !== 'production') {
        redirect('http://localhost:3000/login');
    }
    return <AuthExperience mode="signin" />;
}
