import { redirect } from 'next/navigation';
export default function SignUpPage() { redirect(`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000'}/signup`); }
