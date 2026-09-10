'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function ResendVerificationForm() {
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
            const response = await fetch('/api/auth-actions/email-verification-request', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || 'Authentication service is unavailable.');
            if (body.emailDeliveryConfigured === false) {
                setIsError(true);
                setMessage('Email delivery is not configured. Please contact support and try again.');
            } else {
                setMessage('If this account still needs verification, a fresh link has been sent. Check inbox and spam.');
            }
        } catch (error) {
            setIsError(true);
            setMessage(error instanceof Error ? error.message : 'Authentication service is unavailable.');
        } finally { setBusy(false); }
    }

    return <Card className="w-full max-w-md">
        <CardHeader>
            <CardTitle className="text-3xl">Verify your email</CardTitle>
            <p className="text-sm text-muted-foreground">Request a fresh one-time verification link.</p>
        </CardHeader>
        <CardContent className="space-y-4">
            {message && <p role="status" className={`rounded p-3 text-sm ${isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{message}</p>}
            <form onSubmit={submit} className="space-y-4">
                <Input type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} required />
                <Button className="w-full" disabled={busy}>{busy ? 'Sending…' : message ? 'Send again' : 'Send verification email'}</Button>
            </form>
            <Link className="text-sm font-semibold text-primary" href="/login">Return to sign in</Link>
        </CardContent>
    </Card>;
}

export default function ResendVerificationPage() {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Suspense fallback={<p>Loading…</p>}><ResendVerificationForm /></Suspense>
    </main>;
}
