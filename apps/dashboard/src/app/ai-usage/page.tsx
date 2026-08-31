'use client';
import { useQuery } from '@tanstack/react-query';
import { aiUsageApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Coins, TextCursorInput, TextCursorInputIcon } from 'lucide-react';

export default function AIUsagePage() {
    const { data, isLoading, error } = useQuery({ queryKey: ['ai-usage', 30], queryFn: () => aiUsageApi.summary(30) });
    const cards: Array<[string, string | number, React.ElementType]> = data ? [
        ['LLM calls', data.llmCalls, BrainCircuit], ['Other AI calls', data.nonGenerationAiCalls, BrainCircuit], ['Input tokens', data.inputTokens, TextCursorInput],
        ['Output tokens', data.outputTokens, TextCursorInputIcon], ['Cached tokens', data.cachedTokens, TextCursorInput], ['Estimated cost', data.estimatedCost === null ? 'Cost unavailable' : `$${data.estimatedCost.toFixed(4)}`, Coins],
    ] : [];
    return <div className="space-y-6"><div><h1 className="text-3xl font-bold">AI usage</h1><p className="text-muted-foreground">Your business’s model activity for the last 30 days.</p></div>
        {isLoading && <p>Loading usage…</p>}{error && <p className="rounded border p-6 text-muted-foreground">Usage is unavailable while the agent API is offline.</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <Card key={label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle><Icon className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p></CardContent></Card>)}</div>
        {data && <p className="text-xs text-muted-foreground">Period: {new Date(data.period.from).toLocaleDateString()} – {new Date(data.period.to).toLocaleDateString()}</p>}</div>;
}
