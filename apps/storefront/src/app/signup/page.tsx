import { redirect } from 'next/navigation';
import { AuthExperience } from '@/components/auth-experience';

export default function SignUpPage() {
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
    if (dashboardUrl) {
        redirect(`${dashboardUrl}/signup`);
    }
    if (process.env.NODE_ENV !== 'production') {
        redirect('http://localhost:3000/signup');
    }
    return <AuthExperience mode="signup" />;
}
