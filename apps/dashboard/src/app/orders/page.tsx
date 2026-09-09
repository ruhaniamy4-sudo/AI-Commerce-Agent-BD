'use client';

import {WorkspacePanel,WorkspaceEmpty,WorkspacePagination} from '@/components/layout/workspace-surface';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { courierIntegrationsApi, ordersApi } from '@/lib/api';
import { Order, Customer, OrderItem } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Loader2,
    Calendar,
    User,
    ShieldCheck,
    Plus,
    RefreshCw,
    Truck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';
import { OrderAnalytics } from '@/components/orders/order-analytics';

interface PopulatedOrder extends Omit<Order, 'customerId'> {
    customerId: Customer;
}

export default function OrdersPage() {
    const queryClient = useQueryClient();
    const [page,setPage] = useState(1);
    const limit = 10;
    const [selectedOrder, setSelectedOrder] = useState<PopulatedOrder | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const { data: response, isLoading } = useQuery({
        queryKey: ['orders', page],
        queryFn: async () => {
            const res = await ordersApi.getAll({ page, limit });
            return res as unknown as { data: PopulatedOrder[]; pagination: { total: number } };
        },
    });

    const { data: courierIntegration } = useQuery({
        queryKey: ['courier-integration', 'steadfast'],
        queryFn: courierIntegrationsApi.getSteadfast,
    });

    const orders = useMemo(() => response?.data || [], [response]);
    const pagination = response?.pagination;

    const statusMutation = useMutation({
        mutationFn: (data: { id: string; status: string }) =>
            ordersApi.updateStatus(data.id, data.status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setSelectedOrder(null);
        },
    });

    const updateCourierState = (result: Awaited<ReturnType<typeof ordersApi.createCourier>>) => {
        setSelectedOrder((current) => current ? {
            ...current,
            courier: result.courier,
            status: result.orderStatus || current.status,
        } : current);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
    };
    const createCourierMutation = useMutation({
        mutationFn: (id: string) => ordersApi.createCourier(id),
        onSuccess: updateCourierState,
    });
    const syncCourierMutation = useMutation({
        mutationFn: (id: string) => ordersApi.syncCourier(id),
        onSuccess: updateCourierState,
    });

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'confirmed':
                return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            case 'shipped':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'delivered':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'cancelled':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            default:
                return 'bg-muted text-muted-foreground border-border';
        }
    };

return (<div><PageHeader title="Orders" description="From confirmation to fulfillment. Keep every order moving with clear status and customer context." actions={<Button onClick={()=>setIsCreateDialogOpen(true)}><Plus size={15} className="mr-2"/>Create order</Button>}/><div className="mb-6"><OrderAnalytics/></div><WorkspacePanel title="Order register" description={`${pagination?.total||0} orders recorded`}>{isLoading?<p role="status" className="p-12 text-center text-muted-foreground text-sm">Loading orders…</p>:orders.length?<div className="work-table-scroll"><table className="work-table"><thead><tr>{["Order","Customer","Total","Status",""].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{orders.map(order=><tr key={order._id}><td><button className="font-semibold hover:text-primary" onClick={()=>setSelectedOrder(order)}>#{order._id.slice(-8).toUpperCase()}</button><small>{format(new Date(order.createdAt),"MMM d, HH:mm")}</small></td><td>{order.customerId?.name||"Unknown customer"}<small>{order.customerId?.phone||"No phone number"}</small></td><td>৳{order.total.toLocaleString()}</td><td><span className={`work-status ${getStatusStyles(order.status)}`}>{order.status}</span></td><td><Button size="sm" variant="outline" onClick={()=>setSelectedOrder(order)}>View order</Button></td></tr>)}</tbody></table></div>:<WorkspaceEmpty title="No orders to show yet." copy="Create an order or let customers complete checkout. Confirmed orders will appear here."/>}<WorkspacePagination page={page} totalPages={Math.max(1,Math.ceil((pagination?.total||0)/limit))} onChange={setPage}/></WorkspacePanel>            <Dialog
                open={!!selectedOrder}
                onOpenChange={(o) => !o && setSelectedOrder(null)}
            >
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-border shadow-2xl rounded-xl bg-background text-foreground">
                    {selectedOrder && (
                        <div className="flex flex-col">
                            <DialogHeader className="p-4 sm:p-6 bg-muted/10 border-b border-border">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6" >
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
                                                <ShieldCheck className="h-3 w-3 text-primary" />
                                                <span className="text-[10px] font-semibold tracking-normal text-primary">
                                                    Verified Transaction
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono tracking-normal italic" >
                                                Order ID: {selectedOrder._id}
                                            </span>
                                        </div>
                                        <DialogTitle className="text-xl sm:text-2xl font-semibold text-foreground tracking-tighter" >
                                            Order #{selectedOrder._id.slice(-8).toUpperCase()}
                                        </DialogTitle>
                                        <DialogDescription className="text-muted-foreground font-medium mt-2 flex items-center gap-4" >
                                            <span className="flex items-center gap-1.5 text-xs sm:text-sm" >
                                                <Calendar className="h-4 w-4 opacity-40" />{' '}
                                                {format(new Date(selectedOrder.createdAt), 'MMMM d, yyyy • HH:mm')}
                                            </span>
                                        </DialogDescription>
                                    </div>
                                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 flex-wrap" >
                                        <div
                                            className={cn(
                                                'px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border text-xs font-semibold uppercase tracking-[0.2em]',
                                                getStatusStyles(selectedOrder.status)
                                            )}
                                        >
                                            {selectedOrder.status}
                                        </div>
                                        <Select
                                            defaultValue={selectedOrder.status}
                                            onValueChange={(val) =>
                                                statusMutation.mutate({ id: selectedOrder._id, status: val })
                                            }
                                        >
                                            <SelectTrigger className="h-10 w-36 sm:w-44 bg-muted/10 border-border rounded-xl focus:ring-0 text-[10px] font-semibold tracking-normal" >
                                                <SelectValue placeholder="Update status" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-popover border-border text-foreground" >
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                                <SelectItem value="shipped">Shipped</SelectItem>
                                                <SelectItem value="delivered">Delivered</SelectItem>
                                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 max-h-[60vh] overflow-y-auto scrollbar-hide" >
                                <div className="lg:col-span-2 space-y-8" >
                                    <div className="space-y-4" >
                                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                                            Manifest Items
                                        </h4>
                                        <div className="rounded-2xl border border-border overflow-hidden" >
                                            <Table>
                                                <TableHeader className="bg-muted/5" >
                                                    <TableRow className="border-b border-border hover:bg-transparent" >
                                                        <TableHead className="text-[9px] tracking-normal text-muted-foreground/40 font-semibold h-10" >
                                                            Asset
                                                        </TableHead>
                                                        <TableHead className="text-[9px] tracking-normal text-muted-foreground/40 font-semibold h-10 text-center" >
                                                            Qty
                                                        </TableHead>
                                                        <TableHead className="text-[9px] tracking-normal text-muted-foreground/40 font-semibold h-10 text-right" >
                                                            Total
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOrder.items.map((item: OrderItem, i: number) => (
                                                        <TableRow
                                                            key={i}
                                                            className="border-b border-border/10 hover:bg-muted/5 transition-colors"
                                                        >
                                                            <TableCell className="py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-foreground leading-tight">
                                                                        {item.productName}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-foreground font-mono mt-1 opacity-40 italic">
                                                                        {item.sku || 'SKU-GEN-001'}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-4 text-center font-semibold text-xs text-primary">
                                                                {item.quantity}x
                                                            </TableCell>
                                                            <TableCell className="py-4 text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-sm font-semibold text-foreground">
                                                                        ৳
                                                                        {(
                                                                            item.unitPriceSnapshot * item.quantity
                                                                        ).toLocaleString()}
                                                                    </span>
                                                                    <span className="text-[9px] text-muted-foreground/40" >
                                                                        ৳{item.unitPriceSnapshot.toLocaleString()} ea
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8" >
                                    <div className="space-y-4" >
                                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                                            Entity Intel
                                        </h4>
                                        <div className="p-6 rounded-2xl bg-muted/5 border border-border space-y-4" >
                                            <div className="flex items-center gap-4" >
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20" >
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex flex-col" >
                                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-tighter" >
                                                        Requestor
                                                    </span>
                                                    <span className="text-sm font-bold text-foreground" >
                                                        {selectedOrder.customerId?.name}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4" >
                                                <div className="h-10 w-10 rounded-full bg-muted/10 flex items-center justify-center border border-border" >
                                                    <Calendar className="h-5 w-5 text-muted-foreground/40" />
                                                </div>
                                                <div className="flex flex-col" >
                                                    <span className="text-xs text-muted-foreground font-semibold uppercase tracking-tighter" >
                                                        Order recorded
                                                    </span>
                                                    <span className="text-sm font-bold text-foreground" >
                                                        {format(new Date(selectedOrder.createdAt), 'MMM d, HH:mm')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4" >
                                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                                            Deployment Vector
                                        </h4>
                                        <div className="p-6 rounded-2xl bg-muted/5 border border-border space-y-3" >
                                            <div className="text-[11px] text-muted-foreground font-medium leading-relaxed italic opacity-60" >
                                                {JSON.stringify(selectedOrder.shippingAddress, null, 2)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                                            Courier
                                        </h4>
                                        <div className="space-y-4 rounded-2xl border border-border bg-muted/5 p-6">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3"><Truck className="h-5 w-5 text-primary" /><div><p className="text-sm font-bold text-foreground">Steadfast</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{selectedOrder.courier?.status?.replace('_', ' ') || 'Not created'}</p></div></div>
                                                {selectedOrder.courier?.creationStatus && <span className="rounded-full border border-border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{selectedOrder.courier.creationStatus}</span>}
                                            </div>
                                            {selectedOrder.courier?.consignmentId && <div className="grid gap-2 text-xs text-muted-foreground"><p><span className="font-semibold text-foreground">Consignment:</span> {selectedOrder.courier.consignmentId}</p>{selectedOrder.courier.trackingCode && <p><span className="font-semibold text-foreground">Tracking:</span> {selectedOrder.courier.trackingCode}</p>}{selectedOrder.courier.lastSyncedAt && <p><span className="font-semibold text-foreground">Last synced:</span> {format(new Date(selectedOrder.courier.lastSyncedAt), 'MMM d, HH:mm')}</p>}</div>}
                                            {!courierIntegration?.connected && <p className="text-xs leading-5 text-amber-500">Configure Steadfast in Integrations before creating a delivery.</p>}
                                            {selectedOrder.status === 'pending' && <p className="text-xs leading-5 text-muted-foreground">Approve this order before creating a delivery.</p>}
                                            {(createCourierMutation.error || syncCourierMutation.error) && <p className="text-xs leading-5 text-rose-500">{(createCourierMutation.error || syncCourierMutation.error)?.message}</p>}
                                            <div className="flex flex-wrap gap-2">
                                                {(!selectedOrder.courier || selectedOrder.courier.creationStatus === 'failed') && ['confirmed', 'packed'].includes(selectedOrder.status) && <Button size="sm" onClick={() => createCourierMutation.mutate(selectedOrder._id)} disabled={!courierIntegration?.connected || createCourierMutation.isPending}>{createCourierMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}Create Delivery</Button>}
                                                {selectedOrder.courier?.externalId && ['created', 'uncertain'].includes(selectedOrder.courier.creationStatus) && <Button size="sm" variant="outline" onClick={() => syncCourierMutation.mutate(selectedOrder._id)} disabled={!courierIntegration?.connected || syncCourierMutation.isPending}>{syncCourierMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sync Status</Button>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-auto">
                                        <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col gap-1 items-center justify-center" >
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-primary/60" >
                                                Total Aggregate
                                            </span>
                                            <span className="text-2xl font-semibold text-foreground tracking-tighter" >
                                                ৳{selectedOrder.total.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 bg-black/40 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4" >
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedOrder(null)}
                                    className="h-11 rounded-2xl border-white/10 bg-transparent text-white px-6 sm:px-8 font-bold hover:bg-white/5 w-full sm:w-auto"
                                >
                                    Close Terminal
                                </Button>
                                <Button disabled title="Invoice generation is not available" className="h-11 bg-white text-black hover:bg-white/90 rounded-2xl px-6 sm:px-12 font-semibold tracking-normal shadow-xl shadow-white/10 w-full sm:w-auto" >
                                    Invoice unavailable
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create Order Dialog */}

            <CreateOrderDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            />


        </div>
    );
}
