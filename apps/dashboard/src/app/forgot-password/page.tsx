'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function ForgotPasswordForm() {
    const suggestedEmail = useSearchParams().get('email') || '';
    const [email, setEmail] = useState(suggestedEmail);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [busy, setBusy] = useState(false);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setIsError(false);
        setMessage('');
        try {
            const response = await fetch('/api/auth-actions/password-reset-request', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || 'Authentication service is unavailable.');
            if (body.emailDeliveryConfigured === false) {
                setIsError(true);
                setMessage('Email delivery is not configured. Please contact support and try again.');
            } else {
                setMessage('Check your inbox and spam folder. Verified accounts receive a reset link; unverified accounts receive a verification link first.');
            }
        } catch (error) {
            setIsError(true);
            setMessage(error instanceof Error ? error.message : 'Authentication service is unavailable.');
        } finally {
            setBusy(false);
        }
    }

    return <Card className="w-full max-w-md">
        <CardHeader>
            <CardTitle className="text-3xl">Reset your password</CardTitle>
            <p className="text-sm text-muted-foreground">We will email the correct secure next step for your account.</p>
        </CardHeader>
        <CardContent className="space-y-4">
            {message && <p role="status" className={`rounded p-3 text-sm ${isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{message}</p>}
            <form onSubmit={submit} className="space-y-4">
                <Input type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} required />
                <Button className="w-full" disabled={busy}>{busy ? 'Sending…' : message ? 'Send again' : 'Send reset link'}</Button>
            </form>
            <div className="flex justify-between text-sm">
                <Link className="font-semibold text-primary" href="/login">Back to sign in</Link>
                <Link className="font-semibold text-primary" href={`/resend-verification?email=${encodeURIComponent(email.trim())}`}>Verify email</Link>
            </div>
        </CardContent>
    </Card>;
}

export default function ForgotPasswordPage() {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Suspense fallback={<p>Loading…</p>}><ForgotPasswordForm /></Suspense>
    </main>;
}
