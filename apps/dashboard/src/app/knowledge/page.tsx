'use client';
import { PageHeader } from '@/components/layout/page-header';
import { WorkspacePanel, WorkspaceSearch, WorkspaceEmpty, WorkspacePagination } from '@/components/layout/workspace-surface';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { knowledgeApi } from '@/lib/api';
import { Knowledge } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

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

    const { data: response, isLoading, isError } = useQuery({
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


    return (
        <div className="space-y-6">
            <PageHeader title="Business Knowledge" description="The answers behind your AI. Keep policies, FAQs, and guides accurate and easy to find."
                actions={<Button onClick={() => setIsDialogOpen(true)}><Plus size={16} className="mr-2" />Add knowledge</Button>} />
            <WorkspacePanel title="Knowledge library" description={`${pagination?.total || 0} entries available to your assistant`}
                actions={<WorkspaceSearch value={searchQuery} onChange={(value) => { setSearchQuery(value); setPage(1); }} placeholder="Search knowledge" />}>
                {isLoading ? <p role="status" className="p-8 text-sm text-muted-foreground">Loading your knowledge…</p>
                : isError ? <WorkspaceEmpty title="Knowledge couldn't load" copy="Please try again when your connection is available." />
                : !knowledgeEntries.length ? <WorkspaceEmpty title={searchQuery ? 'No matching entries' : 'Give your AI a reliable starting point'} copy={searchQuery ? 'Try a different title or keyword.' : 'Add your delivery policy, opening hours, and frequently asked questions.'} />
                : <div className="divide-y divide-border">{knowledgeEntries.map((entry) => (
                    <article key={entry._id} className="flex gap-4 p-5 sm:p-6">
                        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"><BookOpen size={18} /></span>
                        <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="secondary">{entry.type}</Badge><span className="text-xs text-muted-foreground">{entry.language === 'en' ? 'English' : 'Bangla'}</span></div>
                            <h2 className="break-words text-base font-semibold">{entry.title}</h2>
                            <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-muted-foreground">{entry.content}</p>
                            <div className="mt-3 flex flex-wrap gap-2">{Array.from(new Set(entry.tags)).map((tag) => <span key={tag} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">#{tag}</span>)}</div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${entry.title}`} onClick={() => setEditingEntry(entry)}><Pencil size={16} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${entry.title}`} disabled={deleteMutation.isPending} onClick={() => { if (window.confirm('Delete this knowledge entry? This cannot be undone.')) deleteMutation.mutate(entry._id); }}><Trash2 size={16} /></Button>
                        </div>
                    </article>
                ))}</div>}
                {deleteMutation.isError && <p role="alert" className="px-6 py-3 text-sm text-destructive">The entry could not be deleted. Please try again.</p>}
                <WorkspacePagination page={page} totalPages={pagination?.totalPages || 1} total={pagination?.total} onChange={setPage} />
            </WorkspacePanel>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader><DialogTitle>Add knowledge</DialogTitle><DialogDescription>Write a clear, factual answer your assistant can use with customers.</DialogDescription></DialogHeader>
                    <form onSubmit={handleAddEntry} className="space-y-4 sm:space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <label className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium">Type<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newEntry.type} onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value as Knowledge['type'] })}><option value="FAQ">FAQ</option><option value="POLICY">Policy</option><option value="GUIDE">Guide</option></select></label>
                            <label className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium">Language<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newEntry.language} onChange={(e) => setNewEntry({ ...newEntry, language: e.target.value as Knowledge['language'] })}><option value="en">English</option><option value="bn">Bangla</option></select></label>
                        </div>
                        <label className="block space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium"><span>Title or question</span><Input placeholder="What is your return policy?" value={newEntry.title} onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })} required /></label>
                        <label className="block space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium"><span>Answer or content</span><Textarea rows={5} value={newEntry.content} onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })} required /></label>
                        <label className="block space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium"><span>Tags <span className="font-normal text-muted-foreground">(comma separated)</span></span><Input placeholder="returns, warranty" value={newEntry.tags} onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value })} /></label>
                        {createMutation.isError && <p role="alert" className="text-sm text-destructive">Could not save this entry. Please try again.</p>}
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 border-t border-border pt-4"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button type="submit" className="w-full sm:w-auto" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}Save knowledge</Button></div>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader><DialogTitle>Edit knowledge</DialogTitle><DialogDescription>Keep this answer up to date for future customer conversations.</DialogDescription></DialogHeader>
                    {editingEntry && <form onSubmit={handleUpdateEntry} className="space-y-4 sm:space-y-5">
                        <label className="block space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium"><span>Title or question</span><Input value={editingEntry.title} onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })} required /></label>
                        <label className="block space-y-1.5 sm:space-y-2 text-xs sm:text-sm font-medium"><span>Answer or content</span><Textarea rows={6} value={editingEntry.content} onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })} required /></label>
                        {updateMutation.isError && <p role="alert" className="text-sm text-destructive">Could not save your changes. Please try again.</p>}
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 border-t border-border pt-4"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setEditingEntry(null)}>Cancel</Button><Button type="submit" className="w-full sm:w-auto" disabled={updateMutation.isPending}>Save changes</Button></div>
                    </form>}
                </DialogContent>
            </Dialog>
        </div>
    );
}
