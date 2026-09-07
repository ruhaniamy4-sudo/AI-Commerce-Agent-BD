'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthButtons } from '@/components/oauth-buttons';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { AuthVisual } from '@/components/auth-visual';
export default function LoginPage() {
    const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [businessId, setBusinessId] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [callbackUrl, setCallbackUrl] = useState('/'); const router = useRouter();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            setEmail(params.get('email') || '');
            const requestedCallback = params.get('callbackUrl');
            if (requestedCallback) {
                try {
                    const target = new URL(requestedCallback, window.location.origin);
                    if (target.origin === window.location.origin) setCallbackUrl(`${target.pathname}${target.search}`);
                } catch { /* Keep the safe workspace default. */ }
            }
            const err = params.get('error');
            if (err === 'AccessDenied') {
                setError('Access denied. You do not have permission to sign in, or the account/business is unavailable.');
            } else if (err) {
                setError('Sign in failed. Please try again or sign in with your email.');
            }
        }
    }, []);

    async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(''); const result = await signIn('credentials', { redirect: false, email, password, businessId });
        if (result?.error) setError('Invalid email or password.'); else { router.push(callbackUrl); router.refresh(); } setLoading(false); }
return <main className="auth-reset"><AuthVisual mode="login"/><section className="auth-reset-form"><div><p className="sp-eyebrow">Your merchant workspace</p><h1>Welcome back.</h1><p className="auth-copy">Sign in to pick up where your business left off.</p><OAuthButtons/><div className="my-6 text-center text-[10px] tracking-widest text-[#9293a5]">OR USE YOUR EMAIL</div><form onSubmit={submit} className="space-y-5">{error&&<p role="alert" className="auth-error">{error}</p>}<label>Email address<Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<Input type="password" autoComplete="current-password" minLength={PASSWORD_MIN_LENGTH} value={password} onChange={e=>setPassword(e.target.value)} required/></label><details><summary className="text-xs text-[#818197] cursor-pointer">Signing in to a specific business?</summary><label className="mt-3">Business ID<Input value={businessId} onChange={e=>setBusinessId(e.target.value)}/></label></details><div className="auth-links"><Link href="/resend-verification">Resend verification</Link><Link href="/forgot-password">Forgot password?</Link></div><Button className="w-full" disabled={loading}>{loading?"Signing in…":"Sign in to workspace"}</Button></form><p className="mt-8 pt-6 border-t border-[#e3e1ed] text-sm text-[#77798e]">New to SellPilot? <Link href="/signup">Create your account</Link></p></div></section></main>;}
