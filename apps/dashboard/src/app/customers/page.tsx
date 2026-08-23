'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { customersApi } from '@/lib/api';
import { Customer } from '@/types';
import { useQuery } from '@tanstack/react-query';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
    Loader2,
    Search,
    User,
    MapPin,
    Clock,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    UserPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { CreateCustomerDialog } from '@/components/customers/create-customer-dialog';

export default function CustomersPage() {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const limit = 10;

    const { data: response, isLoading } = useQuery({
        queryKey: ['customers', page, searchQuery],
        queryFn: () => customersApi.getAll({ page, limit, search: searchQuery }),
    });

    const customers = useMemo(() => response?.data || [], [response]);
    const pagination = response?.pagination;

    const columns = useMemo<ColumnDef<Customer>[]>(
        () => [
            {
                accessorKey: 'name',
                header: 'Entity Signature',
                cell: ({ row }) => {
                    const customer = row.original;
                    return (
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg group-hover:scale-110 transition-transform">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-base font-black text-white tracking-tight">
                                    {customer.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60">
                                    ID: {customer.psid?.slice(0, 12).toUpperCase() || 'EXTERNAL-ENVOY'}
                                </span>
                            </div>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'phone',
                header: 'Signal Info',
                cell: ({ row }) => {
                    const customer = row.original;
                    return (
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-white tracking-tighter">
                                {customer.phone || 'N/A'}
                            </span>
                            <span className="text-[10px] text-muted-foreground italic">
                                {customer.email || 'no-signal@endpoint.com'}
                            </span>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'city',
                header: 'Geolocation',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground/40" />
                        </div>
                        <span className="text-xs font-bold text-white tracking-tight">
                            {row.original.city || 'Undisclosed'}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'language',
                header: 'Core Language',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                            {row.original.language || 'en-US'}
                        </Badge>
                    </div>
                ),
            },
            {
                accessorKey: 'updatedAt',
                header: 'Last Activity',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/30" />
                        <span className="text-[10px] text-muted-foreground font-medium">
                            {row.original.updatedAt
                                ? format(new Date(row.original.updatedAt), 'MMM d, yyyy')
                                : 'Unknown'}
                        </span>
                    </div>
                ),
            },
            {
                id: 'actions',
                header: () => <div className="text-right pr-8">Actions</div>,
                cell: () => (
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 bg-white/5 border border-white/10 text-white hover:text-primary hover:bg-white/10 rounded-xl"
                        >
                            <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 bg-white/5 border border-white/10 text-white hover:text-primary hover:bg-white/10 rounded-xl"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                ),
            },
        ],
        []
    );

    const table = useReactTable({
        data: customers,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isLoading)
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="animate-spin text-primary h-12 w-12" />
            </div>
        );

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Customer Matrix"
                description="Manage entity profiles and CRM intelligence derived from AI interactions."
                actions={
                    <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                    >
                        <UserPlus className="h-4 w-4" />
                        Initialize Node
                    </Button>
                }
            />

            <div className="py-8">
                <div className="glass-card rounded-3xl overflow-hidden border-white/5 shadow-premium">
                    <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-white tracking-tight"> Active Entities</h2>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {pagination?.total || 0} unique nodes identified
                                </p>
                            </div>
                            <div className="relative w-full md:w-96 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search name, phone, PSID..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="pl-12 h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white placeholder:text-muted-foreground/50"
                                />
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-0">
                        {customers.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow
                                            key={headerGroup.id}
                                            className="bg-white/[0.02] hover:bg-white/[0.02] border-b border-white/5"
                                        >
                                            {headerGroup.headers.map((header) => (
                                                <TableHead
                                                    key={header.id}
                                                    className="font-bold py-5 pl-8 text-muted-foreground uppercase text-[10px] tracking-widest"
                                                >
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell
                                                    key={cell.id}
                                                    className={cn(
                                                        'py-6',
                                                        cell.column.id === 'name' ? 'pl-8' : ''
                                                    )}
                                                >
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext()
                                                    )}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-32 text-center">
                                <div className="h-20 w-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <User className="h-10 w-10 text-muted-foreground/20" />
                                </div>
                                <h3 className="text-xl font-bold text-white">No entities synchronized</h3>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Initialize commerce signals or connect agents to populate CRM.
                                </p>
                            </div>
                        )}

                        <div className="p-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                Node Cluster: Page {page} of {pagination?.totalPages || 1}
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
                                    onClick={() =>
                                        setPage((p) =>
                                            pagination && page < pagination.totalPages ? p + 1 : p
                                        )
                                    }
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
            <div className="h-20" />

            <CreateCustomerDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            />
        </div>
    );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}
