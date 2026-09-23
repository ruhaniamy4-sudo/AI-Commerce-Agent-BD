"use client";
/**
 * Platform announcements, in the workspace top bar.
 *
 * Announcements used to occupy a full-width banner above the page, which pushed the
 * merchant's own work down the screen and had to be dismissed before anything else
 * could be read. They live behind a bell instead: the badge says how many arrived
 * since this operator last looked, and the panel holds the ten most recent so an
 * older notice can still be found after it was read.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AlertTriangle, Bell, CheckCircle2, Info, Megaphone } from "lucide-react";
import { platformNoticeApi, type PlatformNotice } from "@/lib/api";

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, critical: AlertTriangle } as const;

function ago(value?: string) {
    if (!value) return "";
    const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
    return new Date(value).toLocaleDateString();
}

export function PlatformNoticeBell() {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    // Opening the panel marks everything read, which would otherwise clear the "new"
    // markers while they are being read. This holds the value from the moment it
    // opened, so what was new stays visibly new until the panel is closed.
    const [readLine, setReadLine] = useState(0);
    const container = useRef<HTMLDivElement>(null);

    const { data } = useQuery({
        queryKey: ["platform-notices"],
        queryFn: platformNoticeApi.get,
        enabled: Boolean(session),
        staleTime: 60_000,
        // An announcement published while a merchant is working should reach them
        // without a reload, but it is not worth a tighter poll than this.
        refetchInterval: 5 * 60_000,
        refetchOnWindowFocus: true,
    });

    const markSeen = useMutation({
        mutationFn: platformNoticeApi.markSeen,
        // The badge clears immediately; the refetch only confirms it.
        onMutate: () => queryClient.setQueryData(["platform-notices"], (current: typeof data) =>
            current ? { ...current, unreadCount: 0 } : current),
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["platform-notices"] }),
    });

    // Escape closes, and so does a click anywhere outside the panel.
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
        const onPointerDown = (event: MouseEvent) => {
            if (!container.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("mousedown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("mousedown", onPointerDown);
        };
    }, [open]);

    if (!session) return null;

    const announcements: PlatformNotice[] = data?.announcements || [];
    const unread = data?.unreadCount || 0;
    const isUnread = (notice: PlatformNotice) =>
        Boolean(notice.publishedAt) && new Date(notice.publishedAt!).getTime() > readLine;

    function toggle() {
        const next = !open;
        if (next) {
            setReadLine(data?.seenAt ? new Date(data.seenAt).getTime() : 0);
            if (unread > 0) markSeen.mutate();
        }
        setOpen(next);
    }

    return (
        <div className="notice-bell" ref={container}>
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={unread ? `Announcements, ${unread} unread` : "Announcements"}
                className={open ? "is-open" : undefined}
            >
                <Bell size={17} />
                {unread > 0 && <span className="notice-bell-badge">{unread > 9 ? "9+" : unread}</span>}
            </button>

            {open && (
                <div className="notice-panel" role="dialog" aria-label="Platform announcements">
                    <header>
                        <strong>Announcements</strong>
                        <span>{announcements.length ? `Latest ${announcements.length}` : "Nothing yet"}</span>
                    </header>

                    <div className="notice-panel-list">
                        {announcements.map((notice) => {
                            const Icon = ICONS[notice.severity] || Megaphone;
                            return (
                                <article key={notice._id} className={`notice-item is-${notice.severity}${isUnread(notice) ? " is-unread" : ""}`}>
                                    <span className="notice-item-icon"><Icon size={13} /></span>
                                    <div>
                                        <strong>{notice.title}</strong>
                                        <p>{notice.body}</p>
                                        <time>{ago(notice.publishedAt)}</time>
                                    </div>
                                </article>
                            );
                        })}

                        {!announcements.length && (
                            <div className="notice-panel-empty">
                                <Megaphone size={20} />
                                <p>No announcements right now.</p>
                                <span>Platform updates and maintenance notices appear here.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
