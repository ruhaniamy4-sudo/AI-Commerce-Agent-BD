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
import { knowledgeApi } from '@/lib/api';
import { Knowledge } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Pencil,
    Plus,
    Search,
    Trash2,
    BrainCircuit,
    Languages,
    Tag,
    Layers,
    Type,
    Save
} from 'lucide-react';
import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function KnowledgeBasePage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [page, setPage] = useState(1);
    const limit = 10;

    const initialEntryState = {
        title: '',
        content: '',
        type: 'FAQ' as Knowledge['type'],
        tags: '',
        language: 'en' as Knowledge['language'],
    };

    const [newEntry, setNewEntry] = useState(initialEntryState);
    const [editingEntry, setEditingEntry] = useState<Knowledge | null>(null);

    const { data: response, isLoading } = useQuery({
        queryKey: ['knowledge', page, searchQuery],
        queryFn: () => knowledgeApi.getAll({ page, limit, search: searchQuery }),
    });

    const knowledgeEntries = response?.data || [];
    const pagination = response?.pagination;

    const createMutation = useMutation({
        mutationFn: (data: typeof newEntry) =>
            knowledgeApi.create({
                ...data,
                tags: data.tags.split(',').map((t) => t.trim()).filter(Boolean),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledge'] });
            setIsDialogOpen(false);
            setNewEntry(initialEntryState);
        },
        onError: (error) => {
            console.error('Failed to add knowledge:', error);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => knowledgeApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledge'] });
        },
        onError: (error) => {
            console.error('Failed to delete knowledge:', error);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; entry: Partial<Knowledge> }) =>
            knowledgeApi.update(data.id, data.entry),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['knowledge'] });
            setEditingEntry(null);
        },
        onError: (error) => {
            console.error('Failed to update knowledge:', error);
        },
    });

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEntry.title || !newEntry.content) return;
        createMutation.mutate(newEntry);
    };

    const handleUpdateEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEntry) return;
        updateMutation.mutate({
            id: editingEntry._id,
            entry: {
                title: editingEntry.title,
                content: editingEntry.content,
                type: editingEntry.type,
                language: editingEntry.language,
                tags: Array.isArray(editingEntry.tags) ? editingEntry.tags : [],
            },
        });
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'FAQ': return "bg-sky-500/10 text-sky-400 border-sky-500/20";
            case 'POLICY': return "bg-rose-500/10 text-rose-400 border-rose-500/20";
            case 'GUIDE': return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            default: return "bg-muted text-muted-foreground border-border";
        }
    };

    if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Cognitive Core"
                description="Refine the AI's neural knowledge base with high-precision artifacts and semantics."
                actions={
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 py-6 shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 text-sm font-bold">
                                <Plus className="h-5 w-5" /> Ingest New Artifact
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl p-0 overflow-hidden border-border shadow-2xl rounded-3xl bg-background text-foreground">
                            <form onSubmit={handleAddEntry}>
                                <DialogHeader className="p-8 bg-muted/10 border-b border-border">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
                                            <BrainCircuit className="h-3 w-3 text-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Manifest</span>
                                        </div>
                                    </div>
                                    <DialogTitle className="text-3xl font-black text-foreground tracking-tighter">Manifest Artifact</DialogTitle>
                                    <DialogDescription className="text-muted-foreground font-medium mt-1">
                                        Define new parameters for the AI&apos;s Retrieval Augmented Generation engine.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Classification</Label>
                                            <Select
                                                value={newEntry.type}
                                                onValueChange={(v: string) => setNewEntry({ ...newEntry, type: v as Knowledge['type'] })}
                                            >
                                                <SelectTrigger className="h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-popover border-border text-foreground">
                                                    <SelectItem value="FAQ">Neural FAQ</SelectItem>
                                                    <SelectItem value="POLICY">Operational Policy</SelectItem>
                                                    <SelectItem value="GUIDE">Strategic Guide</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Linguistic Vector</Label>
                                            <Select
                                                value={newEntry.language}
                                                onValueChange={(v: string) => setNewEntry({ ...newEntry, language: v as Knowledge['language'] })}
                                            >
                                                <SelectTrigger className="h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-popover border-border text-foreground">
                                                    <SelectItem value="en">Global (English)</SelectItem>
                                                    <SelectItem value="bn">Regional (Bangla)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Artifact Query / Title</Label>
                                        <div className="relative group">
                                            <Type className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="e.g. Return Policy"
                                                value={newEntry.title}
                                                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                                                className="pl-12 h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/30"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Payload / Content</Label>
                                        <Textarea
                                            placeholder="Detailed content for neural indexing..."
                                            value={newEntry.content}
                                            onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                                            className="min-h-[160px] bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/30 py-4"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Semantic Clusters (Tags)</Label>
                                        <div className="relative group">
                                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="returns, warranty, general"
                                                value={newEntry.tags}
                                                onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })}
                                                className="pl-12 h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/15 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/30"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-8 bg-muted/30 border-t border-border flex justify-end gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsDialogOpen(false)}
                                        className="h-14 rounded-2xl border-border bg-transparent text-foreground px-8 font-bold hover:bg-accent"
                                    >
                                        Cancel
                                    </Button>
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
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Encoded Artifacts</h2>
                                <p className="text-sm text-muted-foreground font-medium">{pagination?.total || 0} semantic nodes indexed</p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search semantics or title..."
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
                        {knowledgeEntries.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border">
                                        <TableHead className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest">Classification</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Descriptor</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Payload Snippet</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Semantic Tags</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {knowledgeEntries.map((entry) => (
                                        <TableRow key={entry._id} className="group border-b border-border/10 hover:bg-muted/5 transition-colors">
                                            <TableCell className="py-6 pl-8">
                                                <div className={cn(
                                                    "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                    getTypeColor(entry.type)
                                                )}>
                                                    {entry.type}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-foreground tracking-tight max-w-[200px] truncate">{entry.title}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase tracking-widest opacity-60 flex items-center gap-1.5 line-clamp-1">
                                                        <Languages className="h-3 w-3" /> {entry.language === 'en' ? 'Global.EN' : 'Regional.BN'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6">
                                                <div className="max-w-md text-[11px] text-muted-foreground/70 leading-relaxed italic line-clamp-2">
                                                    &quot;{entry.content}&quot;
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-sm">
                                                <div className="flex gap-2 flex-wrap min-w-[120px]">
                                                    {entry.tags.slice(0, 3).map((t) => (
                                                        <Badge key={t} className="bg-muted text-[9px] text-muted-foreground hover:bg-muted/80 transition-colors border-border rounded-lg px-2 py-0.5">
                                                            #{t}
                                                        </Badge>
                                                    ))}
                                                    {entry.tags.length > 3 && (
                                                        <span className="text-[9px] text-muted-foreground/40 font-black">+{entry.tags.length - 3}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-6 text-right pr-8">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setEditingEntry(entry)}
                                                        className="h-10 w-10 bg-white/5 border border-white/10 text-white hover:text-primary hover:bg-white/10 rounded-xl"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteMutation.mutate(entry._id)}
                                                        className="h-10 w-10 bg-white/5 border border-white/10 text-white hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-32 text-center">
                                <div className="h-20 w-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">No neural artifacts detected</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">Populate the AI&apos;s cognitive core with FAQs, policies, and strategic guides to enable RAG.</p>
                            </div>
                        )}

                        <div className="p-8 border-t border-border bg-muted/5 flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                Node Archive: Page {page} of {pagination?.totalPages || 1}
                            </div>
                            <div className="flex gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={!pagination || page === 1}
                                    className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10 p-0"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setPage((p) => pagination && page < pagination.totalPages ? p + 1 : p)}
                                    disabled={!pagination || page >= pagination.totalPages}
                                    className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-white disabled:opacity-20 transition-all hover:bg-white/10 p-0"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </div>
            </div>

            <Dialog open={!!editingEntry} onOpenChange={(o) => !o && setEditingEntry(null)}>
                <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-[#0a0a0c] text-white">
                    {editingEntry && (
                        <form onSubmit={handleUpdateEntry}>
                            <DialogHeader className="p-8 bg-white/[0.02] border-b border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
                                        <Layers className="h-3 w-3 text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Update Layer</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest italic">Node: {editingEntry._id.slice(-6)}</span>
                                </div>
                                <DialogTitle className="text-3xl font-black text-white tracking-tighter">Refine Artifact</DialogTitle>
                            </DialogHeader>
                            <div className="p-8 space-y-6">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Title / Question</Label>
                                    <Input
                                        value={editingEntry.title}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                                        className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Neural Payload</Label>
                                    <Textarea
                                        rows={8}
                                        value={editingEntry.content}
                                        onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
                                        className="bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white py-4"
                                    />
                                </div>
                            </div>
                            <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => setEditingEntry(null)} className="h-14 rounded-2xl border-white/10 bg-transparent text-white px-8 font-bold hover:bg-white/5">Cancel</Button>
                                <Button type="submit" disabled={updateMutation.isPending} className="h-14 bg-white text-black hover:bg-white/90 rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-white/10">
                                    {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Sync changes
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            <div className="h-20" />
        </div>
    );
}
