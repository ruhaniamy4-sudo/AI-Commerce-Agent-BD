"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspacePanel, WorkspaceSearch, WorkspacePagination, WorkspaceEmpty } from "@/components/layout/workspace-surface";
import { Button } from "@/components/ui/button";
import { ChannelBadge, HandlerBadge } from "@/components/conversations/channel-badge";
import { ArrowDownAZ, ArrowUpAZ, ArrowUpRight } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

const CHANNEL_TABS = [
    { key: "all", label: "All" },
    { key: "messenger", label: "Messenger" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "web", label: "Website" },
    { key: "test", label: "Test AI" },
] as const;

const STATE_TABS = [
    { key: "all", label: "Everything" },
    { key: "needs_attention", label: "Needs you" },
    { key: "human", label: "You are replying" },
    { key: "ai", label: "AI is handling" },
] as const;

type ChannelKey = (typeof CHANNEL_TABS)[number]["key"];
type StateKey = (typeof STATE_TABS)[number]["key"];

export default function ConversationsPage() {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("lastMessageAt");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [channel, setChannel] = useState<ChannelKey>("all");
    const [state, setState] = useState<StateKey>("all");

    const { data: response, isLoading, error, refetch } = useQuery({
        queryKey: ["conversations", page, searchQuery, sortBy, order, channel, state],
        queryFn: () => conversationsApi.getAll({ page, limit: 12, search: searchQuery, sortBy, order, channel, state }),
        // A merchant inbox is only useful if it keeps up with the customer.
        refetchInterval: 15_000,
    });

    const conversations = response?.data;
    const pagination = response?.pagination;
    const counts = response?.counts;

    function sort(key: string) {
        setSortBy(key);
        setOrder(sortBy === key ? (order === "asc" ? "desc" : "asc") : "desc");
        setPage(1);
    }

    function pick<T>(setter: (value: T) => void, value: T) {
        setter(value);
        setPage(1);
    }

    return (
        <div>
            <PageHeader
                title="Conversations"
                description="Every channel in one inbox. See what was said, and decide who takes the next step."
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
                {CHANNEL_TABS.map((tab) => {
                    const count = counts?.[tab.key];
                    return (
                        <Button
                            key={tab.key}
                            size="sm"
                            variant={channel === tab.key ? "default" : "outline"}
                            onClick={() => pick(setChannel, tab.key)}
                        >
                            {tab.label}
                            {typeof count === "number" && <span className="ml-2 opacity-70">{count}</span>}
                        </Button>
                    );
                })}
                {Boolean(counts?.needsAttention) && state !== "needs_attention" && (
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => pick(setState, "needs_attention")}>
                        {counts?.needsAttention} waiting for you
                    </Button>
                )}
            </div>

            <WorkspacePanel
                title="Your inbox"
                description={`${pagination?.total || 0} ${channel === "all" ? "customer conversations" : `${CHANNEL_TABS.find((tab) => tab.key === channel)?.label} conversations`}`}
                actions={
                    <>
                        <div className="flex flex-wrap gap-1">
                            {STATE_TABS.map((tab) => (
                                <Button
                                    key={tab.key}
                                    size="sm"
                                    variant={state === tab.key ? "secondary" : "ghost"}
                                    onClick={() => pick(setState, tab.key)}
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            {[["lastMessageAt", "Recent"], ["messageCount", "Most messages"]].map(([key, label]) => (
                                <Button key={key} size="sm" variant={sortBy === key ? "secondary" : "ghost"} onClick={() => sort(key)}>
                                    {label}
                                    {sortBy === key && (order === "desc" ? <ArrowDownAZ size={13} className="ml-2" /> : <ArrowUpAZ size={13} className="ml-2" />)}
                                </Button>
                            ))}
                        </div>
                        <WorkspaceSearch value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search customer, number or message" />
                    </>
                }
            >
                {isLoading ? (
                    <p role="status" className="p-12 text-center text-sm text-muted-foreground">Loading conversations…</p>
                ) : error ? (
                    <WorkspaceEmpty
                        title="We couldn’t load your inbox."
                        copy="Check your connection and try again."
                        action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}
                    />
                ) : conversations?.length ? (
                    <div className="work-table-scroll">
                        <table className="work-table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Channel</th>
                                    <th>Latest message</th>
                                    <th>Handled by</th>
                                    <th>Activity</th>
                                    <th>Messages</th>
                                    <th><span className="sr-only">Open conversation</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {conversations.map((c) => {
                                    const name = c.customer?.name || "Unnamed customer";
                                    const identity = c.customer?.phone || c.psid || "No contact saved";
                                    return (
                                        <tr key={c._id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <span className="grid w-9 h-9 place-items-center bg-primary/10 text-primary rounded-full text-xs shrink-0">
                                                        {name.slice(0, 2).toUpperCase()}
                                                    </span>
                                                    <div>
                                                        <Link href={`/conversations/${c._id}`} className="font-semibold hover:text-primary">{name}</Link>
                                                        <small>{identity}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><ChannelBadge channel={c.channel} /></td>
                                            <td><p className="work-message-preview">{c.lastMessage}</p></td>
                                            <td><HandlerBadge controlMode={c.controlMode} needsHumanHandoff={c.needsHumanHandoff} /></td>
                                            <td className="whitespace-nowrap" title={format(new Date(c.lastMessageAt || c.updatedAt), "PPpp")}>
                                                {formatDistanceToNowStrict(new Date(c.lastMessageAt || c.updatedAt), { addSuffix: true })}
                                            </td>
                                            <td><span className="work-status">{c.messageCount || 0}</span></td>
                                            <td>
                                                <Link
                                                    className="inline-flex p-2 rounded-lg hover:bg-primary/10 text-primary"
                                                    href={`/conversations/${c._id}`}
                                                    aria-label={`Open conversation with ${name}`}
                                                >
                                                    <ArrowUpRight size={16} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <WorkspaceEmpty
                        title={channel === "all" ? "Your next conversation starts here." : `No ${CHANNEL_TABS.find((tab) => tab.key === channel)?.label} conversations yet.`}
                        copy={channel === "all"
                            ? "Customer messages from Messenger, WhatsApp and your website will appear here."
                            : "Connect this channel in Settings → Integrations, and its threads will land in this inbox."}
                    />
                )}
                <WorkspacePagination page={page} totalPages={pagination?.totalPages || 1} onChange={setPage} />
            </WorkspacePanel>
        </div>
    );
}
