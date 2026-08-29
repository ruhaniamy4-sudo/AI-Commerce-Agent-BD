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
export default function SignupPage() {
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' }); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const router = useRouter();
    async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (form.password.length < PASSWORD_MIN_LENGTH) return setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`); if (form.password !== form.confirm) return setError('Passwords do not match.'); setLoading(true);
        const response = await fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }); const body = await response.json();
        if (!response.ok) { setError(body.error || 'Could not create account.'); setLoading(false); return; } const result = await signIn('credentials', { redirect: false, email: form.email, password: form.password });
        if (result?.error) setError('Account created. Please sign in.'); else { router.push('/onboarding'); router.refresh(); } setLoading(false); }
    const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle className="text-3xl">Start free</CardTitle><p className="text-sm text-muted-foreground">Create your SellPilot merchant account.</p></CardHeader>
        <CardContent className="space-y-5"><OAuthButtons/><div className="text-center text-xs text-muted-foreground">OR SIGN UP WITH EMAIL</div><form onSubmit={submit} className="space-y-3">{error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Input placeholder="Your name" value={form.name} onChange={update('name')} required/><Input type="email" placeholder="Email" value={form.email} onChange={update('email')} required/><Input type="password" minLength={PASSWORD_MIN_LENGTH} placeholder="Password (8+ characters)" value={form.password} onChange={update('password')} required/><Input type="password" minLength={PASSWORD_MIN_LENGTH} placeholder="Confirm password" value={form.confirm} onChange={update('confirm')} required/>
        <Button className="w-full" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button></form><p className="text-center text-sm">Already registered? <Link className="font-semibold text-primary" href="/login">Sign in</Link></p></CardContent></Card></main>;
}
