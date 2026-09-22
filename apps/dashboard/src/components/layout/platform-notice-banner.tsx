"use client";
/**
 * What the platform is currently telling this workspace.
 *
 * Announcements are targeted and evaluated per request, so a notice reaches the
 * workspaces it was aimed at without a fan-out write. A dismissal is remembered in
 * this browser only — an operator publishing something critical should not have it
 * silenced for a colleague who never saw it.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Info, Megaphone, X } from "lucide-react";
import { platformNoticeApi } from "@/lib/api";

const DISMISSED_KEY = "sellpilot.dismissed-notices";
const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, critical: AlertTriangle } as const;

function readDismissed() {
    try {
        const stored = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
        return Array.isArray(stored) ? stored.map(String) : [];
    } catch {
        // Private windows and cleared site data both land here; showing the notice
        // again is the safe failure.
        return [];
    }
}

export function PlatformNoticeBanner() {
    const { data: session } = useSession();
    const [dismissed, setDismissed] = useState<string[]>([]);
    const [ready, setReady] = useState(false);

    // Read on the client only, so the server render and the first paint agree.
    useEffect(() => {
        setDismissed(readDismissed());
        setReady(true);
    }, []);

    const { data } = useQuery({
        queryKey: ["platform-notices"],
        queryFn: platformNoticeApi.get,
        enabled: Boolean(session),
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    function dismiss(id: string) {
        const next = [...dismissed, id];
        setDismissed(next);
        try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50))); } catch { /* nothing to do */ }
    }

    if (!ready || !data?.announcements?.length) return null;
    const visible = data.announcements.filter(notice => !dismissed.includes(notice._id));
    if (!visible.length) return null;

    return <>{visible.map(notice => {
        const Icon = ICONS[notice.severity] || Megaphone;
        return (
            <div key={notice._id} className={`platform-notice is-${notice.severity}`} role={notice.severity === "critical" ? "alert" : "status"}>
                <span className="platform-notice-icon"><Icon size={17} /></span>
                <div>
                    <strong>{notice.title}</strong>
                    <p>{notice.body}</p>
                </div>
                {notice.dismissible && (
                    <button onClick={() => dismiss(notice._id)} aria-label={`Dismiss: ${notice.title}`}><X size={15} /></button>
                )}
            </div>
        );
    })}</>;
}
