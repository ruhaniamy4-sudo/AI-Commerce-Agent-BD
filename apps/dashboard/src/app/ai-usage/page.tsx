'use client';

import { PageHeader } from '@/components/layout/page-header';
import { aiUsageApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { BrainCircuit, Coins, TextCursorInput, TextCursorInputIcon } from 'lucide-react';

export default function AIUsagePage() {
    const { data, isLoading, error } = useQuery({ queryKey: ['ai-usage', 30], queryFn: () => aiUsageApi.summary(30) });
    const cards: Array<[string, string | number, string, React.ElementType]> = data ? [
        ['LLM calls', data.llmCalls, 'Generated replies and reasoning requests', BrainCircuit],
        ['Other AI calls', data.nonGenerationAiCalls, 'Classification and supporting AI tasks', BrainCircuit],
        ['Input tokens', data.inputTokens, 'Business context sent to models', TextCursorInput],
        ['Output tokens', data.outputTokens, 'Model-generated response tokens', TextCursorInputIcon],
        ['Cached tokens', data.cachedTokens, 'Context reused efficiently', TextCursorInput],
        ['Estimated cost', data.estimatedCost === null ? 'Unavailable' : `$${data.estimatedCost.toFixed(4)}`, 'Estimate for the selected period', Coins],
    ] : [];

    return <div className="mx-auto w-full max-w-[1500px] space-y-8 pb-20">
        <PageHeader title="AI Usage" description="Understand how SellPilot uses AI for your business during the last 30 days." />
        {isLoading && <div className="data-panel p-8 text-sm text-muted-foreground">Loading usage…</div>}
        {error && <div className="data-panel p-8 text-sm text-muted-foreground">Usage is unavailable while the agent service is offline.</div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(([label, value, description, Icon]) => <article className="metric-card sp-enter" key={label}><div className="flex items-start justify-between gap-4"><p className="sp-meta">{label}</p><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></article>)}
        </div>
        {data && <div className="data-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-muted-foreground"><span>Reporting period</span><strong className="font-semibold text-foreground">{new Date(data.period.from).toLocaleDateString()} – {new Date(data.period.to).toLocaleDateString()}</strong></div>}
    </div>;
}
