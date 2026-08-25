'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle } from 'lucide-react';
export default function HomePage() {
    const { data, isLoading } = useQuery({ queryKey: ['setup-status'], queryFn: onboardingApi.status });
    const items = data ? [['Business created',data.business],['Product added',data.productAdded],['Knowledge added',data.knowledgeAdded],['AI tested',data.aiTested],['Facebook connected',data.facebookConnected],['Steadfast connected',data.steadfastConnected]] as const : [];
    return <div className="mx-auto max-w-3xl space-y-6"><div><h1 className="text-3xl font-bold">Setup checklist</h1><p className="text-muted-foreground">Keep improving what your SellPilot AI can sell and answer.</p></div><Card><CardHeader><CardTitle>Your workspace</CardTitle></CardHeader><CardContent className="space-y-3">{isLoading && <p>Loading…</p>}{items.map(([label,done])=><div key={label} className="flex items-center gap-3 rounded-lg border p-3">{done?<CheckCircle2 className="text-green-600"/>:<Circle className="text-muted-foreground"/>}<span>{label}</span></div>)}<Button asChild className="mt-4"><Link href="/test-ai">Try your AI</Link></Button></CardContent></Card></div>;
}
