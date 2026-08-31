'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe, KeyRound, Loader2, MessageCircle, PlugZap, ShieldCheck, Unplug } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { businessApi, courierIntegrationsApi, facebookIntegrationsApi } from '@/lib/api';
import { useSession } from 'next-auth/react';

export default function IntegrationsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const queryClient = useQueryClient();
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [message, setMessage] = useState('');
    const [facebookSession, setFacebookSession] = useState('');
    const [selectedPage, setSelectedPage] = useState('');
    const [facebookMessage, setFacebookMessage] = useState('');
    const canManage = session?.role === 'Owner' || session?.role === 'Admin';
    const statusQuery = useQuery({ queryKey: ['courier-integration', 'steadfast'], queryFn: courierIntegrationsApi.getSteadfast, enabled: canManage });
    const channelsQuery = useQuery({ queryKey: ['business-channels'], queryFn: businessApi.channels, enabled: canManage });
    const facebookQuery = useQuery({ queryKey: ['facebook-connections'], queryFn: facebookIntegrationsApi.list, enabled: canManage });
    const pageChoices = useQuery({ queryKey: ['facebook-session', facebookSession], queryFn: () => facebookIntegrationsApi.session(facebookSession), enabled: canManage && Boolean(facebookSession) });
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setFacebookSession(params.get('facebookSession') || '');
        if (params.get('facebookError')) setFacebookMessage('Facebook authorization was not completed. Please try again.');
    }, []);

    const startFacebook = useMutation({ mutationFn: (includeContent: boolean) => facebookIntegrationsApi.start(includeContent), onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl), onError: (error: Error) => setFacebookMessage(error.message) });
    const confirmFacebook = useMutation({ mutationFn: () => facebookIntegrationsApi.confirm(facebookSession, selectedPage), onSuccess: () => { setFacebookMessage('Facebook Page connected. Messenger subscription and permissions were verified.'); setFacebookSession(''); setSelectedPage(''); window.history.replaceState({}, '', '/settings/integrations'); queryClient.invalidateQueries({ queryKey: ['facebook-connections'] }); }, onError: (error: Error) => setFacebookMessage(error.message) });
    const verifyFacebook = useMutation({ mutationFn: facebookIntegrationsApi.verify, onSuccess: () => { setFacebookMessage('Facebook connection verified.'); queryClient.invalidateQueries({ queryKey: ['facebook-connections'] }); }, onError: (error: Error) => setFacebookMessage(error.message) });
    const disconnectFacebook = useMutation({ mutationFn: facebookIntegrationsApi.disconnect, onSuccess: () => { setFacebookMessage('Facebook Page disconnected and its stored Page token removed.'); queryClient.invalidateQueries({ queryKey: ['facebook-connections'] }); }, onError: (error: Error) => setFacebookMessage(error.message) });
    const toggleFacebookAI = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => facebookIntegrationsApi.setAI(id, enabled), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facebook-connections'] }), onError: (error: Error) => setFacebookMessage(error.message) });

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
            <IntegrationCard icon={MessageCircle} name="Facebook Messenger" status={facebookQuery.data?.some(connection => connection.connectionStatus === 'CONNECTED') ? 'Connected' : 'Not connected'} />
            <IntegrationCard icon={Globe} name="Website Chat" status={channelsQuery.data?.some(channel => channel.platform === 'web' && channel.status === 'active') ? 'Connected' : 'Available'} />
            <IntegrationCard icon={MessageCircle} name="WhatsApp" status="Coming soon" muted />
        </div>
        <Card className="max-w-3xl border-border shadow-premium">
            <CardHeader className="border-b border-border"><div className="flex items-start justify-between gap-4"><div className="flex gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/10"><MessageCircle className="h-5 w-5 text-blue-500" /></div><div><CardTitle>Facebook Messenger</CardTitle><CardDescription className="mt-1">Authorize Pages you manage. SellPilot stores one encrypted Page token per business connection.</CardDescription></div></div><Button onClick={() => startFacebook.mutate(false)} disabled={startFacebook.isPending}>{startFacebook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}Connect Facebook</Button></div></CardHeader>
            <CardContent className="space-y-4 pt-6">
                {facebookMessage && <p className="rounded-xl border bg-muted/30 p-3 text-sm">{facebookMessage}</p>}
                {facebookSession && <div className="space-y-3 rounded-xl border p-4"><b>Choose a Facebook Page</b><p className="text-sm text-muted-foreground">Only connect a Page you are authorized to manage. SellPilot will act for this business and subscribe it to Messenger events.</p><div className="grid gap-2">{pageChoices.isLoading && <p className="text-sm">Loading authorized Pages…</p>}{pageChoices.data?.pages.map(page => <label key={page.choiceId} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><input type="radio" name="facebook-page" checked={selectedPage === page.choiceId} onChange={() => setSelectedPage(page.choiceId)} />{page.picture ? <img alt="" src={page.picture} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-muted" />}<span><b className="block">{page.name}</b><span className="text-xs text-muted-foreground">{page.category || 'Facebook Page'}</span></span></label>)}</div><Button disabled={!selectedPage || confirmFacebook.isPending} onClick={() => confirmFacebook.mutate()}>{confirmFacebook.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Authorize selected Page</Button></div>}
                {!facebookQuery.data?.length && !facebookSession && <p className="text-sm text-muted-foreground">No Facebook Page is connected. Connect starts Meta’s official authorization and Page chooser.</p>}
                {facebookQuery.data?.map(connection => <div key={connection.id} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{connection.pagePicture ? <img alt="" src={connection.pagePicture} className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full bg-muted" />}<div><b>{connection.pageName}</b><p className="text-xs text-muted-foreground">{connection.pageCategory || 'Facebook Page'} · {connection.lastEventAt ? `Last event ${new Date(connection.lastEventAt).toLocaleString()}` : 'Waiting for first event'}</p><div className="mt-1 flex gap-2"><Badge variant={connection.connectionStatus === 'CONNECTED' ? 'default' : 'destructive'}>{connection.connectionStatus.replaceAll('_', ' ')}</Badge><Badge variant="secondary">AI {connection.aiEnabled ? 'on' : 'off'}</Badge></div></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => verifyFacebook.mutate(connection.id)} disabled={verifyFacebook.isPending}>Verify</Button><Button variant="outline" size="sm" onClick={() => toggleFacebookAI.mutate({ id: connection.id, enabled: !connection.aiEnabled })}>{connection.aiEnabled ? 'Pause AI' : 'Enable AI'}</Button>{!connection.capabilities.canReadPageContent && <Button variant="outline" size="sm" onClick={() => startFacebook.mutate(true)}>Authorize Page learning</Button>}{connection.reauthorizationRequired && <Button size="sm" onClick={() => startFacebook.mutate(false)}>Reconnect</Button>}<Button variant="destructive" size="sm" onClick={() => { if (window.confirm(`Disconnect ${connection.pageName}?`)) disconnectFacebook.mutate(connection.id); }} disabled={disconnectFacebook.isPending}><Unplug className="mr-1 h-4 w-4" />Disconnect</Button></div></div>)}
                <div className="flex gap-3 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><p>Core authorization requests Page listing, Messenger replies, and webhook management only. Page-content learning is optional and remains unavailable until its separate permission and App Review are approved.</p></div>
            </CardContent>
        </Card>
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
