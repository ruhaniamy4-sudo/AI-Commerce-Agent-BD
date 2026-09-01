'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [busy, setBusy] = useState(false);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        setIsError(false);
        try {
            const response = await fetch('/api/auth-actions/password-reset-request', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || 'Authentication service is unavailable.');
            if (body.emailDeliveryConfigured === false) {
                setIsError(true);
                setMessage('Email delivery is not configured. Please contact support and try again.');
            } else {
                setMessage('If a verified account exists for this email, a reset link has been sent.');
            }
        } catch (error) {
            setIsError(true);
            setMessage(error instanceof Error ? error.message : 'Authentication service is unavailable.');
        } finally {
            setBusy(false);
        }
    }

    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-3xl">Reset your password</CardTitle>
                <p className="text-sm text-muted-foreground">We will email a secure one-time link to verified accounts.</p>
            </CardHeader>
            <CardContent>
                {message ? <div className="space-y-4">
                    <p className={`rounded p-3 text-sm ${isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{message}</p>
                    <Link className="text-sm font-semibold text-primary" href="/login">Return to sign in</Link>
                </div> : <form onSubmit={submit} className="space-y-4">
                    <Input type="email" placeholder="Email" value={email} onChange={event => setEmail(event.target.value)} required />
                    <Button className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
                    <p className="text-center text-sm"><Link className="font-semibold text-primary" href="/login">Back to sign in</Link></p>
                </form>}
            </CardContent>
        </Card>
    </main>;
}
