import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type ConnectionState = 'connected' | 'attention' | 'disconnected' | 'idle' | 'loading';

const STATES: Record<ConnectionState, { label: string; icon: typeof CheckCircle2; className: string }> = {
    connected: { label: 'Connected', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20' },
    attention: { label: 'Needs attention', icon: AlertTriangle, className: 'bg-amber-500/10 text-amber-600 ring-amber-500/20' },
    disconnected: { label: 'Disconnected', icon: XCircle, className: 'bg-rose-500/10 text-rose-600 ring-rose-500/20' },
    idle: { label: 'Not connected', icon: CircleDashed, className: 'bg-muted text-muted-foreground ring-border' },
    loading: { label: 'Checking…', icon: Loader2, className: 'bg-muted text-muted-foreground ring-border' },
};

/** One status vocabulary across every integration, so "connected" always means the same thing. */
export function StatusPill({ state, label }: { state: ConnectionState; label?: string }) {
    const { label: fallback, icon: Icon, className } = STATES[state];
    return (
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}>
            <Icon className={`h-3.5 w-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
            {label || fallback}
        </span>
    );
}

/** The summary tile at the top of the page: what is live, at a glance. */
export function ChannelSummaryTile({
    name, blurb, state, statusLabel, accent, icon: Icon, onOpen,
}: {
    name: string;
    blurb: string;
    state: ConnectionState;
    statusLabel?: string;
    accent: string;
    icon: React.ElementType;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-premium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent}`}>
                <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{blurb}</span>
            </span>
            <StatusPill state={state} label={statusLabel} />
        </button>
    );
}

/** The expanded panel for one integration. */
export function IntegrationPanel({
    id, name, description, icon: Icon, accent, state, statusLabel, action, children,
}: {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
    accent: string;
    state: ConnectionState;
    statusLabel?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card id={id} className="scroll-mt-24 border-border shadow-premium">
            <CardHeader className="border-b border-border">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4">
                        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <CardTitle>{name}</CardTitle>
                                <StatusPill state={state} label={statusLabel} />
                            </div>
                            <CardDescription className="mt-1 max-w-xl">{description}</CardDescription>
                        </div>
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">{children}</CardContent>
        </Card>
    );
}

/** Numbered setup instructions — the difference between "connect" and "how do I connect?". */
export function SetupSteps({ title, steps }: { title: string; steps: ReactNode[] }) {
    return (
        <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
            <ol className="space-y-2.5">
                {steps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                            {index + 1}
                        </span>
                        <span className="min-w-0">{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

/** Feedback that belongs to one integration, never a page-wide banner. */
export function PanelMessage({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
    const styles = {
        success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
        error: 'border-destructive/30 bg-destructive/5 text-destructive',
        info: 'border-border bg-muted/30 text-muted-foreground',
    }[tone];
    return (
        <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${styles}`}>
            {children}
        </p>
    );
}
