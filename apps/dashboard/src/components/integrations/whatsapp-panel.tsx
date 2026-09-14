'use client';

import { useState } from 'react';
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MessageCircle, PlugZap, ShieldCheck, Smartphone, Unplug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    whatsappIntegrationsApi,
    type ChannelHealthReport,
    type WhatsAppConnection,
    type WhatsAppNumberChoice,
} from '@/lib/api';
import { SignupCancelled, launchWhatsAppSignup } from '@/lib/embedded-signup';
import { ConnectionState, IntegrationPanel, PanelMessage, SetupSteps } from './integration-shell';
import { ChannelHealthList, PlatformWarning } from './channel-health';

export const WHATSAPP_ACCENT = 'bg-[#25D366]/10 text-[#128C7E]';

/** Connected, needs a new token, or never set up — derived from the channel itself. */
export function whatsappState(connections?: WhatsAppConnection[], loading?: boolean): ConnectionState {
    if (loading) return 'loading';
    if (!connections?.length) return 'idle';
    if (connections.some((connection) => connection.connectionStatus === 'CONNECTED')) return 'connected';
    if (connections.some((connection) => connection.reauthorizationRequired || connection.connectionStatus === 'NEEDS_ATTENTION')) return 'attention';
    return 'disconnected';
}

function activity(connection: WhatsAppConnection) {
    const last = connection.lastInboundAt || connection.lastEventAt;
    if (last) return `Last customer message ${new Date(last).toLocaleString()}`;
    if (connection.lastVerifiedAt) return `Verified ${new Date(connection.lastVerifiedAt).toLocaleString()} · waiting for the first message`;
    return 'Waiting for the first customer message';
}

function numberLabel(connection: WhatsAppConnection) {
    return connection.displayPhoneNumber || `Phone number ID ${connection.phoneNumberId}`;
}

export function WhatsAppPanel({
    canManage, health, webhookUrl, platformReady, onHealthChanged,
}: {
    canManage: boolean;
    health?: ChannelHealthReport;
    webhookUrl?: string | null;
    platformReady?: boolean;
    onHealthChanged: () => void;
}) {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [numberChoices, setNumberChoices] = useState<{ sessionId: string; wabaName?: string; numbers: WhatsAppNumberChoice[] } | null>(null);
    const [selectedNumber, setSelectedNumber] = useState('');
    const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

    const connectionsQuery = useQuery({
        queryKey: ['whatsapp-connections'],
        queryFn: whatsappIntegrationsApi.list,
        enabled: canManage,
    });
    const setupQuery = useQuery({
        queryKey: ['whatsapp-setup'],
        queryFn: whatsappIntegrationsApi.setup,
        enabled: canManage,
        staleTime: 5 * 60_000,
    });
    const connections = connectionsQuery.data?.channels || [];
    const setup = setupQuery.data;
    const guided = Boolean(setup?.guidedAvailable && setup.appId && setup.configId);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
    const fail = (error: Error) => setMessage({ tone: 'error', text: error.message });

    /**
     * Meta's dialog does the whole setup. This only forwards the one-time code it
     * returns, then either reports a finished connection or asks which number to
     * use — the single question an account with several numbers still needs.
     */
    const connectGuided = useMutation({
        mutationFn: async (coexistence: boolean) => {
            const outcome = await launchWhatsAppSignup({
                appId: setup!.appId!,
                configId: setup!.configId!,
                graphVersion: setup!.graphVersion,
                coexistence,
            });
            return whatsappIntegrationsApi.connectGuided(outcome);
        },
        onSuccess: (result) => {
            if (!('connection' in result)) {
                setNumberChoices({ sessionId: result.sessionId, wabaName: result.wabaName, numbers: result.numbers });
                setSelectedNumber(result.numbers[0]?.choiceId || '');
                setMessage({ tone: 'info', text: 'This WhatsApp account has more than one number. Choose the one customers write to.' });
                return;
            }
            setNumberChoices(null);
            setMessage(result.connection.connectionStatus === 'CONNECTED'
                ? { tone: 'success', text: `${numberLabel(result.connection)} is connected. Send it a message to see it arrive in your inbox.` }
                : { tone: 'error', text: 'WhatsApp authorized this number but it is not ready to send yet. Open the checks below for what is missing.' });
            void refresh();
            onHealthChanged();
        },
        onError: (error: Error) => {
            if (error instanceof SignupCancelled) {
                setMessage({ tone: 'info', text: 'Setup was closed before it finished. Nothing was changed — you can start again whenever you like.' });
                return;
            }
            fail(error);
        },
    });

    const confirmNumber = useMutation({
        mutationFn: () => whatsappIntegrationsApi.confirmNumber(numberChoices!.sessionId, selectedNumber),
        onSuccess: ({ connection }) => {
            setNumberChoices(null);
            setSelectedNumber('');
            setMessage({ tone: 'success', text: `${numberLabel(connection)} is connected.` });
            void refresh();
            onHealthChanged();
        },
        onError: fail,
    });

    const connectManually = useMutation({
        mutationFn: () => whatsappIntegrationsApi.connectManually(phoneNumberId.trim(), accessToken.trim()),
        onSuccess: () => {
            setPhoneNumberId('');
            setAccessToken('');
            setMessage({ tone: 'success', text: 'WhatsApp number connected. Incoming messages will now appear in your inbox.' });
            void refresh();
            onHealthChanged();
        },
        onError: fail,
    });
    const verify = useMutation({
        mutationFn: (id: string) => whatsappIntegrationsApi.verify(id),
        onSuccess: (result) => {
            setMessage({ tone: 'success', text: `Verified with Meta${result.displayPhoneNumber ? ` · ${result.displayPhoneNumber}` : ''}.` });
            void refresh();
            onHealthChanged();
        },
        onError: fail,
    });
    const resubscribe = useMutation({
        mutationFn: (id: string) => whatsappIntegrationsApi.resubscribe(id),
        onSuccess: () => {
            setMessage({ tone: 'success', text: 'WhatsApp webhook subscription restored.' });
            void refresh();
            onHealthChanged();
        },
        onError: fail,
    });
    const toggleAI = useMutation({
        mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => whatsappIntegrationsApi.setAI(id, enabled),
        onSuccess: (result) => {
            setMessage({ tone: 'success', text: result.aiEnabled ? 'AI replies resumed on WhatsApp.' : 'AI replies paused. Your team can still reply from the inbox.' });
            void refresh();
            onHealthChanged();
        },
        onError: fail,
    });
    const disconnect = useMutation({
        mutationFn: (id: string) => whatsappIntegrationsApi.disconnect(id),
        onSuccess: () => {
            setMessage({ tone: 'success', text: 'WhatsApp disconnected and the stored token removed.' });
            void refresh();
            onHealthChanged();
        },
        onError: fail,
    });

    const state = whatsappState(connections, connectionsQuery.isLoading);
    const busy = connectGuided.isPending || confirmNumber.isPending || connectManually.isPending
        || verify.isPending || resubscribe.isPending || disconnect.isPending || toggleAI.isPending;
    const connectLabel = connections.length ? 'Connect another number' : 'Connect WhatsApp';

    return (
        <IntegrationPanel
            id="whatsapp"
            name="WhatsApp Business"
            description="Answer WhatsApp customers with the same AI, catalog and checkout. Messages land in your shared inbox."
            icon={MessageCircle}
            accent={WHATSAPP_ACCENT}
            state={state}
            action={guided ? (
                <Button onClick={() => connectGuided.mutate(false)} disabled={busy} className="w-full sm:w-auto">
                    {connectGuided.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                    {connectGuided.isPending ? 'Waiting for Meta…' : connectLabel}
                </Button>
            ) : undefined}
        >
            {message && <PanelMessage tone={message.tone}>{message.text}</PanelMessage>}

            {platformReady === false && (
                <PlatformWarning
                    ready={false}
                    label="This deployment is missing its WhatsApp webhook settings (verify token, app secret, Graph API version or the encryption key), so incoming messages cannot be accepted yet."
                />
            )}

            {guided && !numberChoices && (
                <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                    <SetupSteps
                        title={connections.length ? 'Adding another number' : 'Three steps, about two minutes'}
                        steps={[
                            <>Click <b className="text-foreground">{connectLabel}</b>. Meta&rsquo;s own window opens — sign in with the Facebook account that runs your business.</>,
                            <>Pick or create your WhatsApp Business account and confirm the phone number with the code Meta sends.</>,
                            <>The window closes and you are connected. SellPilot sets up the rest itself.</>,
                        ]}
                    />
                    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
                            <span>
                                Already chatting with customers on the <b className="text-foreground">WhatsApp Business app</b>?
                                Keep that same number and your chat history — you will still be able to reply from your phone.
                            </span>
                        </p>
                        <Button variant="outline" className="shrink-0" disabled={busy} onClick={() => connectGuided.mutate(true)}>
                            {connectGuided.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Connect my existing number
                        </Button>
                    </div>
                </div>
            )}

            {numberChoices && (
                <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <b className="block">Which number should answer customers?</b>
                    <p className="text-sm text-muted-foreground">
                        {numberChoices.wabaName ? `${numberChoices.wabaName} has ` : 'This account has '}
                        more than one WhatsApp number. You can connect the others later too.
                    </p>
                    <div className="grid gap-2">
                        {numberChoices.numbers.map((choice) => (
                            <label key={choice.choiceId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40">
                                <input
                                    type="radio"
                                    name="whatsapp-number"
                                    checked={selectedNumber === choice.choiceId}
                                    onChange={() => setSelectedNumber(choice.choiceId)}
                                />
                                <span className="min-w-0">
                                    <b className="block truncate">{choice.displayPhoneNumber || choice.verifiedName || 'WhatsApp number'}</b>
                                    <span className="text-xs text-muted-foreground">
                                        {choice.verifiedName || 'Unnamed'}{choice.qualityRating ? ` · quality ${choice.qualityRating.toLowerCase()}` : ''}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button disabled={!selectedNumber || confirmNumber.isPending} onClick={() => confirmNumber.mutate()}>
                            {confirmNumber.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Use this number
                        </Button>
                        <Button variant="ghost" disabled={confirmNumber.isPending} onClick={() => { setNumberChoices(null); setMessage(null); }}>Cancel</Button>
                    </div>
                </div>
            )}

            {health && (
                <ChannelHealthList
                    health={health}
                    webhookUrl={webhookUrl}
                    busy={busy}
                    onAction={(action, id) => {
                        if (action === 'verify') verify.mutate(id);
                        if (action === 'resubscribe') resubscribe.mutate(id);
                        if (action === 'reconnect') {
                            if (guided) connectGuided.mutate(false);
                            else verify.mutate(id);
                        }
                        if (action === 'enable_ai') toggleAI.mutate({ id, enabled: true });
                    }}
                />
            )}

            {connections.map((connection) => (
                <div key={connection.id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <b className="block truncate">{connection.name || 'WhatsApp Business'}</b>
                        <p className="text-xs text-muted-foreground">{numberLabel(connection)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{activity(connection)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={connection.connectionStatus === 'CONNECTED' ? 'default' : 'destructive'}>
                                {connection.connectionStatus.replaceAll('_', ' ')}
                            </Badge>
                            <Badge variant="secondary">AI {connection.aiEnabled ? 'on' : 'paused'}</Badge>
                            {connection.platformType === 'COEXISTENCE' && <Badge variant="secondary">Shared with your phone</Badge>}
                            {connection.qualityRating && <Badge variant="secondary">Quality {connection.qualityRating.toLowerCase()}</Badge>}
                            {connection.lastErrorCode && <Badge variant="destructive">Error {connection.lastErrorCode}</Badge>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => verify.mutate(connection.id)}>
                            {verify.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Verify
                        </Button>
                        {connection.wabaId && connection.subscription?.subscribed === false && (
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => resubscribe.mutate(connection.id)}>Restore webhook</Button>
                        )}
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => toggleAI.mutate({ id: connection.id, enabled: !connection.aiEnabled })}>
                            {connection.aiEnabled ? 'Pause AI' : 'Enable AI'}
                        </Button>
                        {connection.reauthorizationRequired && guided && (
                            <Button size="sm" disabled={busy} onClick={() => connectGuided.mutate(connection.platformType === 'COEXISTENCE')}>Reconnect</Button>
                        )}
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={async () => { if (await confirm({title:`Disconnect ${connection.name || 'this WhatsApp number'}?`,description:'New WhatsApp messages to this number stop reaching your AI.',consequences:['Existing conversations stay in your inbox','You can reconnect this number at any time'],confirmLabel:'Disconnect',tone:'warning'})) disconnect.mutate(connection.id); }}
                        >
                            <Unplug className="mr-1 h-4 w-4" />Disconnect
                        </Button>
                    </div>
                </div>
            ))}

            {!guided && !setupQuery.isLoading && (
                <PanelMessage tone="info">
                    Guided WhatsApp setup is not switched on for this deployment yet, so a number has to be connected with its own
                    credentials below. Once <code className="rounded bg-muted px-1 py-0.5 text-xs">WHATSAPP_CONFIG_ID</code> is set,
                    merchants connect in a single click instead.
                </PanelMessage>
            )}

            <details className="group rounded-2xl border border-border bg-muted/10 p-4" open={!guided}>
                <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    Advanced · connect with your own access token
                </summary>
                <div className="mt-4 space-y-4">
                    {guided && (
                        <p className="text-sm text-muted-foreground">
                            Most merchants never need this. It exists for a number that is already set up in your own Meta app,
                            or for testing before guided setup is approved.
                        </p>
                    )}
                    <SetupSteps
                        title="What you need"
                        steps={[
                            <>A <b className="text-foreground">WhatsApp Business account</b> in Meta Business Manager with a verified number.</>,
                            <>Open <a className="text-primary underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer noopener">Meta for Developers</a> → your app → <b className="text-foreground">WhatsApp → API Setup</b> and copy the <b className="text-foreground">Phone number ID</b>.</>,
                            <>From the same screen, generate a <b className="text-foreground">permanent access token</b> for a system user with <code className="rounded bg-muted px-1 py-0.5 text-xs">whatsapp_business_messaging</code>.</>,
                            <>Set the webhook URL to your SellPilot agent address and paste both values below.</>,
                        ]}
                    />
                    <form
                        className="grid gap-4 sm:grid-cols-2"
                        onSubmit={(event) => { event.preventDefault(); if (phoneNumberId.trim() && accessToken.trim()) connectManually.mutate(); }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp-phone-number-id">Phone number ID</Label>
                            <Input
                                id="whatsapp-phone-number-id"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="e.g. 123456789012345"
                                value={phoneNumberId}
                                onChange={(event) => setPhoneNumberId(event.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp-token">Permanent access token</Label>
                            <Input
                                id="whatsapp-token"
                                type="password"
                                autoComplete="new-password"
                                placeholder="Paste the system user token"
                                value={accessToken}
                                onChange={(event) => setAccessToken(event.target.value)}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Button type="submit" variant={guided ? 'outline' : 'default'} disabled={busy || !phoneNumberId.trim() || !accessToken.trim()}>
                                {connectManually.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                                Connect with token
                            </Button>
                        </div>
                    </form>
                </div>
            </details>

            <div className="flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p>
                    {guided
                        ? 'You authorize SellPilot inside Meta’s own window — your password is never seen here. The access token Meta issues is stored encrypted and never shown again.'
                        : 'The token is verified with Meta before it is saved, stored encrypted, and never shown again.'}
                    {' '}WhatsApp allows free-form replies for 24 hours after a customer writes; after that an approved template is required.
                </p>
            </div>

            {connections.some((connection) => connection.connectionStatus === 'CONNECTED') && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Send a message to your own number from another phone to see the whole round trip.
                </p>
            )}
        </IntegrationPanel>
    );
}
