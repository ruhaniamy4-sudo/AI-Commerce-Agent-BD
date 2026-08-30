"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "@/lib/platform-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["platform-business", id],
    queryFn: () => platformApi.business(id),
  });
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["platform-business", id] });
  const requireData = () => {
    if (!data) throw new Error("Business details are still loading");
    return data;
  };
  const businessStatus = useMutation({
    mutationFn: async () => {
      const current = requireData();
      const next = current.business.status === "active" ? "suspended" : "active";
      if (
        !confirm(
          `${next === "suspended" ? "Suspend" : "Reactivate"} ${current.business.name}?`,
        )
      )
        throw new Error("Cancelled");
      const reason = prompt("Reason (required)")?.trim();
      if (!reason) throw new Error("Reason required");
      return platformApi.setBusinessStatus(id, next, reason);
    },
    onSuccess: refresh,
  });
  const ai = useMutation({
    mutationFn: async () => {
      const current = requireData();
      const suspended =
        current.business.aiAccess?.status === "SUSPENDED_BY_PLATFORM";
      if (
        !confirm(
          `${suspended ? "Resume" : "Suspend"} AI for ${current.business.name}?`,
        )
      )
        throw new Error("Cancelled");
      const reason = prompt("Reason (required)")?.trim();
      if (!reason) throw new Error("Reason required");
      return platformApi.setAIStatus(
        id,
        suspended ? "ENABLED" : "SUSPENDED_BY_PLATFORM",
        reason,
      );
    },
    onSuccess: refresh,
  });
  const subscription = useMutation({
    mutationFn: async () => {
      const current = requireData();
      const reason = prompt("Reason for subscription change")?.trim();
      if (!reason) throw new Error("Reason required");
      const status = prompt(
        "Status: TRIAL, ACTIVE, PAST_DUE, EXPIRED, CANCELLED, SUSPENDED",
        current.subscription?.status || "TRIAL",
      )
        ?.trim()
        .toUpperCase();
      if (!status) throw new Error("Status required");
      if (
        status === "CANCELLED" &&
        !confirm(`Cancel ${current.business.name}'s subscription?`)
      )
        throw new Error("Cancelled");
      return platformApi.setSubscription(id, {
        reason,
        status,
        plan: current.subscription?.plan || "Starter",
        billingPeriod: current.subscription?.billingPeriod || "monthly",
        price: current.subscription?.price || 0,
        currency: current.subscription?.currency || "BDT",
        eventType: current.subscription ? "STATUS_CHANGE" : "START",
        startedAt: current.subscription?.startedAt || new Date().toISOString(),
      });
    },
    onSuccess: refresh,
  });
  const billing = useMutation({
    mutationFn: async () => {
      const current = requireData();
      if (
        !confirm(
          `Record a manual billing adjustment for ${current.business.name}?`,
        )
      )
        throw new Error("Cancelled");
      const amount = Number(prompt("Amount in BDT"));
      const type = prompt("Type: ADJUSTMENT or REFUND", "ADJUSTMENT")
        ?.trim()
        .toUpperCase();
      const reason = prompt("Reason (required)")?.trim();
      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        !reason ||
        !["ADJUSTMENT", "REFUND"].includes(type || "")
      )
        throw new Error("Valid amount, type, and reason required");
      return platformApi.adjustBilling({
        businessId: id,
        amount,
        type,
        reason,
        currency: "BDT",
        isTest: true,
      });
    },
    onSuccess: refresh,
  });
  if (isLoading || !data) return <p>Loading business…</p>;
  const b = data.business;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{b.name}</h1>
          <p className="text-slate-400">
            {b.businessType || "Unspecified"} · created{" "}
            {new Date(b.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => businessStatus.mutate()}>
            {b.status === "active" ? "Suspend business" : "Reactivate business"}
          </Button>
          <Button variant="outline" onClick={() => ai.mutate()}>
            {b.aiAccess?.status === "SUSPENDED_BY_PLATFORM"
              ? "Resume AI"
              : "Suspend AI"}
          </Button>
          <Button variant="outline" onClick={() => subscription.mutate()}>
            Change subscription
          </Button>
          <Button variant="outline" onClick={() => billing.mutate()}>
            Manual billing adjustment
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Business status" value={b.status} />
        <Metric label="AI status" value={b.aiAccess?.status || "ENABLED"} />
        <Metric
          label="Plan"
          value={data.subscription?.plan || "Not configured"}
        />
        <Metric
          label="Subscription"
          value={data.subscription?.status || "Not configured"}
        />
        <Metric
          label="Recorded revenue"
          value={`${Number(data.revenue.revenue || 0).toLocaleString()} BDT`}
        />
        <Metric label="AI requests" value={data.aiUsage.requests || 0} />
        <Metric
          label="Tracked AI cost"
          value={
            data.aiUsage.unknown
              ? "Partially unavailable"
              : `$${Number(data.aiUsage.knownCost || 0).toFixed(4)}`
          }
        />
        <Metric
          label="Last activity"
          value={
            data.lastActivity
              ? new Date(data.lastActivity).toLocaleString()
              : "Never recorded"
          }
        />
      </div>
      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle>Business data</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          {Object.entries(data.counts).map(([key, value]) => (
            <Metric key={key} label={key} value={value as number} />
          ))}
        </CardContent>
      </Card>
      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle>Owner and team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.members.map((m) => (
            <div
              key={m.user.id}
              className="flex justify-between rounded border border-slate-800 p-3"
            >
              <span>
                {m.user.name} · {m.user.email}
              </span>
              <span>
                <Badge>{m.role}</Badge>{" "}
                <Badge variant="secondary">{m.user.status}</Badge>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle>Integration and training health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.integrations.channels.map((x) => (
            <p key={x._id}>
              Channel: {x.platform} · {x.name} · {x.status}
            </p>
          ))}
          {data.integrations.couriers.map((x) => (
            <p key={x._id}>
              Courier: {x.provider} · {x.status}
              {x.lastErrorCode ? ` · ${x.lastErrorCode}` : ""}
            </p>
          ))}
          {data.integrations.training.map((x) => (
            <p key={x._id}>
              Training: {x.type} · {x.status} · products{" "}
              {x.stats?.products || 0} · knowledge {x.stats?.knowledge || 0} ·
              needs review {x.stats?.needsAttention || 0}
            </p>
          ))}
          {!data.integrations.channels.length &&
            !data.integrations.couriers.length &&
            !data.integrations.training.length && (
              <p className="text-slate-400">No integrations configured.</p>
            )}
        </CardContent>
      </Card>
      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader>
          <CardTitle>Subscription history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.subscriptionHistory.map((x) => (
            <p key={x._id}>
              {new Date(x.createdAt).toLocaleString()} · {x.type} · {x.reason}
            </p>
          ))}
          {!data.subscriptionHistory.length && (
            <p className="text-slate-400">No subscription history.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs capitalize text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
