'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { meetingsApi } from '@/lib/api';
import type { Meeting } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isSameDay,
    isSameMonth,
    parseISO,
    startOfMonth,
} from 'date-fns';
import {
    Calendar as CalendarIcon,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Clock,
    Edit,
    List,
    Loader2,
    XCircle,
    MapPin,
    FileText,
    History,
    Zap,
    Trash
} from 'lucide-react';
import { useState } from 'react';

function formatInBDTime(date: string | Date, formatStr: string) {
    const d = typeof date === 'string' ? parseISO(date) : date;
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Dhaka',
    };

    if (formatStr.includes('PP')) {
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
    }
    if (formatStr.includes('p') || formatStr.includes('HH:mm')) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = formatStr.includes('p');
    }

    try {
        return new Intl.DateTimeFormat('en-US', options).format(d);
    } catch {
        return format(d, formatStr);
    }
}


interface MeetingDetailsDialogProps {
    meeting: Meeting | null;
    onClose: () => void;
}

function MeetingDetailsDialog({ meeting, onClose }: MeetingDetailsDialogProps) {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Meeting>>({});

    const updateMutation = useMutation({
        mutationFn: (data: Partial<Meeting>) =>
            meetingsApi.update(meeting!._id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
            setIsEditing(false);
            onClose();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => meetingsApi.delete(meeting!._id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
            onClose();
        },
    });

    if (!meeting) return null;

    const handleUpdateStatus = (status: Meeting['status']) => {
        updateMutation.mutate({ status });
    };

    const handleSaveEdit = () => {
        updateMutation.mutate(editData);
    };

    return (
        <Dialog open={!!meeting} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl p-0 overflow-hidden border-border shadow-2xl rounded-2xl sm:rounded-3xl bg-background text-foreground max-h-[90dvh]">
                <DialogHeader className="p-4 sm:p-6 md:p-8 bg-muted/10 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="bg-primary/10 px-2.5 sm:px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1.5 sm:gap-2">
                                <Zap className="h-3 w-3 text-primary" />
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary">Strategic Session</span>
                            </div>
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono uppercase tracking-widest italic opacity-50">Ref: {meeting._id.slice(-8).toUpperCase()}</span>
                        </div>
                        {!isEditing && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-10 sm:w-10 bg-secondary/50 border border-border text-foreground rounded-lg sm:rounded-xl hover:bg-secondary"
                                onClick={() => {
                                    setIsEditing(true);
                                    setEditData({
                                        title: meeting.title,
                                        description: meeting.description,
                                        location: meeting.location,
                                        startTime: meeting.startTime,
                                        endTime: meeting.endTime,
                                    });
                                }}
                            >
                                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        )}
                    </div>
                    <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tighter">
                        {isEditing ? 'Refine Objective' : meeting.title}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium mt-1 text-xs sm:text-sm">
                        {isEditing
                            ? 'Calibrate the temporal and physical parameters of this engagement.'
                            : 'Detailed telemetry and management interface for this transaction.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-h-[60vh] overflow-y-auto">
                    {isEditing ? (
                        <div className="space-y-4 sm:space-y-6">
                            <div className="space-y-1.5 sm:space-y-2.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Engagement Title
                                </label>
                                <Input
                                    value={editData.title}
                                    onChange={(e) =>
                                        setEditData({
                                            ...editData,
                                            title: e.target.value,
                                        })
                                    }
                                    className="h-11 sm:h-12 md:h-14 bg-muted/5 border-border rounded-xl sm:rounded-2xl focus:bg-muted/10 transition-all shadow-inner text-foreground text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8">
                                <div className="space-y-1.5 sm:space-y-2.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                        Temporal Start
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={
                                            editData.startTime
                                                ? format(
                                                    parseISO(
                                                        editData.startTime
                                                    ),
                                                    "yyyy-MM-dd'T'HH:mm"
                                                )
                                                : ''
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                startTime: new Date(
                                                    e.target.value
                                                ).toISOString(),
                                            })
                                        }
                                        className="h-11 sm:h-12 md:h-14 bg-muted/5 border-border rounded-xl sm:rounded-2xl focus:bg-muted/10 transition-all shadow-inner text-foreground text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5 sm:space-y-2.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                        Temporal End
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={
                                            editData.endTime
                                                ? format(
                                                    parseISO(
                                                        editData.endTime
                                                    ),
                                                    "yyyy-MM-dd'T'HH:mm"
                                                )
                                                : ''
                                        }
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                endTime: new Date(
                                                    e.target.value
                                                ).toISOString(),
                                            })
                                        }
                                        className="h-11 sm:h-12 md:h-14 bg-muted/5 border-border rounded-xl sm:rounded-2xl focus:bg-muted/10 transition-all shadow-inner text-foreground text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Deployment Location
                                </label>
                                <Input
                                    value={editData.location || ''}
                                    placeholder="Nexus coordinates or remote link..."
                                    onChange={(e) =>
                                        setEditData({
                                            ...editData,
                                            location: e.target.value,
                                        })
                                    }
                                    className="h-11 sm:h-12 md:h-14 bg-muted/5 border-border rounded-xl sm:rounded-2xl focus:bg-muted/10 transition-all shadow-inner text-foreground text-sm"
                                />
                            </div>
                            <div className="space-y-1.5 sm:space-y-2.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Operational Brief
                                </label>
                                <textarea
                                    className="w-full min-h-[90px] sm:min-h-[120px] p-3 sm:p-6 rounded-xl sm:rounded-2xl border-border bg-muted/5 text-sm text-foreground focus:bg-muted/10 transition-all outline-none shadow-inner leading-relaxed"
                                    value={editData.description || ''}
                                    onChange={(e) =>
                                        setEditData({
                                            ...editData,
                                            description: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 sm:space-y-8">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-muted/5 border border-border shadow-inner">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className={cn(
                                        "h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center border shrink-0",
                                        meeting.status === 'scheduled' ? "bg-primary/10 border-primary/20 text-primary" :
                                            meeting.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                                "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                    )}>
                                        {meeting.status === 'scheduled' ? <Clock className="h-5 w-5 sm:h-6 sm:w-6" /> :
                                            meeting.status === 'completed' ? <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" /> :
                                                <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current State</p>
                                        <p className="text-sm sm:text-base font-black text-foreground tracking-tight uppercase tracking-widest">{meeting.status}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                                    {meeting.status !== 'completed' && (
                                        <Button
                                            onClick={() => handleUpdateStatus('completed')}
                                            className="h-10 sm:h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl sm:rounded-2xl px-4 sm:px-6 font-black uppercase tracking-widest shadow-xl shadow-primary/10 text-xs sm:text-sm flex-1 sm:flex-none"
                                        >
                                            Complete
                                        </Button>
                                    )}
                                    {meeting.status !== 'cancelled' && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleUpdateStatus('cancelled')}
                                            className="h-10 sm:h-12 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm flex-1 sm:flex-none"
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                                <div className="space-y-1.5 sm:space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <CalendarIcon className="h-3 w-3" /> Start Temporal
                                    </div>
                                    <p className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                                        {formatInBDTime(meeting.startTime, 'PPp')}
                                    </p>
                                </div>
                                <div className="space-y-1.5 sm:space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <History className="h-3 w-3" /> End Temporal
                                    </div>
                                    <p className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                                        {formatInBDTime(meeting.endTime, 'PPp')}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-border pt-4 sm:pt-8">
                                <div className="space-y-1.5 sm:space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <MapPin className="h-3 w-3" /> Sector (Location)
                                    </div>
                                    <p className="text-xs sm:text-sm font-medium text-foreground/80 leading-relaxed">
                                        {meeting.location || <span className="text-muted-foreground/40 italic">No coordinates defined</span>}
                                    </p>
                                </div>

                                <div className="space-y-1.5 sm:space-y-2 border-t border-border pt-3 sm:pt-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <FileText className="h-3 w-3" /> Operational Brief
                                    </div>
                                    <p className="text-xs sm:text-sm font-medium text-foreground/70 whitespace-pre-wrap leading-relaxed">
                                        {meeting.description || <span className="text-muted-foreground/40 italic">No brief available</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 sm:p-6 md:p-8 bg-muted/30 border-t border-border flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-3">
                    {isEditing ? (
                        <>
                            <Button
                                variant="ghost"
                                onClick={() => setIsEditing(false)}
                                className="h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl border-border bg-transparent text-foreground px-6 sm:px-8 font-bold hover:bg-accent w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={updateMutation.isPending}
                                className="h-11 sm:h-12 md:h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl sm:rounded-2xl px-8 sm:px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20 w-full sm:w-auto text-xs sm:text-sm"
                            >
                                {updateMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Sync Protocol
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    if (confirm('Verify: Purge this engagement protocol?')) {
                                        deleteMutation.mutate();
                                    }
                                }}
                                disabled={deleteMutation.isPending}
                                className="h-11 sm:h-12 md:h-14 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-6 sm:px-8 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest w-full sm:w-auto text-xs sm:text-sm"
                            >
                                <Trash className="h-4 w-4 mr-2 sm:mr-3" />
                                Purge
                            </Button>
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl border-border bg-secondary/50 text-foreground px-8 sm:px-12 font-bold hover:bg-secondary w-full sm:w-auto text-xs sm:text-sm"
                            >
                                Dismiss
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CalendarView({
    meetings,
    onSelect,
}: {
    meetings: Meeting[];
    onSelect: (m: Meeting) => void;
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const firstDayOfWeek = getDay(monthStart);
    const emptyDays = Array(firstDayOfWeek).fill(null);

    const getMeetingsForDay = (date: Date) => {
        return meetings.filter((meeting) => {
            const meetingDate = parseISO(meeting.startTime);
            return isSameDay(meetingDate, date);
        });
    };

    return (
        <Card className="glass-card border-border shadow-premium rounded-2xl sm:rounded-3xl overflow-hidden bg-card/10">
            <CardHeader className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 border-b border-border">
                <div className="text-center sm:text-left">
                    <CardTitle className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tighter">
                        {format(currentMonth, 'MMMM yyyy')}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground font-medium mt-1 text-xs sm:text-sm">
                        Temporal timeline for institutional engagements
                    </CardDescription>
                </div>
                <div className="flex gap-2 sm:gap-3 bg-muted/10 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-border">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl hover:bg-accent text-foreground"
                        onClick={() =>
                            setCurrentMonth(
                                new Date(
                                    currentMonth.getFullYear(),
                                    currentMonth.getMonth() - 1,
                                    1
                                )
                            )
                        }
                    >
                        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl hover:bg-accent text-foreground"
                        onClick={() =>
                            setCurrentMonth(
                                new Date(
                                    currentMonth.getFullYear(),
                                    currentMonth.getMonth() + 1,
                                    1
                                )
                            )
                        }
                    >
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-7 gap-px bg-border/20">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                        (day) => (
                            <div
                                key={day}
                                className="bg-muted/10 py-2 sm:py-4 text-center text-[9px] sm:text-[10px] font-black uppercase text-muted-foreground tracking-wider sm:tracking-[0.2em]"
                            >
                                {day}
                            </div>
                        )
                    )}
                    {emptyDays.map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="bg-muted/5 min-h-[70px] sm:min-h-[140px]"
                        />
                    ))}
                    {daysInMonth.map((day) => {
                        const dayMeetings = getMeetingsForDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentMonth);

                        return (
                            <div
                                key={day.toISOString()}
                                className={cn(
                                    'bg-background min-h-[70px] sm:min-h-[140px] p-1.5 sm:p-3 transition-all relative group border-r border-b border-border/20',
                                    !isCurrentMonth && 'opacity-20 pointer-events-none grayscale',
                                    isToday && 'bg-primary/[0.03]'
                                )}
                            >
                                <div
                                    className={cn(
                                        'text-xs font-black mb-1 sm:mb-3 flex items-center justify-between',
                                        isToday ? 'text-primary' : 'text-muted-foreground/40'
                                    )}
                                >
                                    <span className={cn(
                                        "h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center rounded-md sm:rounded-lg transition-colors text-[10px] sm:text-xs",
                                        isToday ? "bg-primary text-white shadow-lg shadow-primary/20" : "group-hover:text-white"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    {isToday && (
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                                    )}
                                </div>
                                <div className="space-y-1 sm:space-y-2 overflow-y-auto max-h-[60px] sm:max-h-[100px] custom-scrollbar">
                                    {dayMeetings.map((meeting) => (
                                        <button
                                            key={meeting._id}
                                            onClick={() => onSelect(meeting)}
                                            className={cn(
                                                'w-full text-left p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl truncate transition-all border shadow-sm group/btn',
                                                meeting.status === 'scheduled' && 'bg-primary/10 border-primary/20 text-foreground hover:bg-primary/20',
                                                meeting.status === 'completed' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20',
                                                meeting.status === 'cancelled' && 'bg-muted/5 border-border text-muted-foreground/40 hover:bg-muted/10 line-through'
                                            )}
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-60">
                                                    {formatInBDTime(meeting.startTime, 'HH:mm')}
                                                </span>
                                                <span className="text-[9px] sm:text-[10px] font-bold truncate tracking-tight">{meeting.title}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function ListView({
    meetings,
    onSelect,
}: {
    meetings: Meeting[];
    onSelect: (m: Meeting) => void;
}) {
    return (
        <Card className="glass-card border-border shadow-premium rounded-2xl sm:rounded-3xl overflow-hidden bg-card/10">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border">
                            <TableHead className="font-bold py-3 sm:py-5 pl-4 sm:pl-8 text-muted-foreground uppercase text-[10px] tracking-widest">Meeting Payload</TableHead>
                            <TableHead className="font-bold py-3 sm:py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Temporal Log</TableHead>
                            <TableHead className="font-bold py-3 sm:py-5 text-muted-foreground uppercase text-[10px] tracking-widest">Operational State</TableHead>
                            <TableHead className="text-right font-bold py-3 sm:py-5 pr-4 sm:pr-8 text-muted-foreground uppercase text-[10px] tracking-widest">Calibration</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {meetings.length > 0 ? (
                            meetings.map((meeting) => (
                                <TableRow
                                    key={meeting._id}
                                    className="hover:bg-muted/5 transition-colors group border-b border-border/10"
                                >
                                    <TableCell className="py-3.5 sm:py-6 pl-4 sm:pl-8">
                                        <div className="flex flex-col">
                                            <span className="text-sm sm:text-base font-black text-foreground tracking-tight">{meeting.title}</span>
                                            {meeting.location && (
                                                <div className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1.5 italic">
                                                    <MapPin className="h-2.5 w-2.5" /> {meeting.location}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3.5 sm:py-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs sm:text-sm font-bold text-foreground tracking-tighter">
                                                {formatInBDTime(meeting.startTime, 'PP')}
                                            </span>
                                            <span className="text-[9px] sm:text-[10px] text-muted-foreground/40 font-black uppercase tracking-widest mt-0.5">
                                                {formatInBDTime(meeting.startTime, 'HH:mm')} - {formatInBDTime(meeting.endTime, 'HH:mm')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3.5 sm:py-6">
                                        <Badge
                                            className={cn(
                                                "capitalize px-3 sm:px-4 py-1 sm:py-1.5 border-none font-black text-[9px] tracking-widest rounded-full",
                                                meeting.status === 'scheduled' ? "bg-primary/10 text-primary" :
                                                    meeting.status === 'completed' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                                                        "bg-rose-500/10 text-rose-500"
                                            )}
                                        >
                                            {meeting.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3.5 sm:py-6 text-right pr-4 sm:pr-8">
                                        <Button
                                            variant="ghost"
                                            onClick={() => onSelect(meeting)}
                                            className="h-8 sm:h-10 px-3 sm:px-6 text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-secondary/50 border border-border text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all rounded-lg sm:rounded-xl shadow-lg"
                                        >
                                            Manage
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="py-16 sm:py-32 text-center"
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-16 w-16 sm:h-20 sm:w-20 bg-muted rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-border">
                                            <CalendarIcon className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/20" />
                                        </div>
                                        <div className="space-y-1 sm:space-y-2">
                                            <h3 className="text-base sm:text-lg font-bold text-foreground">Silent Ledger</h3>
                                            <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">No scheduled engagement protocols found in the temporal database.</p>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default function MeetingsPage() {
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

    const { data: meetings, isLoading } = useQuery({
        queryKey: ['meetings'],
        queryFn: () => meetingsApi.getAll(),
    });

    if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    const meetingsList = meetings?.data || [];

    return (
        <div className="flex flex-col h-full min-h-[90vh]">
            <PageHeader
                title="Engagement Ledger"
                description="Synthesize, calibrate, and oversee institutional meeting protocols across temporal sectors."
            />
            <div className="py-4 sm:py-8 space-y-6 sm:space-y-8 pb-12 sm:pb-20">
                <Tabs defaultValue="calendar" className="space-y-6 sm:space-y-12">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-8">
                        <TabsList className="w-full sm:w-auto bg-muted/10 p-1 sm:p-1.5 border border-border shadow-2xl rounded-xl sm:rounded-2xl backdrop-blur-3xl">
                            <TabsTrigger
                                value="calendar"
                                className="flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-black text-[9px] sm:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                Matrix View
                            </TabsTrigger>
                            <TabsTrigger
                                value="list"
                                className="flex-1 sm:flex-initial px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all font-black text-[9px] sm:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                Sequence View
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center justify-around sm:justify-start gap-4 sm:gap-8 bg-muted/30 px-4 sm:px-8 py-2.5 sm:py-4 rounded-2xl sm:rounded-3xl border border-border backdrop-blur-md shadow-inner">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Scheduled</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Completed</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cancelled</span>
                            </div>
                        </div>
                    </div>

                    <TabsContent
                        value="calendar"
                        className="m-0 border-none outline-none animate-in fade-in slide-in-from-bottom-4 duration-700"
                    >
                        <CalendarView
                            meetings={meetingsList}
                            onSelect={setSelectedMeeting}
                        />
                    </TabsContent>

                    <TabsContent
                        value="list"
                        className="m-0 border-none outline-none animate-in fade-in slide-in-from-bottom-4 duration-700"
                    >
                        <ListView
                            meetings={meetingsList}
                            onSelect={setSelectedMeeting}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <MeetingDetailsDialog
                meeting={selectedMeeting}
                onClose={() => setSelectedMeeting(null)}
            />
        </div>
    );
}
