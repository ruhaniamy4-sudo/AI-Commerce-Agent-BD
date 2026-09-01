'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/oauth-buttons';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
export default function LoginPage() {
    const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [businessId, setBusinessId] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const router = useRouter();
    async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(''); const result = await signIn('credentials', { redirect: false, email, password, businessId });
        if (result?.error) setError('Invalid email or password.'); else { router.push('/'); router.refresh(); } setLoading(false); }
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle className="text-3xl">Welcome to SellPilot</CardTitle><p className="text-sm text-muted-foreground">Sign in to your merchant workspace.</p></CardHeader>
        <CardContent className="space-y-5"><OAuthButtons/><div className="text-center text-xs text-muted-foreground">OR CONTINUE WITH EMAIL</div><form onSubmit={submit} className="space-y-4">{error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required/><Input type="password" minLength={PASSWORD_MIN_LENGTH} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required/><Input placeholder="Business ID (only for multi-business accounts)" value={businessId} onChange={e => setBusinessId(e.target.value)}/>
        <div className="flex justify-between text-xs"><Link className="font-medium text-primary" href="/resend-verification">Resend verification</Link><Link className="font-medium text-primary" href="/forgot-password">Forgot password?</Link></div><Button className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button></form>
        <p className="text-center text-sm">New to SellPilot? <Link className="font-semibold text-primary" href="/signup">Start free</Link></p></CardContent></Card></main>;
}
