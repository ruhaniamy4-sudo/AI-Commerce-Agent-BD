'use client';

import { useState } from 'react';
import { AlertTriangle, Check, CircleHelp, Copy, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChannelHealthReport, HealthCheck } from '@/lib/api';

const CHECK_STYLES: Record<HealthCheck['state'], { icon: typeof Check; className: string }> = {
    pass: { icon: Check, className: 'text-emerald-600 bg-emerald-500/10' },
    warn: { icon: AlertTriangle, className: 'text-amber-600 bg-amber-500/10' },
    fail: { icon: XCircle, className: 'text-rose-600 bg-rose-500/10' },
    unknown: { icon: CircleHelp, className: 'text-muted-foreground bg-muted' },
};

const ACTION_LABELS: Record<string, string> = {
    verify: 'Verify now',
    reconnect: 'Reconnect',
    resubscribe: 'Re-subscribe',
    enable_ai: 'Enable AI',
    configure_webhook: 'Show webhook URL',
};

/**
 * Why this channel is or is not working. Each line states what was actually
 * checked, and carries the one action that fixes it.
 */
export function ChannelHealthList({
    health, webhookUrl, busy, onAction,
}: {
    health?: ChannelHealthReport;
    webhookUrl?: string | null;
    busy?: boolean;
    onAction: (action: string, channelId: string) => void;
}) {
    const [showWebhook, setShowWebhook] = useState(false);
    const [copied, setCopied] = useState(false);
    if (!health) return null;

    async function copyWebhook() {
        if (!webhookUrl) return;
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div className="rounded-2xl border border-border">
            <p className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Connection health
            </p>
            <ul className="divide-y divide-border">
                {health.checks.map((check) => {
                    const { icon: Icon, className } = CHECK_STYLES[check.state];
                    return (
                        <li key={check.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 gap-3">
                                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${className}`}>
                                    <Icon className="h-3 w-3" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{check.label}</p>
                                    <p className="text-xs leading-5 text-muted-foreground">{check.detail}</p>
                                </div>
                            </div>
                            {check.action && (
                                <Button
                                    size="sm"
                                    variant={check.state === 'fail' ? 'default' : 'outline'}
                                    disabled={busy}
                                    className="shrink-0 self-start sm:self-auto"
                                    onClick={() => {
                                        if (check.action === 'configure_webhook') setShowWebhook(true);
                                        else onAction(check.action!, health.id);
                                    }}
                                >
                                    {check.action === 'verify' && <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                                    {ACTION_LABELS[check.action] || check.action}
                                </Button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {showWebhook && webhookUrl && (
                <div className="border-t border-border bg-muted/20 p-4">
                    <p className="mb-2 text-xs text-muted-foreground">
                        Paste this as the callback URL in Meta, with the verify token from your deployment settings:
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs">{webhookUrl}</code>
                        <Button size="sm" variant="outline" onClick={copyWebhook}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** A deployment-level problem no merchant action can fix — say so plainly. */
export function PlatformWarning({ ready, label }: { ready: boolean; label: string }) {
    if (ready) return null;
    return (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            {label}
        </p>
    );
}
