'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Globe, KeyRound, Loader2, MessageCircle, PlugZap, ShieldCheck, Truck, Unplug } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ChannelSummaryTile,
    ConnectionState,
    IntegrationPanel,
    PanelMessage,
    SetupSteps,
} from '@/components/integrations/integration-shell';
import { WhatsAppPanel, WHATSAPP_ACCENT, whatsappState } from '@/components/integrations/whatsapp-panel';
import { ChannelHealthList, PlatformWarning } from '@/components/integrations/channel-health';
import { businessApi, courierIntegrationsApi, facebookIntegrationsApi, integrationHealthApi, whatsappIntegrationsApi } from '@/lib/api';
import { useSession } from 'next-auth/react';

const MESSENGER_ACCENT = 'bg-[#0084FF]/10 text-[#0084FF]';
const WEB_ACCENT = 'bg-primary/10 text-primary';

function openPanel(id: string) {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Move focus with the scroll, so keyboard and screen-reader users land there too.
    panel.setAttribute('tabindex', '-1');
    panel.focus({ preventScroll: true });
}

export default function IntegrationsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const queryClient = useQueryClient();
    const canManage = session?.role === 'Owner' || session?.role === 'Admin';

    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [courierMessage, setCourierMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [facebookSession, setFacebookSession] = useState('');
    const [selectedPage, setSelectedPage] = useState('');
    const [facebookMessage, setFacebookMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    const courierQuery = useQuery({ queryKey: ['courier-integration', 'steadfast'], queryFn: courierIntegrationsApi.getSteadfast, enabled: canManage });
    const channelsQuery = useQuery({ queryKey: ['business-channels'], queryFn: businessApi.channels, enabled: canManage });
    const facebookQuery = useQuery({ queryKey: ['facebook-connections'], queryFn: facebookIntegrationsApi.list, enabled: canManage });
    const whatsappQuery = useQuery({ queryKey: ['whatsapp-connections'], queryFn: whatsappIntegrationsApi.list, enabled: canManage });
    const healthQuery = useQuery({
        queryKey: ['integration-health'],
        queryFn: integrationHealthApi.get,
        enabled: canManage,
        refetchInterval: 60_000,
    });
    const refreshHealth = () => queryClient.invalidateQueries({ queryKey: ['integration-health'] });
    const pageChoices = useQuery({
        queryKey: ['facebook-session', facebookSession],
        queryFn: () => facebookIntegrationsApi.session(facebookSession),
        enabled: canManage && Boolean(facebookSession),
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setFacebookSession(params.get('facebookSession') || '');
        if (params.get('facebookError')) setFacebookMessage({ tone: 'error', text: 'Facebook authorization was not completed. Please try connecting again.' });
    }, []);

    const failFacebook = (error: Error) => setFacebookMessage({ tone: 'error', text: error.message });
    const refreshFacebook = () => queryClient.invalidateQueries({ queryKey: ['facebook-connections'] });

    const startFacebook = useMutation({ mutationFn: (includeContent: boolean) => facebookIntegrationsApi.start(includeContent), onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl), onError: failFacebook });
    const confirmFacebook = useMutation({
        mutationFn: () => facebookIntegrationsApi.confirm(facebookSession, selectedPage),
        onSuccess: () => {
            setFacebookMessage({ tone: 'success', text: 'Facebook Page connected. Messenger subscription and permissions were verified.' });
            setFacebookSession('');
            setSelectedPage('');
            window.history.replaceState({}, '', '/settings/integrations');
            void refreshFacebook();
        },
        onError: failFacebook,
    });
    const verifyFacebook = useMutation({ mutationFn: facebookIntegrationsApi.verify, onSuccess: () => { setFacebookMessage({ tone: 'success', text: 'Facebook connection verified.' }); void refreshFacebook(); refreshHealth(); }, onError: failFacebook });
    const resubscribeFacebook = useMutation({
        mutationFn: facebookIntegrationsApi.resubscribe,
        onSuccess: () => { setFacebookMessage({ tone: 'success', text: 'Messenger webhook subscription restored.' }); void refreshFacebook(); refreshHealth(); },
        onError: failFacebook,
    });
    const disconnectFacebook = useMutation({ mutationFn: facebookIntegrationsApi.disconnect, onSuccess: () => { setFacebookMessage({ tone: 'success', text: 'Facebook Page disconnected and its stored Page token removed.' }); void refreshFacebook(); }, onError: failFacebook });
    const toggleFacebookAI = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => facebookIntegrationsApi.setAI(id, enabled), onSuccess: () => { void refreshFacebook(); refreshHealth(); }, onError: failFacebook });

    const saveCourier = useMutation({
        mutationFn: () => courierIntegrationsApi.saveSteadfast({ apiKey, secretKey, deliveryType: 0 }),
        onSuccess: () => {
            setApiKey('');
            setSecretKey('');
            setCourierMessage({ tone: 'success', text: 'Steadfast credentials validated and saved.' });
            queryClient.invalidateQueries({ queryKey: ['courier-integration'] });
        },
        onError: (error: Error) => setCourierMessage({ tone: 'error', text: error.message }),
    });
    const testCourier = useMutation({
        mutationFn: courierIntegrationsApi.testSteadfast,
        onSuccess: () => { setCourierMessage({ tone: 'success', text: 'Connection confirmed by Steadfast.' }); queryClient.invalidateQueries({ queryKey: ['courier-integration'] }); },
        onError: (error: Error) => setCourierMessage({ tone: 'error', text: error.message }),
    });
    const disconnectCourier = useMutation({
        mutationFn: courierIntegrationsApi.disconnectSteadfast,
        onSuccess: () => { setCourierMessage({ tone: 'success', text: 'Steadfast disconnected and stored credentials removed.' }); queryClient.invalidateQueries({ queryKey: ['courier-integration'] }); },
        onError: (error: Error) => setCourierMessage({ tone: 'error', text: error.message }),
    });

    if (sessionStatus === 'loading') return <p role="status" className="p-6 text-muted-foreground">Loading integration access…</p>;
    if (!canManage) {
        return (
            <div className="space-y-8">
                <PageHeader title="Integrations" description="Connect the channels your customers already use." />
                <Card className="max-w-2xl"><CardContent className="pt-6 text-sm text-muted-foreground">Owner or Admin access is required to manage connections.</CardContent></Card>
            </div>
        );
    }

    const courier = courierQuery.data;
    const facebookConnections = facebookQuery.data || [];
    const whatsappConnections = whatsappQuery.data?.channels || [];

    const messengerState: ConnectionState = facebookQuery.isLoading
        ? 'loading'
        : facebookConnections.some((connection) => connection.connectionStatus === 'CONNECTED')
          ? 'connected'
          : facebookConnections.some((connection) => connection.reauthorizationRequired)
            ? 'attention'
            : facebookConnections.length ? 'disconnected' : 'idle';
    const webState: ConnectionState = channelsQuery.isLoading
        ? 'loading'
        : channelsQuery.data?.some((channel) => channel.platform === 'web' && channel.status === 'active') ? 'connected' : 'idle';
    const courierState: ConnectionState = courierQuery.isLoading ? 'loading' : courier?.connected ? 'connected' : courier?.configured ? 'attention' : 'idle';
    const waState = whatsappState(whatsappConnections, whatsappQuery.isLoading);

    const messengerHealth = healthQuery.data?.channels.find((entry) => entry.channel === 'messenger');
    const whatsappHealth = healthQuery.data?.channels.find((entry) => entry.channel === 'whatsapp');
    const liveChannels = [messengerState, waState, webState].filter((state) => state === 'connected').length;
    const courierBusy = saveCourier.isPending || testCourier.isPending || disconnectCourier.isPending;

    return (
        <div className="space-y-8">
            <PageHeader
                title="Integrations"
                description={liveChannels
                    ? `${liveChannels} of 3 customer channels are live. Connect the rest so every message reaches one inbox.`
                    : 'Connect the channels your customers already use. Every message lands in one inbox.'}
            />

            {(courierQuery.isError || channelsQuery.isError || facebookQuery.isError || whatsappQuery.isError) && (
                <PanelMessage tone="error">
                    Some connection statuses could not be loaded.{' '}
                    <button
                        className="underline"
                        onClick={() => {
                            void courierQuery.refetch(); void channelsQuery.refetch();
                            void facebookQuery.refetch(); void whatsappQuery.refetch();
                        }}
                    >
                        Retry status check
                    </button>
                </PanelMessage>
            )}

            {healthQuery.data?.platform.queueReady === false && (
                <PlatformWarning
                    ready={false}
                    label="Inbound messages are queued before the AI answers them, and this deployment has no queue configured (REDIS_URL). Messenger and WhatsApp messages will not be processed until it is set."
                />
            )}

            <section aria-label="Customer channels" className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Customer channels</h2>
                <div className="grid gap-3 md:grid-cols-3">
                    <ChannelSummaryTile name="Facebook Messenger" blurb="Reply to Page messages automatically" state={messengerState} icon={MessageCircle} accent={MESSENGER_ACCENT} onOpen={() => openPanel('messenger')} />
                    <ChannelSummaryTile name="WhatsApp Business" blurb="Sell on the app your customers live in" state={waState} icon={MessageCircle} accent={WHATSAPP_ACCENT} onOpen={() => openPanel('whatsapp')} />
                    <ChannelSummaryTile name="Website chat" blurb="Answer visitors on your storefront" state={webState} statusLabel={webState === 'idle' ? 'Not configured' : undefined} icon={Globe} accent={WEB_ACCENT} onOpen={() => openPanel('website')} />
                </div>
            </section>

            <IntegrationPanel
                id="messenger"
                name="Facebook Messenger"
                description="Authorize a Page you manage. SellPilot stores one encrypted Page token per business connection."
                icon={MessageCircle}
                accent={MESSENGER_ACCENT}
                state={messengerState}
                action={
                    <Button onClick={() => startFacebook.mutate(false)} disabled={startFacebook.isPending} className="w-full sm:w-auto">
                        {startFacebook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                        {facebookConnections.length ? 'Connect another Page' : 'Connect Facebook'}
                    </Button>
                }
            >
                {facebookMessage && <PanelMessage tone={facebookMessage.tone}>{facebookMessage.text}</PanelMessage>}

                {facebookSession && (
                    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                        <b className="block">Choose the Page to connect</b>
                        <p className="text-sm text-muted-foreground">Only connect a Page you are authorized to manage. SellPilot will act for this business and subscribe it to Messenger events.</p>
                        <div className="grid gap-2">
                            {pageChoices.isLoading && <p className="text-sm text-muted-foreground">Loading authorized Pages…</p>}
                            {pageChoices.data?.pages.map((page) => (
                                <label key={page.choiceId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40">
                                    <input type="radio" name="facebook-page" checked={selectedPage === page.choiceId} onChange={() => setSelectedPage(page.choiceId)} />
                                    {page.picture ? <img alt="" src={page.picture} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-muted" />}
                                    <span><b className="block">{page.name}</b><span className="text-xs text-muted-foreground">{page.category || 'Facebook Page'}</span></span>
                                </label>
                            ))}
                        </div>
                        <Button disabled={!selectedPage || confirmFacebook.isPending} onClick={() => confirmFacebook.mutate()}>
                            {confirmFacebook.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Authorize selected Page
                        </Button>
                    </div>
                )}

                {!facebookConnections.length && !facebookSession && (
                    <SetupSteps
                        title="How it works"
                        steps={[
                            <>Click <b className="text-foreground">Connect Facebook</b> — Meta’s own authorization screen opens.</>,
                            <>Pick the Page you manage. SellPilot subscribes it to Messenger events.</>,
                            <>Send a test message to your Page; it appears in <Link href="/conversations" className="text-primary underline">Conversations</Link> within seconds.</>,
                        ]}
                    />
                )}

                {facebookConnections.map((connection) => (
                    <div key={connection.id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            {connection.pagePicture ? <img alt="" src={connection.pagePicture} className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full bg-muted" />}
                            <div className="min-w-0">
                                <b className="block truncate">{connection.pageName}</b>
                                <p className="text-xs text-muted-foreground">
                                    {connection.pageCategory || 'Facebook Page'} · {connection.lastEventAt ? `Last event ${new Date(connection.lastEventAt).toLocaleString()}` : 'Waiting for the first message'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge variant={connection.connectionStatus === 'CONNECTED' ? 'default' : 'destructive'}>{connection.connectionStatus.replaceAll('_', ' ')}</Badge>
                                    <Badge variant="secondary">AI {connection.aiEnabled ? 'on' : 'paused'}</Badge>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => verifyFacebook.mutate(connection.id)} disabled={verifyFacebook.isPending}>Verify</Button>
                            <Button variant="outline" size="sm" onClick={() => toggleFacebookAI.mutate({ id: connection.id, enabled: !connection.aiEnabled })}>{connection.aiEnabled ? 'Pause AI' : 'Enable AI'}</Button>
                            {!connection.capabilities.canReadPageContent && <Button variant="outline" size="sm" onClick={() => startFacebook.mutate(true)}>Authorize Page learning</Button>}
                            {connection.reauthorizationRequired && <Button size="sm" onClick={() => startFacebook.mutate(false)}>Reconnect</Button>}
                            <Button variant="destructive" size="sm" onClick={() => { if (window.confirm(`Disconnect ${connection.pageName}?`)) disconnectFacebook.mutate(connection.id); }} disabled={disconnectFacebook.isPending}>
                                <Unplug className="mr-1 h-4 w-4" />Disconnect
                            </Button>
                        </div>
                    </div>
                ))}

                {messengerHealth && (
                    <ChannelHealthList
                        health={messengerHealth}
                        webhookUrl={healthQuery.data?.platform.webhooks?.messenger}
                        busy={verifyFacebook.isPending || resubscribeFacebook.isPending || toggleFacebookAI.isPending}
                        onAction={(action, id) => {
                            if (action === 'verify') verifyFacebook.mutate(id);
                            if (action === 'resubscribe') resubscribeFacebook.mutate(id);
                            if (action === 'reconnect') startFacebook.mutate(false);
                            if (action === 'enable_ai') toggleFacebookAI.mutate({ id, enabled: true });
                        }}
                    />
                )}

                <PlatformWarning
                    ready={healthQuery.data?.platform.messengerReady !== false}
                    label="This deployment is missing its Facebook app settings (app id, secret, verify token or public URL), so Messenger cannot receive events yet."
                />

                <div className="flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <p>Core authorization requests Page listing, Messenger replies and webhook management only. Page-content learning is optional and stays unavailable until its separate permission and App Review are approved.</p>
                </div>
            </IntegrationPanel>

            <WhatsAppPanel
                canManage={canManage}
                health={whatsappHealth}
                webhookUrl={healthQuery.data?.platform.webhooks?.whatsapp}
                platformReady={healthQuery.data?.platform.whatsappReady}
                onHealthChanged={refreshHealth}
            />

            <IntegrationPanel
                id="website"
                name="Website chat"
                description="The same assistant on your storefront, using the same catalog, knowledge and checkout."
                icon={Globe}
                accent={WEB_ACCENT}
                state={webState}
                statusLabel={webState === 'idle' ? 'Not configured' : undefined}
                action={<Button asChild variant="outline"><Link href="/assistant">Test the assistant</Link></Button>}
            >
                <SetupSteps
                    title="Before you go live"
                    steps={[
                        <>Import your products and approve business knowledge in <Link href="/training" className="text-primary underline">Train AI</Link>.</>,
                        <>Ask real customer questions in <Link href="/assistant" className="text-primary underline">Test AI</Link> and check the answers.</>,
                        <>Publish your storefront from <Link href="/store-builder" className="text-primary underline">Store Builder</Link>.</>,
                    ]}
                />
                <p className="text-sm text-muted-foreground">An active test channel does not confirm a widget is installed on an external website; that still needs rollout validation.</p>
            </IntegrationPanel>

            <section aria-label="Business services" className="space-y-3 pt-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Business services</h2>

                <IntegrationPanel
                    id="courier"
                    name="Steadfast Courier"
                    description="Create and track Bangladesh deliveries from a confirmed order."
                    icon={Truck}
                    accent="bg-primary/10 text-primary"
                    state={courierState}
                    statusLabel={courierState === 'attention' ? 'Saved, not verified' : undefined}
                >
                    {courierMessage && <PanelMessage tone={courierMessage.tone}>{courierMessage.text}</PanelMessage>}
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="steadfast-api-key">API key</Label>
                            <Input id="steadfast-api-key" type="password" autoComplete="off" placeholder={courier?.configured ? '••••••••••' : 'Enter API key'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="steadfast-secret">Secret key</Label>
                            <Input id="steadfast-secret" type="password" autoComplete="new-password" placeholder={courier?.configured ? '••••••••••' : 'Enter secret key'} value={secretKey} onChange={(event) => setSecretKey(event.target.value)} />
                        </div>
                    </div>
                    <div className="flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <p>Credentials are encrypted server-side and never returned to this dashboard. Enter both fields only when connecting or replacing them.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button onClick={() => saveCourier.mutate()} disabled={courierBusy || !apiKey || !secretKey}>
                            {saveCourier.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Save & validate
                        </Button>
                        <Button variant="outline" onClick={() => testCourier.mutate()} disabled={courierBusy || !courier?.configured}>Test connection</Button>
                        <Button variant="destructive" onClick={() => { if (window.confirm('Disconnect Steadfast and remove the saved courier credentials?')) disconnectCourier.mutate(); }} disabled={courierBusy || !courier?.configured}>
                            <Unplug className="mr-2 h-4 w-4" />Disconnect
                        </Button>
                    </div>
                </IntegrationPanel>

                <IntegrationPanel
                    id="payments"
                    name="Payments · bKash"
                    description="Choose the payment methods your customers can use at checkout."
                    icon={CreditCard}
                    accent="bg-[#E2136E]/10 text-[#E2136E]"
                    state="idle"
                    statusLabel="Gateway not connected"
                    action={<Button asChild variant="outline"><Link href="/settings/business#ordering">Payment preferences</Link></Button>}
                >
                    <p className="text-sm leading-6 text-muted-foreground">
                        Listing bKash as an accepted method tells customers how to pay; it does not enable automatic collection or verification yet.
                        Online gateway activation and sandbox verification are still pending.
                    </p>
                    <Button asChild variant="outline" className="w-fit"><Link href="/settings/billing">Billing & plan</Link></Button>
                </IntegrationPanel>
            </section>
        </div>
    );
}
