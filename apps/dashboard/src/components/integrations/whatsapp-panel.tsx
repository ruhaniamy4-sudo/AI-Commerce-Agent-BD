'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, PlugZap, ShieldCheck, Unplug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { whatsappIntegrationsApi, type WhatsAppConnection } from '@/lib/api';
import { ConnectionState, IntegrationPanel, PanelMessage, SetupSteps } from './integration-shell';

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

export function WhatsAppPanel({ canManage }: { canManage: boolean }) {
    const queryClient = useQueryClient();
    const [phoneNumberId, setPhoneNumberId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

    const connectionsQuery = useQuery({
        queryKey: ['whatsapp-connections'],
        queryFn: whatsappIntegrationsApi.list,
        enabled: canManage,
    });
    const connections = connectionsQuery.data?.channels || [];
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['whatsapp-connections'] });
    const fail = (error: Error) => setMessage({ tone: 'error', text: error.message });

    const connect = useMutation({
        mutationFn: () => whatsappIntegrationsApi.connect(phoneNumberId.trim(), accessToken.trim()),
        onSuccess: () => {
            setPhoneNumberId('');
            setAccessToken('');
            setMessage({ tone: 'success', text: 'WhatsApp number connected. Incoming messages will now appear in your inbox.' });
            void refresh();
        },
        onError: fail,
    });
    const verify = useMutation({
        mutationFn: (id: string) => whatsappIntegrationsApi.verify(id),
        onSuccess: (result) => {
            setMessage({ tone: 'success', text: `Verified with Meta${result.displayPhoneNumber ? ` · ${result.displayPhoneNumber}` : ''}.` });
            void refresh();
        },
        onError: fail,
    });
    const toggleAI = useMutation({
        mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => whatsappIntegrationsApi.setAI(id, enabled),
        onSuccess: (result) => {
            setMessage({ tone: 'success', text: result.aiEnabled ? 'AI replies resumed on WhatsApp.' : 'AI replies paused. Your team can still reply from the inbox.' });
            void refresh();
        },
        onError: fail,
    });
    const disconnect = useMutation({
        mutationFn: (id: string) => whatsappIntegrationsApi.disconnect(id),
        onSuccess: () => {
            setMessage({ tone: 'success', text: 'WhatsApp disconnected and the stored token removed.' });
            void refresh();
        },
        onError: fail,
    });

    const state = whatsappState(connections, connectionsQuery.isLoading);
    const busy = connect.isPending || verify.isPending || disconnect.isPending || toggleAI.isPending;

    return (
        <IntegrationPanel
            id="whatsapp"
            name="WhatsApp Business"
            description="Answer WhatsApp customers with the same AI, catalog and checkout. Messages land in your shared inbox."
            icon={MessageCircle}
            accent={WHATSAPP_ACCENT}
            state={state}
        >
            {message && <PanelMessage tone={message.tone}>{message.text}</PanelMessage>}

            {connections.map((connection) => (
                <div key={connection.id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <b className="block truncate">{connection.name || 'WhatsApp Business'}</b>
                        <p className="text-xs text-muted-foreground">Phone number ID {connection.phoneNumberId}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{activity(connection)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={connection.connectionStatus === 'CONNECTED' ? 'default' : 'destructive'}>
                                {connection.connectionStatus.replaceAll('_', ' ')}
                            </Badge>
                            <Badge variant="secondary">AI {connection.aiEnabled ? 'on' : 'paused'}</Badge>
                            {connection.lastErrorCode && <Badge variant="destructive">Error {connection.lastErrorCode}</Badge>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => verify.mutate(connection.id)}>
                            {verify.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Verify
                        </Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => toggleAI.mutate({ id: connection.id, enabled: !connection.aiEnabled })}>
                            {connection.aiEnabled ? 'Pause AI' : 'Enable AI'}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => { if (window.confirm(`Disconnect ${connection.name || 'this WhatsApp number'}?`)) disconnect.mutate(connection.id); }}
                        >
                            <Unplug className="mr-1 h-4 w-4" />Disconnect
                        </Button>
                    </div>
                </div>
            ))}

            {!connections.length && (
                <SetupSteps
                    title="What you need"
                    steps={[
                        <>A <b className="text-foreground">WhatsApp Business account</b> in Meta Business Manager with a verified number.</>,
                        <>Open <a className="text-primary underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer noopener">Meta for Developers</a> → your app → <b className="text-foreground">WhatsApp → API Setup</b> and copy the <b className="text-foreground">Phone number ID</b>.</>,
                        <>From the same screen, generate a <b className="text-foreground">permanent access token</b> for a system user with <code className="rounded bg-muted px-1 py-0.5 text-xs">whatsapp_business_messaging</code>.</>,
                        <>Set the webhook URL to your SellPilot agent address and paste both values below.</>,
                    ]}
                />
            )}

            <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => { event.preventDefault(); if (phoneNumberId.trim() && accessToken.trim()) connect.mutate(); }}
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
                    <Button type="submit" disabled={busy || !phoneNumberId.trim() || !accessToken.trim()}>
                        {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                        {connections.length ? 'Connect another number' : 'Connect WhatsApp'}
                    </Button>
                </div>
            </form>

            <div className="flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p>
                    The token is verified with Meta before it is saved, stored encrypted, and never shown again.
                    WhatsApp allows free-form replies for 24 hours after a customer writes; after that an approved template is required.
                </p>
            </div>
        </IntegrationPanel>
    );
}
