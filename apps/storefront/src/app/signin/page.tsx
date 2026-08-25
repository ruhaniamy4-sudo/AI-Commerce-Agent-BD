import { redirect } from 'next/navigation';
export default function SignInPage() { redirect(`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000'}/login`); }
