'use client';

import { SettingsSection } from '@/components/layout/settings-section';
import { WorkspacePanel } from '@/components/layout/workspace-surface';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { businessApi } from '@/lib/api';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function TeamPage() {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Staff' });
    const canManage = session?.role === 'Owner';
    const { data, isLoading, isError } = useQuery({ queryKey: ['team'], queryFn: businessApi.members });
    const add = useMutation({ mutationFn: () => businessApi.addMember(form), onSuccess: () => { setForm({ name: '', email: '', password: '', role: 'Staff' }); queryClient.invalidateQueries({ queryKey: ['team'] }); } });
    const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => businessApi.updateMember(id, { status }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }) });

    return <div className="space-y-6">
        <PageHeader title="Team" description="A shared workspace with clear roles and controlled access." />
        <WorkspacePanel title="Workspace members" description="Owners manage access. Admins and staff work within their assigned permissions.">
            {isLoading && <p role="status" className="p-6 text-sm text-muted-foreground">Loading members…</p>}
            {isError && <p role="alert" className="p-6 text-sm text-destructive">The team list could not load. Please try again.</p>}
            {update.isError && <p role="alert" className="p-6 text-sm text-destructive">Could not change access. Please try again.</p>}
            <div className="divide-y divide-border">{data?.map((member) => <div key={member._id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{member.userId.name?.charAt(0) || '?'}</span><div className="min-w-0"><p className="break-words text-sm font-semibold">{member.userId.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{member.userId.email}</p></div></div>
                <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{member.role}</Badge><Badge variant={member.status === 'active' ? 'outline' : 'destructive'}>{member.status}</Badge>{canManage && member.role !== 'Owner' && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: member._id, status: member.status === 'active' ? 'disabled' : 'active' })}>{member.status === 'active' ? 'Disable access' : 'Enable access'}</Button>}</div>
            </div>)}</div>
        </WorkspacePanel>
        {canManage && <SettingsSection id="add-member" title="Add a teammate" description="Create an account with the role they need. Share the temporary password securely.">
            <form onSubmit={(event) => { event.preventDefault(); add.mutate(); }} className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium"><span>Full name</span><Input autoComplete="off" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
                <label className="space-y-2 text-sm font-medium"><span>Email address</span><Input type="email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
                <label className="space-y-2 text-sm font-medium"><span>Temporary password</span><Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><span className="text-xs font-normal text-muted-foreground">{PASSWORD_MIN_LENGTH} characters minimum.</span></label>
                <label className="space-y-2 text-sm font-medium"><span>Role</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Admin</option><option>Staff</option></select></label>
                <div className="sm:col-span-2">{add.isError && <p role="alert" className="mb-3 text-sm text-destructive">The account could not be created. Check the details and try again.</p>}{add.isSuccess && <p role="status" className="mb-3 text-sm text-muted-foreground">Team member added.</p>}<Button disabled={add.isPending || form.password.length < PASSWORD_MIN_LENGTH}>{add.isPending ? 'Adding…' : 'Add team member'}</Button></div>
            </form>
        </SettingsSection>}
    </div>;
}
