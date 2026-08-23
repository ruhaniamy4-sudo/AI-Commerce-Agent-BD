'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { errorsApi } from '@/lib/api';
import type { ErrorLog } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
    AlertCircle,
    ChevronRight,
    Loader2,
    RefreshCw,
    Terminal,
    Trash2,
    ShieldAlert,
    Activity,
    Zap,
    History,
} from 'lucide-react';
import { useState } from 'react';

export default function ErrorsPage() {
    const queryClient = useQueryClient();
    const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

    const {
        data: errors,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['errors'],
        queryFn: async () => {
            const res = await errorsApi.getAll();
            return res || [];
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => errorsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['errors'] });
            setSelectedError(null);
        },
    });

    const clearAllMutation = useMutation({
        mutationFn: () => errorsApi.clearAll(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['errors'] });
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background min-h-[90vh]">
            <PageHeader
                title="Telemetry Logs"
                description="Real-time analysis of system failures and technical anomalies."
                actions={
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => refetch()}
                            className="h-11 px-6 rounded-2xl border-border bg-secondary/50 hover:bg-secondary transition-colors font-bold"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refetch
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (confirm('Verify: Deep-purge all technical logs?')) {
                                    clearAllMutation.mutate();
                                }
                            }}
                            className="h-11 px-6 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20 font-black uppercase tracking-widest text-[10px]"
                            disabled={!errors || errors.length === 0}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Purge Archives
                        </Button>
                    </div>
                }
            />

            <div className="container px-6 py-10">
                <Card className="glass-card border-border shadow-premium rounded-3xl overflow-hidden bg-card/50">
                    <div className="p-8 border-b border-border flex items-center justify-between">
                        <div className="flex gap-8">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-1">Status</span>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                    <span className="text-sm font-bold text-foreground tracking-tight">Monitoring Active</span>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-1">Buffer Usage</span>
                                <div className="flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-sm font-bold text-foreground tracking-tight">{errors?.length || 0} Entries</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                                <TableHead className="font-bold py-5 pl-8 text-muted-foreground/40 uppercase text-[10px] tracking-[0.2em]">Temporal Origin</TableHead>
                                <TableHead className="font-bold py-5 text-muted-foreground/40 uppercase text-[10px] tracking-[0.2em]">Anomaly Type</TableHead>
                                <TableHead className="font-bold py-5 text-muted-foreground/40 uppercase text-[10px] tracking-[0.2em]">Payload Description</TableHead>
                                <TableHead className="text-right font-bold py-5 pr-8 text-muted-foreground/40 uppercase text-[10px] tracking-[0.2em]">Calibration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {errors && errors.length > 0 ? (
                                errors.map((error: ErrorLog) => (
                                    <TableRow
                                        key={error._id}
                                        className="hover:bg-white/[0.02] transition-colors border-b border-white/5 group"
                                    >
                                        <TableCell className="py-6 pl-8">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-foreground tracking-tight">
                                                    {format(parseISO(error.timestamp), 'HH:mm:ss')}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest mt-1">
                                                    {format(parseISO(error.timestamp), 'MMM d, yyyy')}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6">
                                            <Badge
                                                variant="outline"
                                                className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-black uppercase text-[10px] tracking-widest px-3 py-1 rounded-lg"
                                            >
                                                {error.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-6 max-w-md">
                                            <div
                                                className="truncate text-foreground/70 font-medium text-sm leading-relaxed"
                                                title={error.message}
                                            >
                                                {error.message}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-6 pr-8">
                                            <Button
                                                variant="ghost"
                                                onClick={() => setSelectedError(error)}
                                                className="h-10 px-4 rounded-xl bg-secondary/50 border border-border hover:bg-secondary font-bold group-hover:border-primary/50 transition-all"
                                            >
                                                Telemetry
                                                <ChevronRight className="h-4 w-4 ml-1 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableCell
                                        colSpan={4}
                                        className="h-[400px] text-center"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-6 opacity-20">
                                            <div className="h-20 w-20 rounded-full border-2 border-dashed border-white flex items-center justify-center">
                                                <ShieldAlert className="h-10 w-10 text-white" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xl font-black text-white tracking-tighter uppercase">Static Signal</p>
                                                <p className="text-xs font-bold text-white uppercase tracking-widest">No anomalies detected in this quadrant.</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            <Dialog
                open={!!selectedError}
                onOpenChange={() => setSelectedError(null)}
            >
                <DialogContent className="max-w-3xl border-border shadow-2xl rounded-3xl bg-background text-foreground p-0 overflow-hidden">
                    <DialogHeader className="p-10 bg-muted/20 border-b border-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30 flex items-center gap-2">
                                <AlertCircle className="h-3 w-3 text-rose-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Anomaly Detected</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-widest italic font-bold">Trace ID: {selectedError?._id.slice(-12).toUpperCase()}</span>
                        </div>
                        <DialogTitle className="text-4xl font-black text-foreground tracking-tighter leading-none mb-2">
                            Structural Failure Details
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground/60 text-base font-medium">
                            Deep-dive analysis and technical telemetry for the recorded system event.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedError && (
                        <div className="p-10 space-y-10 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                        <Activity className="h-3 w-3" /> Event Category
                                    </div>
                                    <p className="text-lg font-black text-foreground flex items-center gap-3">
                                        <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                        {selectedError.type}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                        <History className="h-3 w-3" /> Temporal Stamp
                                    </div>
                                    <p className="text-lg font-black text-foreground">
                                        {format(parseISO(selectedError.timestamp), 'PPPP p')}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                    <Terminal className="h-3 w-3" /> Raw Payload Message
                                </div>
                                <div className="p-6 bg-muted/30 rounded-2xl border border-border text-sm font-bold text-foreground/90 leading-relaxed shadow-inner italic">
                                    &ldquo;{selectedError.message}&rdquo;
                                </div>
                            </div>

                            {selectedError.stack && (
                                <div className="space-y-4 pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                        <ShieldAlert className="h-3 w-3" /> Logic Execution Trace (Stack)
                                    </div>
                                    <pre className="p-8 bg-black/60 rounded-3xl text-[11px] text-rose-200/50 overflow-x-auto whitespace-pre-wrap font-mono leading-loose shadow-2xl border border-rose-500/10">
                                        {selectedError.stack}
                                    </pre>
                                </div>
                            )}

                            {selectedError.context && Object.keys(selectedError.context).length > 0 && (
                                <div className="space-y-4 pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                        <Zap className="h-3 w-3" /> Environmental Context
                                    </div>
                                    <pre className="p-8 bg-muted/30 rounded-3xl text-[11px] text-primary/60 overflow-x-auto font-mono leading-relaxed border border-border shadow-2xl">
                                        {JSON.stringify(selectedError.context, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="p-10 bg-muted/10 border-t border-border flex items-center justify-between">
                        <Button
                            variant="ghost"
                            className="h-14 px-8 rounded-2xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-black uppercase tracking-widest text-[11px]"
                            onClick={() => deleteMutation.mutate(selectedError!._id)}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-3" />
                            Purge Trace
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setSelectedError(null)}
                            className="h-14 px-12 rounded-2xl border-border bg-secondary/50 hover:bg-secondary font-black uppercase tracking-widest text-[11px]"
                        >
                            Acknowledge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
