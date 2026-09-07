"use client";

import { PageHeader } from "@/components/layout/page-header";
import { analyticsApi } from "@/lib/api";
import { type AnalyticsResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Lightbulb,
  Loader2,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#7c3aed", "#4f46e5", "#06b6d4", "#10b981", "#f59e0b"];

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: analyticsApi.get,
    staleTime: 5 * 60 * 1000,
  });
  if (isLoading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-3xl py-16">
        <div className="data-panel p-8 text-center">
          <Target className="mx-auto mb-4 h-9 w-9 text-rose-500" />
          <h2 className="text-xl font-bold text-foreground">
            Analytics is temporarily unavailable
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your business data is safe. Try again when the agent service is
            connected.
          </p>
        </div>
      </div>
    );

  const {
    kpi,
    funnel = [],
    growth = [],
    topProducts = [],
    poorPerformingProducts = [],
    channels = [],
    insights = [],
  } = data;
  const conversion =
    kpi.conversionRate === undefined ||
    kpi.conversionRate === null ||
    kpi.conversionRate === ""
      ? "Not tracked"
      : `${kpi.conversionRate}${String(kpi.conversionRate).includes("%") ? "" : "%"}`;
  const metrics = [
    {
      label: "Revenue",
      value: `৳${Number(kpi.revenue || 0).toLocaleString()}`,
      detail: "Recorded non-cancelled order value",
      icon: TrendingUp,
    },
    {
      label: "Customers",
      value: kpi.totalCustomers.toLocaleString(),
      detail: "People in your customer list",
      icon: Users,
    },
    {
      label: "Orders",
      value: kpi.totalOrders.toLocaleString(),
      detail: "Orders recorded by SellPilot",
      icon: ShoppingCart,
    },
    {
      label: "Pending orders",
      value: kpi.pendingOrders.toLocaleString(),
      detail: "Orders that still need action",
      icon: Activity,
    },
    {
      label: "Conversion rate",
      value: conversion,
      detail: "Available when conversion tracking is enabled",
      icon: BarChart3,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col pb-20">
      <PageHeader
        title="Business Analytics"
        description="A clear view of customers, orders, and sales activity from your connected channels."
      />
      <div className="space-y-8 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className="metric-card sp-enter">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="sp-meta">{label}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                    {value}
                  </p>
                </div>
                <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {detail}
              </p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <InsightPanel
            title="Order activity"
            description="Recorded activity over time. No estimates or projected revenue are added."
          >
            {growth.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                  data={growth}
                  margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="orderActivity"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#7c3aed"
                        stopOpacity={0.36}
                      />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 5"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#7c3aed"
                    strokeWidth={3}
                    fill="url(#orderActivity)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyInsight text="Order history will appear here as activity is recorded." />
            )}
          </InsightPanel>
          <InsightPanel
            title="Order pipeline"
            description="How recorded orders move through your business workflow."
          >
            {funnel.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={funnel}
                  layout="vertical"
                  margin={{ top: 12, right: 12, left: 18, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="stage"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={90}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "hsl(var(--primary) / .06)" }}
                  />
                  <Bar dataKey="count" radius={[0, 9, 9, 0]} barSize={28}>
                    {funnel.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyInsight text="Pipeline stages will appear when order status data is available." />
            )}
          </InsightPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <InsightPanel
            title="Top products"
            description="Products ranked by units sold."
          >
            {topProducts.length ? (
              <RankedList
                items={topProducts.map((item) => ({
                  name: item.name,
                  value: `${item.units} sold · ৳${item.revenue.toLocaleString()}`,
                }))}
              />
            ) : (
              <CompactEmpty text="Sales by product will appear after orders are recorded." />
            )}
          </InsightPanel>
          <InsightPanel
            title="Needs attention"
            description="Active products with the fewest recorded sales."
          >
            {poorPerformingProducts.length ? (
              <RankedList
                items={poorPerformingProducts.map((item) => ({
                  name: item.name,
                  value: `${item.units} sold`,
                }))}
              />
            ) : (
              <CompactEmpty text="No product performance data is available yet." />
            )}
          </InsightPanel>
          <InsightPanel
            title="Channel performance"
            description="Order value grouped by source."
          >
            {channels.length ? (
              <RankedList
                items={channels.map((item) => ({
                  name:
                    item.channel === "messenger"
                      ? "Messenger"
                      : item.channel === "web"
                        ? "Web store"
                        : item.channel === "admin"
                          ? "Manual orders"
                          : item.channel,
                  value: `${item.orders} orders · ৳${item.revenue.toLocaleString()}`,
                }))}
              />
            ) : (
              <CompactEmpty text="Channel performance will appear after orders are recorded." />
            )}
          </InsightPanel>
        </div>
        <InsightPanel
          title="AI insights"
          description="Deterministic observations from your current order and inventory data."
        >
          {insights.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((insight) => (
                <div
                  key={insight}
                  className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4"
                >
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-foreground">{insight}</p>
                </div>
              ))}
            </div>
          ) : (
            <CompactEmpty text="SellPilot will surface insights as your business records more activity." />
          )}
        </InsightPanel>
      </div>
    </div>
  );
}

function InsightPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="data-panel overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function EmptyInsight({ text }: { text: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-8 text-center">
      <BarChart3 className="mb-4 h-8 w-8 text-primary/55" />
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-sm leading-6 text-muted-foreground">
      {text}
    </p>
  );
}

function RankedList({
  items,
}: {
  items: Array<{ name: string; value: string }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/25 px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {item.name}
            </span>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-popover/95 p-4 shadow-xl backdrop-blur-xl">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex min-w-36 items-center justify-between gap-6 text-sm"
        >
          <span className="text-muted-foreground">{entry.name}</span>
          <strong className="text-foreground">
            {entry.value.toLocaleString()}
          </strong>
        </div>
      ))}
    </div>
  );
}
