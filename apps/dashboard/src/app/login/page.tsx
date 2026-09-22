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
interface Workspace { id: string; name: string; slug: string; role: 'Owner' | 'Admin' | 'Staff' }

/**
 * NextAuth can only carry a single string out of `authorize`, so the server sends
 * a stable code and the wording lives here. Anything unrecognised is shown as it
 * arrived: the previous catch-all replaced every unknown reason with "invalid
 * email or password", which told people who were rate limited, or who arrived
 * during maintenance, to keep retrying a password that was never the problem.
 */
const SIGN_IN_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Invalid email or password.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in. Check your inbox, or use “Resend verification” below.',
  BUSINESS_ID_REQUIRED: 'Your account belongs to more than one workspace. Choose the one you want to open.',
  WORKSPACE_NOT_AVAILABLE: 'You no longer have access to that workspace. Choose another, or ask its owner to re-invite you.',
  BUSINESS_INACTIVE: 'This business workspace is currently inactive. Contact your workspace owner.',
  ACCOUNT_LOCKED: 'This account is temporarily locked after repeated failed sign-ins. Try again shortly or reset your password.',
  RATE_LIMITED: 'Too many sign-in attempts from this device. Wait a few minutes and try again.',
  MAINTENANCE: 'SellPilot is briefly unavailable for maintenance. Please try again in a few minutes.',
  BACKEND_UNAVAILABLE: 'Unable to reach the authentication service. Check your connection and try again.',
};

function signInMessage(code: string) {
  // An unmapped ALL_CAPS value is a code we have no wording for, not a sentence
  // worth showing; a server-authored sentence is shown as written.
  return SIGN_IN_MESSAGES[code] || (/^[A-Z_]+$/.test(code) ? 'Invalid email or password.' : code);
}

export default function LoginPage() {
  const [access, setAccess] = useState<AccessType>('merchant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBusinessId, setShowBusinessId] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [selecting, setSelecting] = useState('');
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
    // A console that ended the session itself says why, so the admin is not left
    // guessing whether their password stopped working.
    if (params.get('reason') === 'session-expired') setError('Your session has ended. Sign in again to continue.');
    else if (authError === 'AccessDenied') setError('Access denied. Check your account and business access.');
    else if (authError) setError('Sign in failed. Please try again.');
  }, []);

  function selectAccess(next: AccessType) {
    setAccess(next);
    setError('');
    const params = new URLSearchParams(window.location.search);
    if (next === 'admin') params.set('access', 'admin'); else params.delete('access');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }

  /**
   * Signs in against one workspace, returning the failure code rather than
   * throwing: the caller reacts to BUSINESS_ID_REQUIRED by offering a choice,
   * and matching on a code is sturdier than matching on wording. `chosen` is
   * empty on the first attempt — the agent only insists on one when the account
   * can open several.
   */
  async function signInToWorkspace(chosen: string): Promise<string | undefined> {
    const result = await signIn('credentials', { redirect: false, email, password, businessId: chosen });
    if (result?.error) return result.error;
    router.push(callbackUrl);
    router.refresh();
    return undefined;
  }

  /**
   * Asks which workspaces these credentials can open. The agent re-checks the
   * password and issues nothing, so this only ever turns "enter a Business ID"
   * into a list of names. If it cannot answer, the manual field is still there.
   */
  async function offerWorkspaceChoice() {
    const response = await fetch('/api/auth-actions/workspaces', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({})) as { workspaces?: Workspace[] };
    const available = response.ok ? body.workspaces || [] : [];
    // One left means the other membership ended between the two calls — open it
    // rather than presenting a list of one.
    if (available.length === 1) {
      const failure = await signInToWorkspace(available[0].id);
      if (failure) setError(signInMessage(failure));
      return;
    }
    // No list to show: fall back to the manual field rather than a dead end.
    if (!available.length) {
      setShowBusinessId(true);
      setError(signInMessage('BUSINESS_ID_REQUIRED'));
      return;
    }
    setWorkspaces(available);
    setError('');
  }

  async function chooseWorkspace(workspace: Workspace) {
    setSelecting(workspace.id);
    setError('');
    const failure = await signInToWorkspace(workspace.id);
    if (failure) {
      setError(signInMessage(failure));
      setSelecting('');
    }
  }

  function startOver() {
    setWorkspaces(null);
    setPassword('');
    setError('');
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
        // A full load rather than a client transition: the console is gated on the
        // cookie this response just set, and it also drops any merchant-side state
        // left in memory from an earlier session in this tab.
        window.location.assign('/platform-admin');
        return;
      }
      const failure = await signInToWorkspace(businessId);
      if (failure === 'BUSINESS_ID_REQUIRED') return await offerWorkspaceChoice();
      if (failure) throw new Error(signInMessage(failure));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // The credentials have already been accepted at this point; all that is left
  // is which workspace to open, so the form is replaced rather than added to.
  if (workspaces) return <main className="auth-reset"><AuthVisual mode="login"/><section className="auth-reset-form"><div>
    <p className="sp-eyebrow">Signed in as {email}</p><h1>Choose a workspace.</h1>
    <p className="auth-copy">Your account can open {workspaces.length} workspaces. Pick the one you want to work in — you can switch by signing in again.</p>
    {error && <p role="alert" className="auth-error mb-5">{error}</p>}
    <ul className="auth-workspace-list">{workspaces.map(workspace =>
      <li key={workspace.id}><button type="button" onClick={() => chooseWorkspace(workspace)} disabled={Boolean(selecting)} aria-busy={selecting === workspace.id}>
        <span aria-hidden="true">{workspace.name.slice(0, 2).toUpperCase()}</span>
        <span><strong>{workspace.name}</strong><small>{workspace.role} · {workspace.slug}</small></span>
        <em>{selecting === workspace.id ? 'Opening…' : 'Open'}</em>
      </button></li>)}
    </ul>
    <button type="button" className="auth-workspace-back" onClick={startOver}>← Use a different account</button>
  </div></section></main>;

  return <main className="auth-reset"><AuthVisual mode="login"/><section className="auth-reset-form"><div>
    <p className="sp-eyebrow">Secure SellPilot access</p><h1>Welcome back.</h1><p className="auth-copy">Choose the workspace you are authorized to manage.</p>
    <div className="auth-access-switch" role="group" aria-label="Workspace type"><button type="button" aria-pressed={access === 'merchant'} onClick={() => selectAccess('merchant')}>Merchant</button><button type="button" aria-pressed={access === 'admin'} onClick={() => selectAccess('admin')}>Platform Admin</button></div>
    {access === 'merchant' ? <OAuthButtons/> : <p className="auth-access-note">Internal platform access. Merchant accounts cannot access administration tools.</p>}
    {access === 'merchant' && <div className="my-6 text-center text-[10px] tracking-widest text-[#9293a5]">OR USE YOUR EMAIL</div>}
    <form onSubmit={submit} className="space-y-5">{error && <p role="alert" className="auth-error">{error}</p>}<label>Email address<Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required/></label><label>Password<Input type="password" autoComplete="current-password" minLength={PASSWORD_MIN_LENGTH} value={password} onChange={event => setPassword(event.target.value)} required/></label>
      {/* The id field is the fallback for when the workspace list cannot be
          fetched; ordinarily the picker appears instead and nobody sees this. */}
      {access === 'merchant' && <><details open={showBusinessId || Boolean(businessId)} onToggle={event => setShowBusinessId((event.target as HTMLDetailsElement).open)}><summary className="cursor-pointer text-xs text-[#818197]">Signing in to a specific business?</summary><label className="mt-3">Business ID<Input value={businessId} onChange={event => setBusinessId(event.target.value)}/></label></details><div className="auth-links"><Link href="/resend-verification">Resend verification</Link><Link href="/forgot-password">Forgot password?</Link></div></>}
      <Button className="w-full" disabled={loading}>{loading ? 'Signing in…' : access === 'admin' ? 'Sign in to platform' : 'Sign in to workspace'}</Button>
    </form>
    {access === 'merchant' && <p className="mt-8 border-t border-[#e3e1ed] pt-6 text-sm text-[#77798e]">New to SellPilot? <Link href="/signup">Create your account</Link></p>}
  </div></section></main>;
}
