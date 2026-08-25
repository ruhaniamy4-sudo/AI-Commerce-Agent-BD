'use client';
import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Building2, MessageSquare, PlugZap, ShoppingCart, Users } from 'lucide-react';
export default function PlatformOverview() {
    const { data, isLoading, error } = useQuery({ queryKey: ['platform-overview'], queryFn: platformApi.overview });
    const cards: Array<[string, number, React.ElementType]> = data ? [
        ['Businesses', data.businesses, Building2], ['Active businesses', data.activeBusinesses, Building2], ['Users', data.users, Users],
        ['Conversations', data.conversations, MessageSquare], ['Orders', data.orders, ShoppingCart], ['AI requests', data.aiUsage.requests, BrainCircuit],
        ['Facebook channels', data.facebookChannels, PlugZap], ['Courier connections', data.courierIntegrations, PlugZap],
    ] : [];
    return <div className="space-y-6"><div><p className="text-sm font-semibold text-violet-400">INTERNAL OPERATIONS</p><h1 className="text-3xl font-bold">Platform overview</h1><p className="text-slate-400">Real aggregate operational data across SellPilot tenants.</p></div>
        {isLoading && <p>Loading platform data…</p>}{error && <p className="text-red-400">Platform data is unavailable.</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <Card key={label} className="border-slate-800 bg-slate-900 text-white"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-slate-400">{label}</CardTitle><Icon className="h-4 w-4 text-violet-400" /></CardHeader><CardContent><p className="text-3xl font-bold">{value.toLocaleString()}</p></CardContent></Card>)}</div>
        {data && <Card className="border-slate-800 bg-slate-900 text-white"><CardHeader><CardTitle>AI consumption</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Metric label="Tokens" value={data.aiUsage.totalTokens} /><Metric label="Estimated cost" value={`$${Number(data.aiUsage.estimatedCost || 0).toFixed(4)}`} /><Metric label="Logged errors" value={data.errors} /></CardContent></Card>}</div>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border border-slate-800 bg-slate-950 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</p></div>; }
