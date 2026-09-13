"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "@/lib/api";
import { format, formatDistanceToNowStrict } from "date-fns";
import { MapPin, Phone, Mail, ShoppingBag, Clock, Package } from "lucide-react";

const ORDER_TONE: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600",
    confirmed: "bg-primary/10 text-primary",
    processing: "bg-primary/10 text-primary",
    shipped: "bg-violet-500/10 text-violet-600",
    delivered: "bg-emerald-500/10 text-emerald-600",
    completed: "bg-emerald-500/10 text-emerald-600",
    cancelled: "bg-rose-500/10 text-rose-600",
    refunded: "bg-rose-500/10 text-rose-600",
};

const DRAFT_STAGE: Record<string, string> = {
    AWAITING_VARIANT: "Choosing a variant",
    AWAITING_NAME: "Asking for their name",
    AWAITING_PHONE: "Asking for their number",
    AWAITING_ADDRESS: "Asking for the address",
    AWAITING_CITY: "Asking for the district",
    AWAITING_CONFIRMATION: "Waiting for confirmation",
    SUBMITTING: "Placing the order",
};

function money(amount: number, currency: string) {
    return `${currency === "BDT" ? "৳" : `${currency} `}${Math.round(amount).toLocaleString("en-US")}`;
}

/**
 * The panel beside the messages: who this customer is, what they have bought,
 * and what the AI is in the middle of collecting — so whoever takes over the
 * thread can answer without opening another page.
 */
export function ConversationContextPanel({ conversationId }: { conversationId: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ["conversation-context", conversationId],
        queryFn: () => conversationsApi.getContext(conversationId),
    });

    if (isLoading) {
        return <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Loading customer details…</section>;
    }
    if (!data) return null;

    const { customer, stats, recentOrders, draft } = data;

    return (
        <section className="space-y-4">
            <div className="rounded-xl border border-border bg-card">
                <header className="flex items-center justify-between border-b border-border px-5 py-3">
                    <h2 className="text-sm font-semibold">Customer</h2>
                    {customer?._id && (
                        <Link href={`/customers/${customer._id}`} className="text-xs font-medium text-primary hover:underline">
                            Full profile
                        </Link>
                    )}
                </header>

                {customer ? (
                    <div className="space-y-3 px-5 py-4 text-sm">
                        <p className="font-semibold">{customer.name || "Name not saved yet"}</p>
                        <dl className="space-y-2 text-muted-foreground">
                            {customer.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone size={13} className="shrink-0" />
                                    <a href={`tel:${customer.phone}`} className="hover:text-primary">{customer.phone}</a>
                                </div>
                            )}
                            {customer.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={13} className="shrink-0" />
                                    <span className="truncate">{customer.email}</span>
                                </div>
                            )}
                            {customer.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin size={13} className="mt-0.5 shrink-0" />
                                    <span>{[customer.address.line1, customer.address.zone, customer.address.city].filter(Boolean).join(", ")}</span>
                                </div>
                            )}
                            {customer.firstSeenAt && (
                                <div className="flex items-center gap-2">
                                    <Clock size={13} className="shrink-0" />
                                    <span>First wrote {formatDistanceToNowStrict(new Date(customer.firstSeenAt), { addSuffix: true })}</span>
                                </div>
                            )}
                        </dl>
                        {Boolean(customer.tags?.length) && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {customer.tags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="px-5 py-4 text-sm text-muted-foreground">
                        No customer record yet — one is created as soon as they share a name or number.
                    </p>
                )}

                <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-center">
                    <div className="px-3 py-3">
                        <p className="text-lg font-semibold">{stats.orders}</p>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Orders</p>
                    </div>
                    <div className="px-3 py-3">
                        <p className="text-lg font-semibold">{money(stats.spent, stats.currency)}</p>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Spent</p>
                    </div>
                </div>
            </div>

            {draft && (
                <div className="rounded-xl border border-primary/30 bg-primary/[0.04]">
                    <header className="flex items-center gap-2 border-b border-primary/20 px-5 py-3">
                        <Package size={14} className="text-primary" />
                        <h2 className="text-sm font-semibold">Order in progress</h2>
                        <span className="ml-auto text-[11px] font-medium text-primary">
                            {DRAFT_STAGE[draft.stage] || draft.stage}
                        </span>
                    </header>
                    <ul className="divide-y divide-border/60 px-5 text-sm">
                        {draft.items.map((item, index) => (
                            <li key={`${item.code || item.name}-${index}`} className="flex items-start justify-between gap-3 py-2.5">
                                <span>
                                    {item.name}
                                    {item.code && <small className="block text-[11px] text-muted-foreground">{item.code}</small>}
                                </span>
                                <span className="whitespace-nowrap text-muted-foreground">
                                    {item.quantity} × {money(item.unitPrice, item.currency)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-primary/20 px-5 py-3 text-sm font-semibold">
                        <span>Subtotal</span>
                        <span>{money(draft.total, draft.items[0]?.currency || "BDT")}</span>
                    </div>
                    {(draft.fullName || draft.phone || draft.address) && (
                        <p className="border-t border-primary/20 px-5 py-3 text-xs text-muted-foreground">
                            {[draft.fullName, draft.phone, draft.address].filter(Boolean).join(" · ")}
                        </p>
                    )}
                </div>
            )}

            <div className="rounded-xl border border-border bg-card">
                <header className="flex items-center gap-2 border-b border-border px-5 py-3">
                    <ShoppingBag size={14} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Recent orders</h2>
                </header>
                {recentOrders.length ? (
                    <ul className="divide-y divide-border">
                        {recentOrders.map((order) => (
                            <li key={order._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{order.orderNumber}</p>
                                    <small className="block text-[11px] text-muted-foreground">
                                        {order.items} item{order.items === 1 ? "" : "s"} · {format(new Date(order.createdAt), "MMM d, yyyy")}
                                    </small>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{money(order.total, order.currency)}</p>
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${ORDER_TONE[order.status] || "bg-muted text-muted-foreground"}`}>
                                        {order.status}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No orders yet from this customer.</p>
                )}
            </div>
        </section>
    );
}
