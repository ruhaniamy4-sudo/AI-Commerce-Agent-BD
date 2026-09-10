'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function ResetForm() {
    const token = useSearchParams().get('token') || '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState(token ? '' : 'This reset link is missing its secure token. Request a new link.');
    const [busy, setBusy] = useState(false);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError('');
        if (!token) return setError('This reset link is invalid. Request a new reset link.');
        if (password !== confirm) return setError('Passwords do not match.');
        setBusy(true);
        try {
            const response = await fetch('/api/auth-actions/password-reset-confirm', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || 'Reset link is invalid or expired.');
            setMessage('Password updated. All previous sessions have been signed out.');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Authentication service is unavailable.');
        } finally {
            setBusy(false);
        }
    }

    return <Card className="w-full max-w-md">
        <CardHeader>
            <CardTitle className="text-3xl">Choose a new password</CardTitle>
            <p className="text-sm text-muted-foreground">Use at least {PASSWORD_MIN_LENGTH} characters and avoid common passwords.</p>
        </CardHeader>
        <CardContent>
            {message ? <div className="space-y-4">
                <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>
                <Link className="font-semibold text-primary" href="/login">Sign in with the new password</Link>
            </div> : <form onSubmit={submit} className="space-y-4">
                {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <Input type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={200} autoComplete="new-password" placeholder="New password" value={password} onChange={event => setPassword(event.target.value)} required />
                <Input type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={200} autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={event => setConfirm(event.target.value)} required />
                <Button className="w-full" disabled={busy || !token}>{busy ? 'Updating…' : 'Update password'}</Button>
                <p className="text-center text-sm"><Link className="font-semibold text-primary" href="/forgot-password">Request a new reset link</Link></p>
            </form>}
        </CardContent>
    </Card>;
}

export default function ResetPasswordPage() {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Suspense fallback={<p>Loading…</p>}><ResetForm /></Suspense>
    </main>;
}
