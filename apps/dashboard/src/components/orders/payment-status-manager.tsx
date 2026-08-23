'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, AlertCircle, DollarSign } from 'lucide-react';
import { Order } from '@/types';
import { cn } from '@/lib/utils';

interface PaymentStatusManagerProps {
    order: Order;
    compact?: boolean;
}

export function PaymentStatusManager({ order, compact = false }: PaymentStatusManagerProps) {
    const queryClient = useQueryClient();
    const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
    const [note, setNote] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const updatePaymentMutation = useMutation({
        mutationFn: ({ status, note }: { status: string; note?: string }) =>
            ordersApi.updatePaymentStatus(order._id, status, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setIsEditing(false);
            setNote('');
        },
    });

    const handleUpdate = () => {
        updatePaymentMutation.mutate({ status: paymentStatus, note });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
                return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-rose-500" />;
            case 'refunded':
                return <AlertCircle className="h-4 w-4 text-amber-500" />;
            default:
                return <DollarSign className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'failed':
                return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            case 'refunded':
                return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            default:
                return 'bg-muted text-muted-foreground border-border';
        }
    };

    if (compact && !isEditing) {
        return (
            <div className="flex items-center gap-2">
                <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border', getStatusColor(order.paymentStatus))}>
                    {getStatusIcon(order.paymentStatus)}
                    {order.paymentStatus}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-8 text-xs"
                >
                    Update
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-6 bg-muted/5 rounded-xl border border-border">
            <div className="flex items-center justify-between">
                <h3 className="font-black text-lg">Payment Status</h3>
                {order.invoiceNumber && (
                    <div className="text-sm text-muted-foreground font-mono">
                        Invoice: {order.invoiceNumber}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Status</Label>
                    <Select value={paymentStatus} onValueChange={(val) => setPaymentStatus(val as 'pending' | 'paid' | 'failed' | 'refunded')}>
                        <SelectTrigger className="h-12 bg-muted/10 border-border rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Note (Optional)</Label>
                    <Input
                        placeholder="Add a note about this payment update..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="h-12 bg-muted/10 border-border rounded-xl"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <Button
                        onClick={handleUpdate}
                        disabled={updatePaymentMutation.isPending || paymentStatus === order.paymentStatus}
                        className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold"
                    >
                        {updatePaymentMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
                        ) : (
                            'Update Payment Status'
                        )}
                    </Button>
                    {isEditing && compact && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsEditing(false);
                                setPaymentStatus(order.paymentStatus);
                                setNote('');
                            }}
                            className="h-12 rounded-xl"
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </div>

            {paymentStatus === 'paid' && !order.invoiceNumber && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <p className="text-sm text-primary font-medium">
                        ✨ Marking as paid will automatically generate an invoice number
                    </p>
                </div>
            )}
        </div>
    );
}
