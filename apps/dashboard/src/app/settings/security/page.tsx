'use client';

import { SettingsSection } from '@/components/layout/settings-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { businessApi } from '@/lib/api';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

export default function SecurityPage() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
    const [error, setError] = useState('');
    const sessions = useQuery({ queryKey: ['security-sessions'], queryFn: businessApi.sessions });
    const change = useMutation({ mutationFn: () => businessApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }), onSuccess: () => void signOut({ callbackUrl: '/login' }), onError: (cause: Error) => setError(cause.message) });
    const revoke = useMutation({ mutationFn: businessApi.revokeSession, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-sessions'] }) });
    function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (form.newPassword !== form.confirm) return setError('Passwords do not match.'); change.mutate(); }

    return <div className="space-y-6">
        <PageHeader title="Security" description="Control access to your account and review the devices signed in to your workspace." />
        <SettingsSection id="password" title="Password" description="Use a unique password. Changing it signs you out on every device.">
            <form onSubmit={submit} className="max-w-xl space-y-5">
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <label className="block space-y-2 text-sm font-medium"><span>Current password</span><Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /></label>
                <label className="block space-y-2 text-sm font-medium"><span>New password</span><Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /><span className="text-xs font-normal text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters.</span></label>
                <label className="block space-y-2 text-sm font-medium"><span>Confirm new password</span><Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} required /></label>
                <Button disabled={change.isPending}>{change.isPending ? 'Updating…' : 'Update password'}</Button>
            </form>
        </SettingsSection>
        <SettingsSection id="sessions" title="Signed-in devices" description="Remove access from a device you no longer use or recognize.">
            {sessions.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading devices…</p>}
            {sessions.isError && <p role="alert" className="text-sm text-destructive">Device information could not load. Please try again.</p>}
            {revoke.isError && <p role="alert" className="mb-4 text-sm text-destructive">Could not revoke this session. Please try again.</p>}
            <div className="divide-y divide-border">{sessions.data?.filter((item) => !item.revokedAt).map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 py-5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.userAgent || 'Unknown device'}</p>{item.current && <Badge className="mt-2">This device</Badge>}<p className="mt-2 text-xs leading-6 text-muted-foreground">Signed in {new Date(item.createdAt).toLocaleString()}<br />Expires {new Date(item.expiresAt).toLocaleString()}</p></div>
                <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(item.id)}>{item.current ? 'Sign out' : 'Revoke access'}</Button>
            </div>)}</div>
            {sessions.data && !sessions.data.some((item) => !item.revokedAt) && <p className="text-sm text-muted-foreground">No active sessions.</p>}
        </SettingsSection>
    </div>;
}
