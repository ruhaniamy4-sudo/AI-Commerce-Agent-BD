'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import {DashboardProductOverview} from '@/components/products/dashboard-product-overview';
import {PageHeader} from '@/components/layout/page-header';
import {WorkspacePanel,WorkspaceEmpty} from '@/components/layout/workspace-surface';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bot, CheckCircle2, MessageSquare, Package, ShoppingCart, Sparkles, Users, WalletCards } from 'lucide-react';

export default function Overview() {
  const { data, isLoading, error } = useQuery({ queryKey: ['merchant-overview'], queryFn: dashboardApi.overview });
  if (isLoading) return <div className="data-panel grid min-h-72 place-items-center"><p className="text-sm font-semibold text-muted-foreground">Preparing your business overview…</p></div>;
  if (error || !data) return <div className="data-panel p-8"><p className="workspace-kicker">Connection status</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight">Overview unavailable</h1><p className="mt-2 text-muted-foreground">The agent API or database is not available yet.</p></div>;

  const cards = [
    { label: 'Conversations', value: data.conversations, Icon: MessageSquare, note: 'Customer threads' },
    { label: 'Customers', value: data.customers, Icon: Users, note: 'Known contacts' },
    { label: 'Pending orders', value: data.orders.pending || 0, Icon: Package, note: 'Need attention' },
    { label: 'Revenue', value: `৳${data.revenue.toLocaleString()}`, Icon: WalletCards, note: 'Recorded sales' },
    { label: 'Active products', value: data.products, Icon: ShoppingCart, note: 'Ready to sell' },
    { label: 'AI requests · 30d', value: data.usage.requests, Icon: Bot, note: 'Assistant activity' },
  ] as const;
  const setup = [
    ['Business profile', Boolean(data.business)], ['Product added', data.products > 0], ['Knowledge added', data.knowledge > 0],
    ['AI tested', Boolean(data.business?.onboarding?.aiTested)], ['Channel connected', data.channels.some(channel => channel.status === 'active')],
    ['Steadfast connected', data.courier === 'connected'],
  ] as const;
  const completed = setup.filter(([, done]) => done).length;

return <div><PageHeader title={data.business?.name||"Your business overview"} description="A clear picture of your conversations, sales, and the work that needs attention." actions={<Button asChild><Link href="/assistant"><Sparkles size={15} className="mr-2"/>Open AI Assistant</Link></Button>}/><section className="work-metrics">{cards.map(({label,value,note})=><article className="work-metric" key={label}><p>{label}</p><strong>{typeof value==="number"?value.toLocaleString():value}</strong><small>{note}</small></article>)}</section><DashboardProductOverview/><section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]"><WorkspacePanel title="Recent orders" description="The latest activity in your business" actions={<Button asChild variant="ghost" size="sm"><Link href="/orders">View orders<ArrowRight size={13} className="ml-2"/></Link></Button>}>{data.recentOrders.length?<div className="work-table-scroll"><table className="work-table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.recentOrders.map(order=><tr key={order._id}><td><Link className="font-semibold hover:text-primary" href="/orders">{order.orderNumber}</Link></td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td>৳{order.total.toLocaleString()}</td><td><span className="work-status">{order.status}</span></td></tr>)}</tbody></table></div>:<WorkspaceEmpty title="Your first order is ahead." copy="New orders will appear here when customers complete a purchase."/>}</WorkspacePanel><div className="space-y-5"><article className="sp-dark relative overflow-hidden rounded-xl p-6"><div className="sp-atmos" aria-hidden="true"/><div className="relative"><p className="sp-eyebrow">SellPilot AI</p><div className="flex justify-between items-end mt-5"><h2 className="text-2xl capitalize">{data.agentStatus}</h2><Bot size={30} className="text-[#a88ad8]"/></div><p className="sp-copy !text-xs mt-4">{data.humanControlled>0?`${data.humanControlled} conversations are currently controlled by your team.`:"Your team can take over a conversation whenever needed."}</p><Link href="/assistant" className="flex justify-between text-xs text-[#c4a7ef] mt-6 border-t border-white/10 pt-5">Open AI Assistant<ArrowRight size={14}/></Link></div></article><WorkspacePanel title="Workspace readiness" description={`${completed} of ${setup.length} steps complete`}><div className="p-5"><div className="h-1.5 bg-muted rounded-full overflow-hidden mb-5"><div className="h-full bg-[#8054f6] rounded-full transition-all" style={{width:`${completed/setup.length*100}%`}}/></div><ul className="space-y-3">{setup.map(([label,done])=><li key={label} className="flex justify-between items-center gap-3 text-xs"><span className={done?"text-foreground":"text-muted-foreground"}>{label}</span>{done?<CheckCircle2 size={15} className="text-emerald-500"/>:<span className="w-3.5 h-3.5 rounded-full border border-border"/>}</li>)}</ul><Button asChild variant="outline" size="sm" className="w-full mt-6"><Link href="/training">Continue setup<ArrowRight size={13} className="ml-2"/></Link></Button></div></WorkspacePanel></div></section></div>;
}
