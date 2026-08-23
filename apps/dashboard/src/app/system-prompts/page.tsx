'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    CardContent,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { systemPromptsApi } from '@/lib/api';
import { SystemPrompt } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Bot,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Pencil,
    Plus,
    Search,
    Cpu,
    Scale,
    Binary,
    Activity,
    Save,
    Trash
} from 'lucide-react';
import { useState } from 'react';

export default function SystemPromptsPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [page, setPage] = useState(1);
    const limit = 10;

    const [formState, setFormState] = useState({
        name: '',
        content: '',
        description: '',
        isActive: false,
    });

    const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);

    const { data: response, isLoading } = useQuery({
        queryKey: ['system-prompts', page, searchQuery],
        queryFn: () => systemPromptsApi.getAll({ page, limit, search: searchQuery }),
    });

    const prompts = response?.data || [];
    const pagination = response?.pagination;

    const createMutation = useMutation({
        mutationFn: (data: typeof formState) => systemPromptsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-prompts'] });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (error) => {
            console.error('Failed to create system prompt:', error);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<SystemPrompt> }) =>
            systemPromptsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-prompts'] });
            setEditingPrompt(null);
        },
        onError: (error) => {
            console.error('Failed to update system prompt:', error);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => systemPromptsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['system-prompts'] });
        },
        onError: (error) => {
            console.error('Failed to delete system prompt:', error);
        },
    });

    const resetForm = () => {
        setFormState({
            name: '',
            content: '',
            description: '',
            isActive: false,
        });
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(formState);
    };

    const handleUpdateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPrompt) return;
        updateMutation.mutate({
            id: editingPrompt._id,
            data: {
                name: editingPrompt.name,
                content: editingPrompt.content,
                description: editingPrompt.description,
                isActive: editingPrompt.isActive,
            },
        });
    };

    const handleActiveToggle = (prompt: SystemPrompt, newValue: boolean) => {
        updateMutation.mutate({
            id: prompt._id,
            data: { isActive: newValue },
        });
    };

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="animate-spin text-primary h-12 w-12" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Neural Architect"
                description="Engineered directives for agent cognition. Orchestrate the core behavioral logic of your AI workforce."
                actions={
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 py-6 shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 text-sm font-bold">
                                <Plus className="h-5 w-5" /> Manifest Logic
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl p-0 overflow-hidden border-border shadow-2xl rounded-3xl bg-background text-foreground">
                            <form onSubmit={handleCreateSubmit}>
                                <DialogHeader className="p-8 bg-muted/10 border-b border-border">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
                                            <Cpu className="h-3 w-3 text-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Core Processor</span>
                                        </div>
                                    </div>
                                    <DialogTitle className="text-3xl font-black text-foreground tracking-tighter">Initialize Persona</DialogTitle>
                                    <DialogDescription className="text-muted-foreground font-medium mt-1">
                                        Define the fundamental operating rules and conversational parameters for the neural agent.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-2.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Architectural ID</Label>
                                            <div className="relative group">
                                                <Binary className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                                <Input
                                                    placeholder="e.g. Sales Expert v1.0"
                                                    value={formState.name}
                                                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                                    className="pl-12 h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Deployment Status</Label>
                                            <div className="flex items-center justify-between h-14 px-6 bg-muted/10 border border-border rounded-2xl shadow-inner">
                                                <span className="text-sm font-bold text-foreground tracking-tight">Active Sequence</span>
                                                <Switch
                                                    checked={formState.isActive}
                                                    onCheckedChange={(checked) => setFormState({ ...formState, isActive: checked })}
                                                    className="data-[state=checked]:bg-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sector Objective (Description)</Label>
                                        <Input
                                            placeholder="Deployment scope and behavioral goals..."
                                            value={formState.description}
                                            onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                                            className="h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Instructions (Payload)</Label>
                                        <Textarea
                                            placeholder="You are a strategic commerce envoy..."
                                            value={formState.content}
                                            onChange={(e) => setFormState({ ...formState, content: e.target.value })}
                                            required
                                            rows={14}
                                            className="font-mono text-xs bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground py-6 leading-relaxed"
                                        />
                                    </div>
                                </div>
                                <div className="p-8 bg-muted/30 border-t border-border flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-14 rounded-2xl border-border bg-transparent text-foreground px-8 font-bold hover:bg-accent">Cancel</Button>
                                    <Button type="submit" disabled={createMutation.isPending} className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                                        {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Initialize
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                }
            />

            <div className="py-8">
                <div className="glass-card rounded-3xl overflow-hidden border-border shadow-premium">
                    <div className="p-8 border-b border-border bg-muted/5">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Logic Repository</h2>
                                <p className="text-sm text-muted-foreground font-medium">{pagination?.total || 0} instruction sets compiled</p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search architectural directives..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="pl-12 h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/50"
                                />
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        {prompts.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border">
                                        <TableHead className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest w-[180px]">Sequence Status</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Architectural ID</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Objective Delta</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {prompts.map((prompt) => (
                                        <TableRow key={prompt._id} className={cn(
                                            "group border-b border-border/10 hover:bg-muted/5 transition-colors",
                                            prompt.isActive && "bg-primary/[0.03]"
                                        )}>
                                            <TableCell className="py-6 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <Switch
                                                        checked={prompt.isActive}
                                                        onCheckedChange={(checked) => handleActiveToggle(prompt, checked)}
                                                        disabled={updateMutation.isPending && updateMutation.variables?.id === prompt._id}
                                                        className="data-[state=checked]:bg-emerald-500"
                                                    />
                                                    {prompt.isActive && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                            <Activity className="h-2.5 w-2.5 text-emerald-500" />
                                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-black text-foreground tracking-tight">{prompt.name}</span>
                                                    <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 uppercase tracking-widest">Updated {format(new Date(prompt.updatedAt), 'PP')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="text-sm font-medium text-muted-foreground truncate max-w-[400px]">
                                                    {prompt.description || <span className="opacity-20 italic">No behavioral objective defined</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-right pr-8">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setEditingPrompt(prompt)}
                                                        className="h-10 w-10 bg-secondary border border-border text-foreground hover:text-primary hover:bg-muted rounded-xl"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteMutation.mutate(prompt._id)}
                                                        className="h-10 w-10 bg-secondary border border-border text-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-32 text-center">
                                <div className="h-20 w-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-border">
                                    <Bot className="h-10 w-10 text-muted-foreground/20" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground tracking-tight">Logic Processor Offline</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">The agent has no architectural directives. Manifest your first system prompt to enable neural interaction.</p>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(true)}
                                    className="mt-8 rounded-2xl bg-secondary border border-border text-foreground font-bold h-12 px-8 hover:bg-accent transition-all"
                                >
                                    Manifest First Directives
                                </Button>
                            </div>
                        )}

                        {pagination && pagination.totalPages > 1 && (
                            <div className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                    Logic Nodes: Page {page} of {pagination.totalPages}
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white transition-all hover:bg-white/10 p-0"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <div className="h-12 w-12 flex items-center justify-center bg-primary text-white font-black text-xs rounded-2xl">
                                        {page}
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page === pagination.totalPages}
                                        className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white transition-all hover:bg-white/10 p-0"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </div>
            </div>

            <Dialog
                open={!!editingPrompt}
                onOpenChange={(open) => !open && setEditingPrompt(null)}
            >
                <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-[#0a0a0c] text-white">
                    {editingPrompt && (
                        <form onSubmit={handleUpdateSubmit}>
                            <DialogHeader className="p-8 bg-white/[0.02] border-b border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
                                        <Scale className="h-3 w-3 text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Logic Calibration</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest italic">Hash: {editingPrompt._id.slice(-8).toUpperCase()}</span>
                                </div>
                                <DialogTitle className="text-3xl font-black text-white tracking-tighter">Refine Directives</DialogTitle>
                            </DialogHeader>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Architectural ID</Label>
                                        <Input
                                            value={editingPrompt.name}
                                            onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                                            className="h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Live Status</Label>
                                        <div className="flex items-center justify-between h-14 px-6 bg-white/[0.03] border border-white/5 rounded-2xl shadow-inner">
                                            <span className="text-sm font-bold text-white tracking-tight">Active Stream</span>
                                            <Switch
                                                checked={editingPrompt.isActive}
                                                onCheckedChange={(checked) => setEditingPrompt({ ...editingPrompt, isActive: checked })}
                                                className="data-[state=checked]:bg-primary"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Objective Delta</Label>
                                    <Input
                                        value={editingPrompt.description || ''}
                                        onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                                        className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Instruction Payload</Label>
                                    <Textarea
                                        value={editingPrompt.content}
                                        onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                                        required
                                        rows={14}
                                        className="font-mono text-xs bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white py-6 leading-relaxed"
                                    />
                                </div>
                            </div>
                            <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => setEditingPrompt(null)} className="h-14 rounded-2xl border-white/10 bg-transparent text-white px-8 font-bold hover:bg-white/5">Cancel</Button>
                                <Button type="submit" disabled={updateMutation.isPending} className="h-14 bg-white text-black hover:bg-white/90 rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-white/10">
                                    {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Sync logic
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            <div className="h-20" />
        </div >
    );
}
