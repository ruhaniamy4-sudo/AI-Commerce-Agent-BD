'use client';

import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    CardContent,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
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
import { categoriesApi } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { Category } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Loader2,
    Plus,
    Search,
    Trash2,
    Edit,
    Layers,
    ChevronRight,
    Target
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import React from 'react';

export default function CategoriesPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog States
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const { data: categories, isLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: () => categoriesApi.getAll(),
    });

    const filteredCategories = categories?.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // Mutations
    const deleteMutation = useMutation({
        mutationFn: (id: string) => categoriesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
        onError: (error: ApiError) => {
            const errorData = error.response as Record<string, unknown>;
            alert(String(errorData?.error || 'Failed to delete category'));
        }
    });

    const [formData, setFormData] = useState<Partial<Category>>({
        name: '',
        slug: '',
        description: '',
        parentId: null,
        isActive: true,
        order: 0
    });

    const resetForm = () => {
        setEditingCategory(null);
        setFormData({
            name: '',
            slug: '',
            description: '',
            parentId: null,
            isActive: true,
            order: 0
        });
    };

    const createMutation = useMutation({
        mutationFn: (data: Partial<Category>) => categoriesApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setIsDialogOpen(false);
            resetForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; update: Partial<Category> }) => categoriesApi.update(data.id, data.update),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setIsDialogOpen(false);
            resetForm();
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalData = {
            ...formData,
            slug: formData.slug || formData.name?.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
        };

        if (editingCategory) {
            updateMutation.mutate({ id: editingCategory._id, update: finalData });
        } else {
            createMutation.mutate(finalData);
        }
    };

    const openEdit = (category: Category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            slug: category.slug,
            description: category.description,
            parentId: category.parentId,
            isActive: category.isActive,
            order: category.order
        });
        setIsDialogOpen(true);
    };

    if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    // Build hierarchy for display
    const topLevel = filteredCategories.filter(c => !c.parentId);

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Taxonomy Engine"
                description="Organize your premium assets for maximum discoverability & AI intelligence."
                actions={
                    <Button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 bg-primary hover:bg-violet-600 text-white rounded-xl px-6 py-6 shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 text-sm font-bold">
                        <Plus className="h-5 w-5" /> Add Strategic Category
                    </Button>
                }
            />

            <div className="py-8">
                <div className="glass-card rounded-3xl overflow-hidden border-border shadow-premium">
                    <div className="p-8 border-b border-border bg-muted/5">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-foreground tracking-tight">Taxonomy Matrix</h2>
                                <p className="text-sm text-muted-foreground font-medium">{filteredCategories.length} classifications architectural</p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search classifications..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-12 h-14 bg-muted/10 border-border rounded-2xl focus:bg-muted/20 transition-all shadow-inner text-foreground placeholder:text-muted-foreground/50"
                                />
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        {topLevel.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border">
                                        <TableHead className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest">Classification Identity</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Slug (Alias)</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Network</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Status</TableHead>
                                        <TableHead className="font-bold py-5 text-muted-foreground uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topLevel.map((cat) => {
                                        const children = filteredCategories.filter(c => c.parentId === cat._id);
                                        return (
                                            <React.Fragment key={cat._id}>
                                                <TableRow className="group border-b border-border hover:bg-muted/10 transition-colors bg-muted/5">
                                                    <TableCell className="py-6 pl-8">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-lg group-hover:scale-110 transition-transform">
                                                                <Layers className="h-6 w-6" />
                                                            </div>
                                                            <span className="font-black text-foreground text-base tracking-tight">{cat.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <code className="text-[10px] bg-muted px-3 py-1 rounded-lg text-muted-foreground border border-border font-mono uppercase truncate">{cat.slug}</code>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1 w-12 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (children.length / 5) * 100)}%` }} />
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{children.length} Nodes</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <div className={cn(
                                                            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                            cat.isActive
                                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                                : "bg-muted text-muted-foreground border-border"
                                                        )}>
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", cat.isActive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground")} />
                                                            {cat.isActive ? 'Architectural' : 'Latent'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-6 text-right pr-8">
                                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                            <Button variant="ghost" size="icon" onClick={() => openEdit(cat)} className="h-10 w-10 bg-secondary/50 border border-border text-foreground hover:text-primary hover:bg-secondary rounded-xl transition-all">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 bg-secondary/50 border border-border text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" onClick={() => {
                                                                if (confirm('Permanently deconstruct this classification?')) deleteMutation.mutate(cat._id);
                                                            }}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {children.map(child => (
                                                    <TableRow key={child._id} className="group border-b border-white/[0.01] hover:bg-white/[0.03] transition-colors bg-white/[0.005]">
                                                        <TableCell className="py-4 pl-16">
                                                            <div className="flex items-center gap-4">
                                                                <ChevronRight className="h-4 w-4 text-primary/40 group-hover:translate-x-1 transition-transform" />
                                                                <span className="font-bold text-muted-foreground group-hover:text-foreground transition-colors">{child.name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <code className="text-[10px] text-muted-foreground/40 font-mono italic">{child.slug}</code>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <span className="text-[9px] text-muted-foreground/30 font-black uppercase tracking-[0.2em] border-l border-border pl-3">Sub-Processor</span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <Badge variant="outline" className={cn(
                                                                "border-none bg-transparent text-[9px] font-black uppercase tracking-widest p-0 flex items-center gap-2",
                                                                child.isActive ? "text-emerald-500/60" : "text-muted-foreground/30"
                                                            )}>
                                                                {child.isActive ? 'Synchronized' : 'Offline'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-4 text-right pr-8">
                                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                <Button variant="ghost" size="icon" onClick={() => openEdit(child)} className="h-8 w-8 text-muted-foreground/40 hover:text-primary transition-colors">
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/20 hover:text-rose-400 transition-colors" onClick={() => {
                                                                    if (confirm('Deconstruct sub-processor?')) deleteMutation.mutate(child._id);
                                                                }}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-32 text-center space-y-6">
                                <div className="h-24 w-24 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-8 border border-border shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Layers className="h-12 w-12 text-muted-foreground relative z-10" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-foreground">Taxonomy nullified</h3>
                                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">Establish structural classifications to enable high-fidelity catalog organization.</p>
                                </div>
                                <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="rounded-2xl border-border bg-secondary/50 text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all px-8 h-12">
                                    <Plus className="h-5 w-5 mr-2" /> Initialize taxonomy
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
                <DialogContent className="max-w-xl p-0 overflow-hidden border-border shadow-2xl rounded-3xl bg-background text-foreground">
                    <form onSubmit={handleSubmit} className="flex flex-col">
                        <DialogHeader className="p-8 bg-muted/10 border-b border-border">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-3xl font-black text-foreground tracking-tight">
                                        {editingCategory ? 'Refine Taxonomy' : 'Manifest Category'}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground font-medium mt-1">
                                        Define classification nodes for intelligent architectural organization.
                                    </DialogDescription>
                                </div>
                                <div className="hidden sm:flex bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                                    <Target className="h-4 w-4 text-primary" />
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Classification Name</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="h-14 bg-muted/5 border-border focus:bg-muted/10 rounded-2xl shadow-inner transition-all text-foreground placeholder:text-muted-foreground/30 px-6 font-medium"
                                        placeholder="e.g. Next-Gen Wearables"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Alias (Slug)</Label>
                                    <Input
                                        value={formData.slug}
                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                        className="h-14 bg-muted/5 border-border focus:bg-muted/10 rounded-2xl shadow-inner transition-all text-foreground placeholder:text-muted-foreground/30 px-6 font-mono"
                                        placeholder="wearables"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Architectural Parent</Label>
                                <select
                                    className="w-full h-14 bg-muted/5 border border-border rounded-2xl px-6 text-sm text-foreground outline-none focus:bg-muted/10 transition-all appearance-none cursor-pointer"
                                    value={formData.parentId || ''}
                                    onChange={e => setFormData({ ...formData, parentId: e.target.value || null })}
                                >
                                    <option value="" className="bg-background">Root Architectural Layer</option>
                                    {topLevel.filter(c => c._id !== editingCategory?._id).map(c => (
                                        <option key={c._id} value={c._id} className="bg-background">{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Semantic Context (AI Intelligence)</Label>
                                <Textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="h-32 bg-muted/5 border-border focus:bg-muted/10 rounded-2xl shadow-inner p-6 transition-all resize-none text-foreground placeholder:text-muted-foreground/30 leading-relaxed"
                                    placeholder="Provide detailed context for the AI agent to understand when to recommend this category..."
                                />
                            </div>

                            <div className="flex items-center justify-between p-6 bg-white/[0.02] rounded-2xl border border-white/5 group hover:bg-white/[0.04] transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-white tracking-tight">Architectural Priority</p>
                                    <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">Determine sequencing in public interfaces</p>
                                </div>
                                <Input
                                    type="number"
                                    className="w-24 h-11 bg-muted/10 border-border rounded-xl text-center font-black text-primary text-lg"
                                    value={formData.order}
                                    onChange={e => setFormData({ ...formData, order: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-muted/30 border-t border-border flex justify-between items-center">
                            <Button type="button" variant="ghost" onClick={resetForm} className="text-muted-foreground/30 hover:text-foreground font-black uppercase text-[10px] tracking-[0.2em] transition-colors">Abort</Button>
                            <div className="flex gap-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="h-14 rounded-2xl border-border bg-transparent text-foreground px-8 font-bold hover:bg-accent">Cancel</Button>
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="h-14 bg-primary text-primary-foreground rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        editingCategory ? 'Update Layer' : 'Manifest Node'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
