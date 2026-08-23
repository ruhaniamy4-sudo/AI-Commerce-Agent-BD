'use client';

import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

import { analyticsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp, Users, ShoppingCart, BrainCircuit, Target, Loader2, Globe, ArrowUpRight } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Area,
    AreaChart,
    Legend
} from 'recharts';

import { type AnalyticsResponse } from '@/types';

type AnalyticsData = AnalyticsResponse;

interface KPICardProps {
    title: string;
    value: string | number;
    description: string;
    icon: React.ElementType;
    trend: string;
    color: 'violet' | 'blue' | 'emerald' | 'rose';
}

export default function AnalyticsPage() {
    const { data, isLoading, error } = useQuery<AnalyticsData>({
        queryKey: ['analytics'],
        queryFn: analyticsApi.get,
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    if (error) {
        return (
            <div className="px-6 py-20 text-center">
                <div className="glass-card border-rose-500/20 bg-rose-500/5 max-w-md mx-auto p-12 rounded-3xl backdrop-blur-3xl shadow-2xl">
                    <div className="h-16 w-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                        <Target className="h-8 w-8 text-rose-400" />
                    </div>
                    <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">Signal Interrupted</h2>
                    <p className="text-muted-foreground/60 font-medium">Failed to synchronize with the neural insights repository. Verify network protocols.</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { kpi, funnel = [], institutes = [], executives = [], growth = [] } = data;
    const COLORS = ['#8b5cf6', '#6366f1', '#10b981', '#f43f5e', '#f59e0b'];

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Neural Insights"
                description="High-fidelity cognitive telemetry across all institutional transaction vectors."
            />

            <div className="py-8 space-y-12 pb-24">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <KPICard
                        title="Aggregated Revenue"
                        value={`$${((kpi.totalOrders || 0) * 125).toLocaleString()}`}
                        description="Projected institutional yield"
                        icon={TrendingUp}
                        trend="+18.2%"
                        color="violet"
                    />
                    <KPICard
                        title="Active Payloads"
                        value={kpi.totalOrders || 0}
                        description="Synchronous transaction flow"
                        icon={ShoppingCart}
                        trend="+12 today"
                        color="blue"
                    />
                    <KPICard
                        title="Neural Efficiency"
                        value={kpi.pendingOrders || 0}
                        description="Interrogation to conversion ratio"
                        icon={BrainCircuit}
                        trend="Pending Orders"
                        color="emerald"
                    />
                    <KPICard
                        title="Unique Nodes"
                        value={(kpi.totalCustomers || 0).toLocaleString()}
                        description="Aggregated user database"
                        icon={Users}
                        trend="+42 this cycle"
                        color="rose"
                    />
                </div>

                {/* Main Stats Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 glass-card rounded-[2.5rem] overflow-hidden bg-card/10 border-border shadow-premium">
                        <div className="p-10 border-b border-border bg-muted/5 flex flex-row items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-foreground tracking-tighter mb-1 uppercase tracking-widest">Revenue Trajectory</h3>
                                <p className="text-sm text-muted-foreground/60 font-medium">Temporal mapping of institutional capital logs</p>
                            </div>
                            <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                                <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Telemetry</span>
                            </div>
                        </div>
                        <div className="p-10 h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={growth}>
                                    <defs>
                                        <linearGradient id="colorTrajectory" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 800 }}
                                        tickMargin={20}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 800 }}
                                        tickMargin={20}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(139, 92, 246, 0.2)', strokeWidth: 2 }} />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#8b5cf6"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorTrajectory)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass-card rounded-[2.5rem] overflow-hidden bg-card/10 border-border shadow-premium">
                        <div className="p-10 border-b border-border bg-muted/5">
                            <h3 className="text-2xl font-black text-foreground tracking-tighter mb-1 uppercase tracking-widest">Signal Funnel</h3>
                            <p className="text-sm text-muted-foreground/60 font-medium">Conversion distribution across sectors</p>
                        </div>
                        <div className="p-10 h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnel} layout="vertical" margin={{ left: -20 }}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="stage"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 900, fill: 'hsl(var(--muted-foreground))' }}
                                        tickFormatter={(val) => val.replace('_', ' ').toUpperCase()}
                                        width={80}
                                    />
                                    <Tooltip cursor={{ fill: 'hsl(var(--primary))', fillOpacity: 0.05 }} content={<CustomTooltip />} />
                                    <Bar dataKey="count" radius={[0, 12, 12, 0]} barSize={32}>
                                        {(funnel || []).map((_entry: Record<string, unknown>, index: number) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={index === funnel.length - 1 ? '#8b5cf6' : '#6366f1'}
                                                fillOpacity={1 - (index * 0.15)}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Secondary stats row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="glass-card rounded-[2.5rem] overflow-hidden bg-card/10 border-border shadow-premium">
                        <div className="p-10 border-b border-border bg-muted/5">
                            <h3 className="text-2xl font-black text-foreground tracking-tighter mb-1 uppercase tracking-widest">Sector Dominance</h3>
                            <p className="text-sm text-muted-foreground/60 font-medium">Yield distribution by product classification</p>
                        </div>
                        <div className="p-10 h-[400px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={institutes}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius="65%"
                                        outerRadius="85%"
                                        paddingAngle={10}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {(institutes || []).map((_entry: Record<string, unknown>, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        iconType="circle"
                                        content={(props) => <CustomLegend {...props} />}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass-card rounded-[2.5rem] overflow-hidden bg-card/10 border-border shadow-premium">
                        <div className="p-10 border-b border-border bg-muted/5 flex flex-row items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-foreground tracking-tighter mb-1 uppercase tracking-widest">Agent Validation</h3>
                                <p className="text-sm text-muted-foreground/60 font-medium">Performance metrics of autonomous sales agents</p>
                            </div>
                            <Globe className="h-6 w-6 text-primary opacity-20" />
                        </div>
                        <div className="p-10 h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={executives} barGap={12}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }}
                                        tickMargin={12}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: 800, fill: 'hsl(var(--muted-foreground))' }}
                                    />
                                    <Tooltip cursor={{ fill: 'hsl(var(--primary))', fillOpacity: 0.05 }} content={<CustomTooltip />} />
                                    <Bar dataKey="leads" fill="hsl(var(--muted))" name="Signals Intercepted" radius={[8, 8, 0, 0]} barSize={28} />
                                    <Bar dataKey="closed" fill="#8b5cf6" name="Successful Conversions" radius={[8, 8, 0, 0]} barSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, description, icon: Icon, trend, color }: KPICardProps) {
    const colorVariants = {
        violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20 shadow-violet-500/5',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5',
        rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5',
    };

    return (
        <div className="relative group overflow-hidden glass-card rounded-[2rem] p-8 border-border bg-card/10 hover:bg-card/20 transition-all duration-500 hover:scale-[1.02] shadow-premium">
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className={cn("p-4 rounded-2xl border transition-all duration-500 group-hover:bg-white/10 group-hover:scale-110", colorVariants[color])}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">State</span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border">
                        <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", color === 'emerald' ? 'bg-emerald-400' : 'bg-primary')} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Optimal</span>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                <div className="text-4xl font-black text-foreground tracking-tighter mb-2 group-hover:text-primary transition-colors">{value}</div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">{title}</p>

                <div className="flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight className={cn("h-4 w-4", colorVariants[color].split(' ')[0])} />
                        <span className={cn("text-sm font-black tracking-tight", colorVariants[color].split(' ')[0])}>{trend}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground/40 italic">{description}</span>
                </div>
            </div>

            {/* Background design elements */}
            <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-white/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
        </div>
    );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { color?: string; fill?: string; name: string; value: number | string; payload?: { stage?: string } }[]; label?: string }) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover/95 backdrop-blur-3xl border border-border p-6 rounded-3xl shadow-2xl min-w-[200px] animate-in zoom-in-95 duration-200">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 border-b border-border pb-2">
                    {label || payload[0].name || payload[0].payload?.stage}
                </p>
                <div className="space-y-3">
                    {payload.map((entry: { color?: string; fill?: string; name: string; value: number | string }, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="text-[11px] font-bold text-muted-foreground">{entry.name}</span>
                            </div>
                            <span className="text-sm font-black text-foreground tracking-tight">{entry.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
}

function CustomLegend({ payload }: { payload?: { color?: string; value: string }[] }) {
    if (!payload) return null;
    return (
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 mt-8 px-10">
            {payload.map((entry: { color?: string; value: string }, index: number) => (
                <div key={`item-${index}`} className="flex items-center gap-3 group cursor-default">
                    <div className="h-2 w-2 rounded-full transition-all duration-300 group-hover:scale-150 shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest group-hover:text-white transition-colors">{entry.value}</span>
                </div>
            ))}
        </div>
    );
}
