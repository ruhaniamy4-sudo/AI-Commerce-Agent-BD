'use client';

import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Package, CreditCard, Truck, DollarSign } from 'lucide-react';
import { useState } from 'react';

export function OrderAnalytics() {
    const [dateRange, setDateRange] = useState('30d');

    const { data: analytics, isLoading } = useQuery({
        queryKey: ['order-analytics', dateRange],
        queryFn: () => ordersApi.getAnalytics(dateRange),
    });

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="h-32 bg-muted/10 rounded-2xl" />
            </div>
        );
    }

    const formatRevenue = (amount: number) => {
        return `৳${amount.toLocaleString()}`;
    };

    const getDateRangeLabel = (range: string) => {
        switch (range) {
            case '7d': return 'Last 7 Days';
            case '30d': return 'Last 30 Days';
            case '90d': return 'Last 90 Days';
            case 'year': return 'Last Year';
            default: return 'Last 30 Days';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-foreground tracking-tight">Order Analytics</h2>
                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-48 h-12 bg-muted/10 border-border rounded-xl">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                        <SelectItem value="year">Last Year</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Revenue Card */}
            <div className="glass-card p-8 rounded-3xl border-border">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                <DollarSign className="h-5 w-5 text-emerald-500" />
                            </div>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Revenue</p>
                        </div>
                        <p className="text-5xl font-black text-foreground mt-2">
                            {formatRevenue(analytics?.revenue.total || 0)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">{getDateRangeLabel(dateRange)}</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-500">Paid Orders</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Orders by Status */}
                <Card className="p-6 glass-card border-border rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Package className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-black text-foreground">By Status</h3>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(analytics?.ordersByStatus || {}).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground capitalize">{status}</span>
                                <span className="font-black text-foreground">{count}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Payment Status */}
                <Card className="p-6 glass-card border-border rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <CreditCard className="h-5 w-5 text-emerald-500" />
                        </div>
                        <h3 className="font-black text-foreground">By Payment</h3>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(analytics?.ordersByPaymentStatus || {}).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground capitalize">{status}</span>
                                <span className="font-black text-foreground">{count}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Shipping Method */}
                <Card className="p-6 glass-card border-border rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-violet-500/10 rounded-xl">
                            <Truck className="h-5 w-5 text-violet-500" />
                        </div>
                        <h3 className="font-black text-foreground">By Shipping</h3>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(analytics?.ordersByShippingMethod || {}).map(([method, count]) => (
                            <div key={method} className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground capitalize">{method}</span>
                                <span className="font-black text-foreground">{count}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
