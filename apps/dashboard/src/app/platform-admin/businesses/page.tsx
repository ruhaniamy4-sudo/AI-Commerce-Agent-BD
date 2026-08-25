'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';
import { Input } from '@/components/ui/input'; import { Button } from '@/components/ui/button'; import { Badge } from '@/components/ui/badge';
export default function Businesses() {
    const [search, setSearch] = useState(''); const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['platform-businesses', search], queryFn: () => platformApi.businesses(search) });
    const change = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'active'|'suspended' }) => platformApi.setBusinessStatus(id, status), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-businesses'] }) });
    return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Businesses</h1><p className="text-slate-400">Inspect tenant setup, membership, and commerce activity without exposing credentials.</p></div>
        <Input className="max-w-md border-slate-700 bg-slate-900" placeholder="Search businesses" value={search} onChange={event => setSearch(event.target.value)} />
        {isLoading ? <p>Loading…</p> : <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr>{['Business','Owner / members','Setup','Activity','Status','Action'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>
            {data?.data.map(business => <tr key={business._id} className="border-t border-slate-800"><td className="p-4"><b>{business.name}</b><p className="text-xs text-slate-500">{business.slug} · {business.businessType || 'Unspecified'}</p></td><td className="p-4">{business.members.map(member => <p key={`${member.user?.id}-${member.role}`}>{member.user?.name || 'Unknown'} <span className="text-slate-500">· {member.role}</span></p>)}</td><td className="p-4">{business.onboarding?.completedAt ? 'Complete' : 'In progress'}</td><td className="p-4">{business.conversations} conversations<br />{business.orders} orders · {business.customers} customers</td><td className="p-4"><Badge variant={business.status === 'active' ? 'default' : 'destructive'}>{business.status}</Badge></td><td className="p-4"><Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate({ id: business._id, status: business.status === 'active' ? 'suspended' : 'active' })}>{business.status === 'active' ? 'Suspend' : 'Activate'}</Button></td></tr>)}
        </tbody></table>{!data?.data.length && <p className="p-8 text-center text-slate-400">No businesses found.</p>}</div>}</div>;
}
