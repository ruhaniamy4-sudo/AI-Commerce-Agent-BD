"use client";
/**
 * Tells the merchant their AI has stopped replying — or is about to — before a
 * customer does. Paired with the holding message customers now receive when the
 * access gate blocks a turn.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AlertTriangle, PauseCircle } from "lucide-react";
import { aiAccessApi, MerchantAIAccess } from "@/lib/api";

const BLOCKED_COPY: Record<string, { title: string; detail: string; action?: string }> = {
    REQUEST_LIMIT_REACHED: { title: "AI replies are paused — monthly message allowance used up", detail: "Customers are getting your holding message and their conversations are waiting in your inbox.", action: "Upgrade plan" },
    TOKEN_LIMIT_REACHED: { title: "AI replies are paused — monthly usage allowance used up", detail: "Customers are getting your holding message and their conversations are waiting in your inbox.", action: "Upgrade plan" },
    SUBSCRIPTION_INACTIVE: { title: "AI replies are paused — your subscription is not active", detail: "Renew to let your agent start selling again.", action: "Review billing" },
    PLATFORM_SUSPENDED: { title: "AI replies have been suspended by SellPilot", detail: "Contact support to resolve this." },
    BUSINESS_SUSPENDED: { title: "Your account is suspended", detail: "Contact support to resolve this." },
    MERCHANT_DISABLED: { title: "AI replies are switched off", detail: "You turned AI selling off. Customers are getting your holding message." },
};

function warningText(access: MerchantAIAccess) {
    const percent = Math.round((access.consumed || 0) * 100);
    const limit = access.limits;
    const detail = limit?.requests !== null && limit?.requests !== undefined
        ? `You have used ${percent}% of the ${limit.requests.toLocaleString()} replies in your ${limit.plan || "current"} plan this period.`
        : `You have used ${percent}% of this period's allowance.`;
    return { title: `AI replies are ${percent}% through this period's allowance`, detail, action: "See usage" };
}

export function AIAccessBanner() {
    const { data: session } = useSession();
    // Staff work the inbox and cannot act on a quota, so they are not asked to.
    const canSee = Boolean(session) && session?.role !== "Staff";
    const { data: access } = useQuery({
        queryKey: ["ai-access"],
        queryFn: aiAccessApi.get,
        enabled: canSee,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });
    if (!access) return null;

    const blocked = !access.allowed && access.reason;
    const warning = access.allowed && (access.consumed ?? 0) >= (access.warnAt ?? 0.8);
    if (!blocked && !warning) return null;

    const copy = blocked ? BLOCKED_COPY[access.reason!] : warningText(access);
    if (!copy) return null;

    return (
        <div className={`ai-access-banner ${blocked ? "is-blocked" : "is-warning"}`} role={blocked ? "alert" : "status"}>
            <span className="ai-access-banner-icon">{blocked ? <PauseCircle size={18} /> : <AlertTriangle size={18} />}</span>
            <div>
                <strong>{copy.title}</strong>
                <p>{copy.detail}</p>
            </div>
            {copy.action && <Link href="/settings/billing">{copy.action}</Link>}
        </div>
    );
}
