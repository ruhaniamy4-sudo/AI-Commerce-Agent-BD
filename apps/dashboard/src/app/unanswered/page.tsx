'use client';

import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import {
    CardContent,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { unansweredApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Target, Zap, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UnansweredQuestionsPage() {
    const { data: questions, isLoading } = useQuery({
        queryKey: ['unanswered'],
        queryFn: () => unansweredApi.getAll(),
    });

    if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Cognitive Gaps"
                description="Investigate the neural nexus's blindspots—queries that bypassed the knowledge base and require human mediation."
            />

            <div className="py-8">
                <div className="glass-card rounded-3xl overflow-hidden border-white/5 shadow-premium">
                    <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-white tracking-tight">Signal Anomalies</h2>
                                <p className="text-sm text-muted-foreground font-medium">{questions?.length || 0} unresolved payloads detected</p>
                            </div>
                            <div className="bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20 flex items-center gap-3">
                                <BrainCircuit className="h-4 w-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Intelligence Refinement Mode</span>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        {questions && questions.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-white/[0.02] hover:bg-white/[0.02] border-b border-white/5">
                                        <TableHead className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest w-[120px]">Interrogation Status</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Question Payload (Raw)</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Pulse Frequency</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Temporal Log</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {questions.map((q) => (
                                        <TableRow key={q._id} className="group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                                            <TableCell className="py-6 pl-8">
                                                <Badge className={cn(
                                                    "rounded-full px-4 py-1.5 font-black uppercase text-[9px] tracking-widest border-none",
                                                    q.status === 'pending' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                )}>
                                                    {q.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="max-w-md text-sm font-bold text-white tracking-tight italic leading-relaxed">
                                                    &ldquo;{q.query}&rdquo;
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 w-fit">
                                                    <Zap className="h-3.5 w-3.5 text-primary" />
                                                    <span className="text-[10px] font-black text-white">{q.frequency} times asked</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white tracking-tighter">
                                                        {format(new Date(q.lastAsked), 'PPp')}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest mt-0.5">
                                                        Sequence Index: {q._id.slice(-8).toUpperCase()}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-32 text-center">
                                <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-white/5">
                                    <Target className="h-10 w-10 text-emerald-500/20" />
                                </div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Zero Blindspots</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">Neural nexus is currently decoding all incoming signals with 100% precision. Total alignment achieved.</p>
                            </div>
                        )}
                    </CardContent>
                </div>
            </div>
            <div className="h-20" />
        </div>
    );
}
