'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthButtons } from '@/components/oauth-buttons';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { AuthVisual } from '@/components/auth-visual';

type AccessType = 'merchant' | 'admin';

export default function LoginPage() {
  const [access, setAccess] = useState<AccessType>('merchant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBusinessId, setShowBusinessId] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState('/');
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAccess(params.get('access') === 'admin' ? 'admin' : 'merchant');
    setEmail(params.get('email') || '');
    const requestedCallback = params.get('callbackUrl');
    if (requestedCallback) {
      try {
        const target = new URL(requestedCallback, window.location.origin);
        if (target.origin === window.location.origin && !target.pathname.startsWith('/platform-admin')) setCallbackUrl(`${target.pathname}${target.search}`);
      } catch { /* Keep the safe merchant workspace default. */ }
    }
    const authError = params.get('error');
    if (authError === 'AccessDenied') setError('Access denied. Check your account and business access.');
    else if (authError) setError('Sign in failed. Please try again.');
  }, []);

  function selectAccess(next: AccessType) {
    setAccess(next);
    setError('');
    const params = new URLSearchParams(window.location.search);
    if (next === 'admin') params.set('access', 'admin'); else params.delete('access');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (access === 'admin') {
        const response = await fetch('/api/platform-auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Invalid platform admin credentials.');
        router.push('/platform-admin');
        router.refresh();
        return;
      }
      const result = await signIn('credentials', { redirect: false, email, password, businessId });
      if (result?.error) {
        if (result.error === 'EMAIL_NOT_VERIFIED') {
          throw new Error('Please verify your email before signing in. Check your inbox or click "Resend verification" below.');
        }
        if (result.error === 'BUSINESS_ID_REQUIRED') {
          setShowBusinessId(true);
          throw new Error('Your account is associated with multiple businesses. Please enter your Business ID under "Signing in to a specific business?".');
        }
        if (result.error === 'BUSINESS_INACTIVE') {
          throw new Error('This business workspace is currently inactive.');
        }
        if (result.error === 'BACKEND_UNAVAILABLE') {
          throw new Error('Unable to connect to the authentication service. Please check your connection and try again.');
        }
        throw new Error('Invalid email or password.');
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-reset"><AuthVisual mode="login"/><section className="auth-reset-form"><div>
    <p className="sp-eyebrow">Secure SellPilot access</p><h1>Welcome back.</h1><p className="auth-copy">Choose the workspace you are authorized to manage.</p>
    <div className="auth-access-switch" role="group" aria-label="Workspace type"><button type="button" aria-pressed={access === 'merchant'} onClick={() => selectAccess('merchant')}>Merchant</button><button type="button" aria-pressed={access === 'admin'} onClick={() => selectAccess('admin')}>Platform Admin</button></div>
    {access === 'merchant' ? <OAuthButtons/> : <p className="auth-access-note">Internal platform access. Merchant accounts cannot access administration tools.</p>}
    {access === 'merchant' && <div className="my-6 text-center text-[10px] tracking-widest text-[#9293a5]">OR USE YOUR EMAIL</div>}
    <form onSubmit={submit} className="space-y-5">{error && <p role="alert" className="auth-error">{error}</p>}<label>Email address<Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required/></label><label>Password<Input type="password" autoComplete="current-password" minLength={PASSWORD_MIN_LENGTH} value={password} onChange={event => setPassword(event.target.value)} required/></label>
      {access === 'merchant' && <><details open={showBusinessId || Boolean(businessId)} onToggle={event => setShowBusinessId((event.target as HTMLDetailsElement).open)}><summary className="cursor-pointer text-xs text-[#818197]">Signing in to a specific business?</summary><label className="mt-3">Business ID<Input value={businessId} onChange={event => setBusinessId(event.target.value)}/></label></details><div className="auth-links"><Link href="/resend-verification">Resend verification</Link><Link href="/forgot-password">Forgot password?</Link></div></>}
      <Button className="w-full" disabled={loading}>{loading ? 'Signing in…' : access === 'admin' ? 'Sign in to platform' : 'Sign in to workspace'}</Button>
    </form>
    {access === 'merchant' && <p className="mt-8 border-t border-[#e3e1ed] pt-6 text-sm text-[#77798e]">New to SellPilot? <Link href="/signup">Create your account</Link></p>}
  </div></section></main>;
}
