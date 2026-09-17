/**
 * The shapes a page wears while it is still arriving.
 *
 * A skeleton is only worth showing if it is the same shape as what replaces it —
 * otherwise the page jumps the moment the data lands. These mirror the real
 * workspace surfaces (page header, metric row, panel, table), so the switch from
 * placeholder to content is a fill, not a re-layout.
 */

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return <span aria-hidden className={`sp-skeleton ${className}`} style={style} />;
}

/** Loading text for people who cannot see the shimmer. */
function Announce({ label }: { label: string }) {
    return <span role="status" aria-live="polite" className="sr-only">{label}</span>;
}

function PageHeaderSkeleton({ actions = 1 }: { actions?: number }) {
    return (
        <div className="merchant-page-header">
            <div className="w-full">
                <Skeleton className="block h-7 w-56 max-w-[70%]" />
                <Skeleton className="mt-3 block h-3 w-136 max-w-full" />
                <Skeleton className="mt-2 block h-3 w-88 max-w-[80%]" />
            </div>
            {actions > 0 && (
                <div className="merchant-page-actions">
                    {Array.from({ length: actions }, (_, index) => (
                        <Skeleton key={index} className="h-9 w-28 rounded-lg" />
                    ))}
                </div>
            )}
        </div>
    );
}

export function MetricsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="work-metrics">
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="work-metric">
                    <Skeleton className="block h-3 w-24" />
                    <Skeleton className="mt-4 block h-7 w-20" />
                    <Skeleton className="mt-3 block h-2.5 w-28" />
                </div>
            ))}
        </div>
    );
}

/**
 * A table that has not loaded yet. Column widths repeat a fixed pattern so the
 * rows read as a table rather than as a block of identical bars.
 */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
    const widths = ["70%", "45%", "60%", "35%", "55%", "40%"];
    return (
        <div className="work-table-scroll">
            <table className="work-table">
                <thead>
                    <tr>
                        {Array.from({ length: columns }, (_, index) => (
                            <th key={index}><Skeleton className="block h-2.5 w-16" /></th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }, (_, row) => (
                        <tr key={row}>
                            {Array.from({ length: columns }, (_, column) => (
                                <td key={column}>
                                    {column === 0 ? (
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                                            <div className="min-w-0 flex-1">
                                                <Skeleton className="block h-3 w-32 max-w-full" />
                                                <Skeleton className="mt-2 block h-2.5 w-20" />
                                            </div>
                                        </div>
                                    ) : (
                                        <Skeleton className="block h-3" style={{ width: widths[column % widths.length] }} />
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** The panel chrome — title, tools, and whatever body is passed in. */
export function PanelSkeleton({ children, tools = true }: { children: React.ReactNode; tools?: boolean }) {
    return (
        <section className="work-panel">
            <header>
                <div>
                    <Skeleton className="block h-3.5 w-32" />
                    <Skeleton className="mt-2 block h-2.5 w-48" />
                </div>
                {tools && (
                    <div className="work-panel-tools">
                        <Skeleton className="h-8 w-20 rounded-lg" />
                        <Skeleton className="h-8 w-20 rounded-lg" />
                        <Skeleton className="h-10 w-52 rounded-lg" />
                    </div>
                )}
            </header>
            {children}
        </section>
    );
}

/** The default shape of a workspace page: header, optional metrics, one table panel. */
export function WorkspaceSkeleton({
    label = "Loading page",
    metrics = 0,
    columns = 5,
    rows = 6,
    actions = 1,
    tabs = 0,
}: {
    label?: string;
    metrics?: number;
    columns?: number;
    rows?: number;
    actions?: number;
    tabs?: number;
}) {
    return (
        <div>
            <Announce label={`${label}…`} />
            <PageHeaderSkeleton actions={actions} />
            {tabs > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {Array.from({ length: tabs }, (_, index) => (
                        <Skeleton key={index} className="h-8 w-24 rounded-lg" />
                    ))}
                </div>
            )}
            {metrics > 0 && <MetricsSkeleton count={metrics} />}
            <PanelSkeleton>
                <TableSkeleton rows={rows} columns={columns} />
            </PanelSkeleton>
        </div>
    );
}

/** A page built from cards rather than a table — settings, integrations, billing. */
export function CardsSkeleton({ label = "Loading page", cards = 3 }: { label?: string; cards?: number }) {
    return (
        <div>
            <Announce label={`${label}…`} />
            <PageHeaderSkeleton actions={1} />
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: cards }, (_, index) => (
                    <section key={index} className="work-panel">
                        <header>
                            <div>
                                <Skeleton className="block h-3.5 w-40" />
                                <Skeleton className="mt-2 block h-2.5 w-56 max-w-full" />
                            </div>
                            <Skeleton className="h-8 w-24 rounded-lg" />
                        </header>
                        <div className="space-y-3 p-6">
                            <Skeleton className="block h-3 w-full" />
                            <Skeleton className="block h-3 w-4/5" />
                            <Skeleton className="block h-3 w-2/3" />
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

/** One conversation: the message column beside the customer context panel. */
export function ThreadSkeleton() {
    const bubbles = [
        { mine: false, width: "60%" },
        { mine: true, width: "45%" },
        { mine: false, width: "72%" },
        { mine: true, width: "38%" },
        { mine: false, width: "55%" },
    ];
    return (
        <div className="space-y-6">
            <Announce label="Loading conversation…" />
            <PageHeaderSkeleton actions={3} />
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <PanelSkeleton tools={false}>
                    <div className="space-y-6 p-4 sm:p-6">
                        {bubbles.map((bubble, index) => (
                            <div key={index} className={`flex flex-col ${bubble.mine ? "items-end" : "items-start"}`}>
                                <Skeleton className="mb-2 block h-2.5 w-28" />
                                <Skeleton className="block h-14 rounded-2xl" style={{ width: bubble.width }} />
                            </div>
                        ))}
                    </div>
                </PanelSkeleton>
                <div className="space-y-4">
                    {[0, 1].map((index) => (
                        <section key={index} className="rounded-xl border border-border bg-card">
                            <header className="border-b border-border px-5 py-3">
                                <Skeleton className="block h-3.5 w-28" />
                            </header>
                            <div className="space-y-3 p-5">
                                <Skeleton className="block h-3 w-36" />
                                <Skeleton className="block h-3 w-28" />
                                <Skeleton className="block h-3 w-44 max-w-full" />
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Test AI fills the whole workspace instead of sitting in the padded page area,
 * so its placeholder has to be a full-height three-column frame, not a page header.
 */
export function AssistantSkeleton() {
    return (
        <div className="flex h-full min-h-0 w-full">
            <Announce label="Loading Test AI…" />
            <div className="hidden w-64 shrink-0 flex-col gap-3 border-r border-border p-4 lg:flex">
                <Skeleton className="block h-9 w-full rounded-lg" />
                {Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3 py-2">
                        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1">
                            <Skeleton className="block h-3 w-24" />
                            <Skeleton className="mt-2 block h-2.5 w-32 max-w-full" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-3 border-b border-border p-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div>
                        <Skeleton className="block h-3.5 w-32" />
                        <Skeleton className="mt-2 block h-2.5 w-20" />
                    </div>
                </div>
                <div className="flex-1 space-y-6 overflow-hidden p-6">
                    {[{ mine: false, width: "58%" }, { mine: true, width: "42%" }, { mine: false, width: "66%" }, { mine: true, width: "35%" }].map((bubble, index) => (
                        <div key={index} className={`flex ${bubble.mine ? "justify-end" : "justify-start"}`}>
                            <Skeleton className="block h-12 rounded-2xl" style={{ width: bubble.width }} />
                        </div>
                    ))}
                </div>
                <div className="border-t border-border p-4">
                    <Skeleton className="block h-11 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}

/** Sign-in and the other pages that render without the workspace around them. */
export function AuthSkeleton() {
    return (
        <div className="grid min-h-dvh place-items-center p-6">
            <Announce label="Loading…" />
            <div className="w-full max-w-sm space-y-5">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="block h-6 w-48" />
                <Skeleton className="block h-3 w-64 max-w-full" />
                <div className="space-y-3 pt-2">
                    <Skeleton className="block h-11 w-full rounded-xl" />
                    <Skeleton className="block h-11 w-full rounded-xl" />
                    <Skeleton className="block h-11 w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}
