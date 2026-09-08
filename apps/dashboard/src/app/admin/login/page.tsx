import { redirect } from 'next/navigation';

export default function LegacyPlatformAdminLoginPage() {
  redirect('/login?access=admin');
}
