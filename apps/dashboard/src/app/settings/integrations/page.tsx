'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe, KeyRound, Loader2, MessageCircle, PlugZap, ShieldCheck, Unplug } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { businessApi, courierIntegrationsApi } from '@/lib/api';
import { useSession } from 'next-auth/react';

export default function IntegrationsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const queryClient = useQueryClient();
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [message, setMessage] = useState('');
    const canManage = session?.role === 'Owner' || session?.role === 'Admin';
    const statusQuery = useQuery({ queryKey: ['courier-integration', 'steadfast'], queryFn: courierIntegrationsApi.getSteadfast, enabled: canManage });
    const channelsQuery = useQuery({ queryKey: ['business-channels'], queryFn: businessApi.channels, enabled: canManage });

    const save = useMutation({
        mutationFn: () => courierIntegrationsApi.saveSteadfast({ apiKey, secretKey, deliveryType: 0 }),
        onSuccess: () => {
            setApiKey('');
            setSecretKey('');
            setMessage('Steadfast credentials validated and saved.');
            queryClient.invalidateQueries({ queryKey: ['courier-integration'] });
        },
        onError: (error: Error) => setMessage(error.message),
    });
    const test = useMutation({
        mutationFn: courierIntegrationsApi.testSteadfast,
        onSuccess: () => {
            setMessage('Connection confirmed by Steadfast.');
            queryClient.invalidateQueries({ queryKey: ['courier-integration'] });
        },
        onError: (error: Error) => setMessage(error.message),
    });
    const disconnect = useMutation({
        mutationFn: courierIntegrationsApi.disconnectSteadfast,
        onSuccess: () => {
            setMessage('Steadfast disconnected and stored credentials removed.');
            queryClient.invalidateQueries({ queryKey: ['courier-integration'] });
        },
        onError: (error: Error) => setMessage(error.message),
    });
    const busy = save.isPending || test.isPending || disconnect.isPending;
    const status = statusQuery.data;

    if (sessionStatus !== 'loading' && !canManage) {
        return <div className="space-y-8"><PageHeader title="Integrations" description="Manage business-scoped courier connections." /><Card className="max-w-2xl"><CardContent className="pt-6 text-sm text-muted-foreground">Owner or Admin access is required to manage courier credentials.</CardContent></Card></div>;
    }

    return <div className="space-y-8">
        <PageHeader title="Integrations" description="Connect customer channels and business-scoped services." />
        <div className="grid gap-4 md:grid-cols-3">
            <IntegrationCard icon={MessageCircle} name="Facebook Messenger" status={channelsQuery.data?.some(channel => channel.platform === 'facebook' && channel.status === 'active') ? 'Connected' : 'Not connected'} />
            <IntegrationCard icon={Globe} name="Website Chat" status={channelsQuery.data?.some(channel => channel.platform === 'web' && channel.status === 'active') ? 'Connected' : 'Available'} />
            <IntegrationCard icon={MessageCircle} name="WhatsApp" status="Coming soon" muted />
        </div>
        <Card className="max-w-3xl border-border shadow-premium">
            <CardHeader className="border-b border-border">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10"><PlugZap className="h-5 w-5 text-primary" /></div><div><CardTitle>Steadfast Courier</CardTitle><CardDescription className="mt-1">Create and track Bangladesh deliveries after merchant approval.</CardDescription></div></div>
                    <Badge variant={status?.connected ? 'default' : 'secondary'}>{status?.connected ? 'Connected' : 'Not connected'}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="steadfast-api-key">API key</Label><Input id="steadfast-api-key" type="password" autoComplete="off" placeholder={status?.configured ? '••••••••••' : 'Enter API key'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="steadfast-secret">Secret key</Label><Input id="steadfast-secret" type="password" autoComplete="new-password" placeholder={status?.configured ? '••••••••••' : 'Enter secret key'} value={secretKey} onChange={(event) => setSecretKey(event.target.value)} /></div>
                </div>
                <div className="flex gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p>Credentials are encrypted server-side and are never returned to this dashboard. Enter both fields only when connecting or replacing credentials.</p></div>
                {message && <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />{message}</div>}
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => save.mutate()} disabled={busy || !apiKey || !secretKey}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Save & validate</Button>
                    <Button variant="outline" onClick={() => test.mutate()} disabled={busy || !status?.configured}>Test connection</Button>
                    <Button variant="destructive" onClick={() => disconnect.mutate()} disabled={busy || !status?.configured}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button>
                </div>
            </CardContent>
        </Card>
    </div>;
}

function IntegrationCard({ icon: Icon, name, status, muted = false }: { icon: React.ElementType; name: string; status: string; muted?: boolean }) {
    return <Card className={muted ? 'opacity-60' : ''}><CardContent className="flex items-center justify-between p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div><b>{name}</b><p className="text-xs text-muted-foreground">{status}</p></div></div><Badge variant={status === 'Connected' ? 'default' : 'secondary'}>{status}</Badge></CardContent></Card>;
}
