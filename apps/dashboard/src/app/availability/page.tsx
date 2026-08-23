'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { availabilityApi, meetingHostsApi } from '@/lib/api';
import type { AvailabilitySettings, MeetingHost } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, Trash2, User, Clock, Coffee, Bell, ShieldCheck, Zap, History } from 'lucide-react';
import { useEffect, useState } from 'react';

const DAYS = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
];

export default function AvailabilityPage() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<AvailabilitySettings | null>(null);
    const [hosts, setHosts] = useState<MeetingHost[]>([]);

    const { data: availabilityData, isLoading: isAvailabilityLoading } =
        useQuery({
            queryKey: ['availability'],
            queryFn: () => availabilityApi.get(),
        });

    const { data: hostsData, isLoading: isHostsLoading } = useQuery({
        queryKey: ['meeting-hosts'],
        queryFn: () => meetingHostsApi.getAll(),
    });

    useEffect(() => {
        if (availabilityData) {
            setSettings(availabilityData);
        }
    }, [availabilityData]);

    useEffect(() => {
        if (hostsData) {
            setHosts(hostsData);
        }
    }, [hostsData]);

    const updateAvailabilityMutation = useMutation({
        mutationFn: (newSettings: AvailabilitySettings) =>
            availabilityApi.update(newSettings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['availability'] });
        },
    });

    const updateHostsMutation = useMutation({
        mutationFn: (newHosts: MeetingHost[]) =>
            meetingHostsApi.bulkUpdate(newHosts),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting-hosts'] });
        },
    });

    const handleSave = async () => {
        try {
            if (settings) {
                await updateAvailabilityMutation.mutateAsync(settings);
            }
            await updateHostsMutation.mutateAsync(hosts);
        } catch (error) {
            console.error('Failed to update settings:', error);
        }
    };

    const toggleDay = (day: number) => {
        if (!settings) return;
        const newDays = settings.workingDays.includes(day)
            ? settings.workingDays.filter((d) => d !== day)
            : [...settings.workingDays, day].sort((a, b) => a - b);
        setSettings({ ...settings, workingDays: newDays });
    };

    const addBreak = () => {
        if (!settings) return;
        setSettings({
            ...settings,
            breaks: [...settings.breaks, { name: 'New Break', start: '13:00', end: '14:00' }],
        });
    };

    const removeBreak = (index: number) => {
        if (!settings) return;
        const newBreaks = settings.breaks.filter((_, i) => i !== index);
        setSettings({ ...settings, breaks: newBreaks });
    };

    const updateBreak = (
        index: number,
        field: 'start' | 'end',
        value: string
    ) => {
        if (!settings) return;
        const newBreaks = settings.breaks.map((b, i) =>
            i === index ? { ...b, [field]: value } : b
        );
        setSettings({ ...settings, breaks: newBreaks });
    };

    const addHost = () => {
        setHosts([...hosts, { _id: Date.now().toString(), name: 'New Host', email: '', isActive: true }]);
    };

    const removeHost = (index: number) => {
        setHosts(hosts.filter((_, i) => i !== index));
    };

    const updateHost = (
        index: number,
        field: keyof MeetingHost,
        value: string
    ) => {
        setHosts(
            hosts.map((h, i) => (i === index ? { ...h, [field]: value } : h))
        );
    };

    const isPending =
        updateAvailabilityMutation.isPending || updateHostsMutation.isPending;

    if (isAvailabilityLoading || isHostsLoading || !settings) {
        return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
    }

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Temporal Logistics"
                description="Calibrate the engagement windows and notification vectors for your institution."
                actions={
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="h-14 px-10 bg-primary hover:bg-violet-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.05] active:scale-95 flex items-center gap-3"
                    >
                        {isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        Sync All Parameters
                    </Button>
                }
            />

            <div className="py-8 space-y-10 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <Card className="glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01]">
                        <CardHeader className="p-8 pb-4">
                            <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                                <Clock className="h-6 w-6 text-primary" />
                            </div>
                            <CardTitle className="text-xl font-black text-white tracking-tight uppercase tracking-widest">Office Chronology</CardTitle>
                            <CardDescription className="text-muted-foreground/60 font-medium">Standard engagement windows for institutional meetings.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 pt-4 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cycle Start</Label>
                                    <Input
                                        type="time"
                                        value={settings.officeHours.start}
                                        onChange={(e) =>
                                            setSettings({
                                                ...settings,
                                                officeHours: {
                                                    ...settings.officeHours,
                                                    start: e.target.value,
                                                },
                                            })
                                        }
                                        className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white font-mono"
                                    />
                                </div>
                                <div className="space-y-2.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cycle End</Label>
                                    <Input
                                        type="time"
                                        value={settings.officeHours.end}
                                        onChange={(e) =>
                                            setSettings({
                                                ...settings,
                                                officeHours: {
                                                    ...settings.officeHours,
                                                    end: e.target.value,
                                                },
                                            })
                                        }
                                        className="h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Operational Days</Label>
                                <div className="flex flex-wrap gap-3">
                                    {DAYS.map((day) => (
                                        <Button
                                            key={day.value}
                                            type="button"
                                            onClick={() => toggleDay(day.value)}
                                            className={cn(
                                                "w-14 h-14 rounded-2xl transition-all font-black text-xs uppercase tracking-tighter border-white/5",
                                                settings.workingDays.includes(day.value)
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                    : 'bg-white/[0.03] text-muted-foreground hover:bg-white/10'
                                            )}
                                        >
                                            {day.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2.5 border-t border-white/5 pt-6">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Inter-Session Buffer</Label>
                                <div className="relative group">
                                    <History className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={settings.meetingBuffer}
                                        onChange={(e) =>
                                            setSettings({
                                                ...settings,
                                                meetingBuffer:
                                                    parseInt(e.target.value) || 0,
                                            })
                                        }
                                        className="pl-12 h-14 bg-white/[0.03] border-white/5 rounded-2xl focus:bg-white/[0.05] transition-all shadow-inner text-white"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest mt-2 px-1">
                                    Temporal gap enforced between consecutive engagement protocols.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01]">
                        <CardHeader className="p-8 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="bg-amber-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/20">
                                        <Coffee className="h-6 w-6 text-amber-400" />
                                    </div>
                                    <CardTitle className="text-xl font-black text-white tracking-tight uppercase tracking-widest">offline windows</CardTitle>
                                    <CardDescription className="text-muted-foreground/60 font-medium">Scheduled dormancy periods within active cycles.</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addBreak}
                                    className="h-10 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-bold px-4 flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Define Window
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                            {settings.breaks.length === 0 ? (
                                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                    <Zap className="h-10 w-10 text-muted-foreground/10 mx-auto mb-4" />
                                    <p className="text-sm text-muted-foreground/40 font-medium">Zero dormancy windows defined.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {settings.breaks.map((b, index) => (
                                        <div
                                            key={index}
                                            className="flex items-end gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl group relative shadow-inner animate-in fade-in slide-in-from-right-4 duration-300"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Begin</Label>
                                                <Input
                                                    type="time"
                                                    value={b.start}
                                                    onChange={(e) =>
                                                        updateBreak(
                                                            index,
                                                            'start',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-11 bg-white/[0.03] border-white/5 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Terminate</Label>
                                                <Input
                                                    type="time"
                                                    value={b.end}
                                                    onChange={(e) =>
                                                        updateBreak(
                                                            index,
                                                            'end',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-11 bg-white/[0.03] border-white/5 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-11 w-11 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-xl transition-all"
                                                onClick={() => removeBreak(index)}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="glass-card border-white/5 shadow-premium rounded-3xl overflow-hidden bg-white/[0.01]">
                    <CardHeader className="p-8 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="bg-emerald-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
                                    <Bell className="h-6 w-6 text-emerald-400" />
                                </div>
                                <CardTitle className="text-xl font-black text-white tracking-tight uppercase tracking-widest">Notification Receptors</CardTitle>
                                <CardDescription className="text-muted-foreground/60 font-medium opacity-60">Designated entities for real-time engagement telemetry.</CardDescription>
                            </div>
                            <Button
                                onClick={addHost}
                                className="h-12 bg-white text-black hover:bg-white/90 rounded-2xl px-8 font-black uppercase tracking-widest shadow-xl shadow-white/10"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Recruit Envoy
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-4">
                        {hosts.length === 0 ? (
                            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                <ShieldCheck className="h-10 w-10 text-muted-foreground/10 mx-auto mb-4" />
                                <p className="text-sm text-muted-foreground/40 font-medium">Receptor network is offline. No telemetry will be broadcast.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {hosts.map((host, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-5 p-6 bg-white/[0.02] border border-white/5 rounded-3xl group relative shadow-inner transition-all hover:bg-white/[0.04]"
                                    >
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shrink-0 transition-transform group-hover:scale-110">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entity Alias</Label>
                                                <Input
                                                    placeholder="e.g. Strategic Envoy"
                                                    value={host.name}
                                                    onChange={(e) =>
                                                        updateHost(
                                                            index,
                                                            'name',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-11 bg-white/[0.03] border-white/5 rounded-xl text-white font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Signal Vector (Email)</Label>
                                                <Input
                                                    type="email"
                                                    placeholder="envoy@nexus.ai"
                                                    value={host.email}
                                                    onChange={(e) =>
                                                        updateHost(
                                                            index,
                                                            'email',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-11 bg-white/[0.03] border-white/5 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all absolute top-4 right-4"
                                            onClick={() => removeHost(index)}
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="h-20" />
        </div>
    );
}
