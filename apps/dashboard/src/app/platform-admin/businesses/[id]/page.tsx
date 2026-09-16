"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformApi } from "@/lib/platform-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  BillingAdjustmentDialog,
  SubscriptionDialog,
  type BillingValues,
  type SubscriptionValues,
} from "./action-dialogs";
export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
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
      const reason = await confirm({
        title: `${next === "suspended" ? "Suspend" : "Reactivate"} ${current.business.name}?`,
        description:
          next === "suspended"
            ? "The team loses access to this workspace until it is reactivated."
            : "The team gets access to this workspace again.",
        confirmLabel: next === "suspended" ? "Suspend business" : "Reactivate business",
        tone: next === "suspended" ? "danger" : "neutral",
        reason: { label: "Reason (kept in the audit log)", placeholder: "Why this is happening" },
      });
      if (!reason) throw new Error("Cancelled");
      return platformApi.setBusinessStatus(id, next, reason);
    },
    onSuccess: refresh,
  });
  const ai = useMutation({
    mutationFn: async () => {
      const current = requireData();
      const suspended =
        current.business.aiAccess?.status === "SUSPENDED_BY_PLATFORM";
      const reason = await confirm({
        title: `${suspended ? "Resume" : "Suspend"} AI for ${current.business.name}?`,
        description: "This affects future automated replies only; nothing already sent changes.",
        confirmLabel: suspended ? "Resume AI" : "Suspend AI",
        tone: suspended ? "neutral" : "danger",
        reason: { label: "Reason (kept in the audit log)", placeholder: "Why this is happening" },
      });
      if (!reason) throw new Error("Cancelled");
      return platformApi.setAIStatus(
        id,
        suspended ? "ENABLED" : "SUSPENDED_BY_PLATFORM",
        reason,
      );
    },
    onSuccess: refresh,
  });
  const subscription = useMutation({
    mutationFn: async (values: SubscriptionValues) => {
      const current = requireData();
      // Cancelling ends their plan, so it is the one change that asks twice.
      if (
        values.status === "CANCELLED" &&
        !(await confirm({
          title: `Cancel ${current.business.name}'s subscription?`,
          description: "Their plan moves to cancelled and the change is recorded against this business.",
          confirmLabel: "Cancel subscription",
        }))
      )
        throw new Error("Cancelled");
      return platformApi.setSubscription(id, {
        ...values,
        currency: current.subscription?.currency || "BDT",
        eventType: current.subscription ? "STATUS_CHANGE" : "START",
        startedAt: current.subscription?.startedAt || new Date().toISOString(),
      });
    },
    onSuccess: () => {
      setSubscriptionOpen(false);
      refresh();
    },
  });
  const billing = useMutation({
    mutationFn: async (values: BillingValues) => {
      const current = requireData();
      // Booking money by hand against a real account is worth one last look.
      if (
        !values.isTest &&
        !(await confirm({
          title: `Book a real ${values.type === "REFUND" ? "refund" : "adjustment"} of ${values.amount} BDT?`,
          description: `This is recorded against ${current.business.name} as a paid transaction and counts towards revenue.`,
          confirmLabel: "Book it",
          tone: "warning",
        }))
      )
        throw new Error("Cancelled");
      return platformApi.adjustBilling({
        businessId: id,
        ...values,
        currency: "BDT",
      });
    },
    onSuccess: () => {
      setBillingOpen(false);
      refresh();
    },
  });
  if (isLoading || !data) return <p>Loading business…</p>;
  const b = data.business;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{b.name}</h1>
          <p className="text-[color:var(--pa-muted)]">
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
          <Button variant="outline" onClick={() => setSubscriptionOpen(true)}>
            Change subscription
          </Button>
          <Button variant="outline" onClick={() => setBillingOpen(true)}>
            Manual billing adjustment
          </Button>
        </div>
      </div>
      <SubscriptionDialog
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
        businessName={b.name}
        current={data.subscription}
        pending={subscription.isPending}
        onSubmit={(values) => subscription.mutate(values)}
      />
      <BillingAdjustmentDialog
        open={billingOpen}
        onOpenChange={setBillingOpen}
        businessName={b.name}
        currency={data.subscription?.currency || "BDT"}
        pending={billing.isPending}
        onSubmit={(values) => billing.mutate(values)}
      />
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
      <Card className="border-[color:var(--pa-line)] bg-[color:var(--pa-panel)] text-[color:var(--pa-text)]">
        <CardHeader>
          <CardTitle>Business data</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          {Object.entries(data.counts).map(([key, value]) => (
            <Metric key={key} label={key} value={value as number} />
          ))}
        </CardContent>
      </Card>
      <Card className="border-[color:var(--pa-line)] bg-[color:var(--pa-panel)] text-[color:var(--pa-text)]">
        <CardHeader>
          <CardTitle>Owner and team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.members.map((m) => (
            <div
              key={m.user.id}
              className="flex justify-between rounded border border-[color:var(--pa-line)] p-3"
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
      <Card className="border-[color:var(--pa-line)] bg-[color:var(--pa-panel)] text-[color:var(--pa-text)]">
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
              <p className="text-[color:var(--pa-muted)]">No integrations configured.</p>
            )}
        </CardContent>
      </Card>
      <Card className="border-[color:var(--pa-line)] bg-[color:var(--pa-panel)] text-[color:var(--pa-text)]">
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
            <p className="text-[color:var(--pa-muted)]">No subscription history.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[color:var(--pa-line)] bg-[color:var(--pa-bg)] p-4">
      <p className="text-xs capitalize text-[color:var(--pa-muted)]">{label}</p>
      <p className="mt-1 font-semibold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
