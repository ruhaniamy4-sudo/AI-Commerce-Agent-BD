"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * The two console actions that need more than a yes or no.
 *
 * Both used to be a run of `prompt()` boxes: the operator typed a status into a
 * free-text field that was then upper-cased and hoped for, and a mistyped amount
 * was only caught by the server. A form can show the current values, offer the
 * choices that actually exist, and refuse to submit what the server would reject.
 */

const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "CANCELLED", "SUSPENDED"] as const;
const BILLING_PERIODS = ["monthly", "annual", "custom"] as const;
const ADJUSTMENT_TYPES = ["ADJUSTMENT", "REFUND"] as const;

export interface SubscriptionValues {
    status: string;
    plan: string;
    billingPeriod: string;
    price: number;
    reason: string;
}

export interface BillingValues {
    amount: number;
    type: string;
    reason: string;
    isTest: boolean;
}

const fieldClass =
    "mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-hidden focus:border-primary";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block text-xs font-medium text-muted-foreground">
            {label}
            {children}
            {hint && <span className="mt-1 block text-[11px] font-normal text-muted-foreground/80">{hint}</span>}
        </label>
    );
}

export function SubscriptionDialog({
    open,
    onOpenChange,
    businessName,
    current,
    pending,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    current?: { status?: string; plan?: string; billingPeriod?: string; price?: number; currency?: string } | null;
    pending?: boolean;
    onSubmit: (values: SubscriptionValues) => void;
}) {
    const [status, setStatus] = useState("TRIAL");
    const [plan, setPlan] = useState("Starter");
    const [billingPeriod, setBillingPeriod] = useState("monthly");
    const [price, setPrice] = useState("0");
    const [reason, setReason] = useState("");

    // Reopening shows where the subscription stands now, not the last edit.
    useEffect(() => {
        if (!open) return;
        setStatus(current?.status || "TRIAL");
        setPlan(current?.plan || "Starter");
        setBillingPeriod(current?.billingPeriod || "monthly");
        setPrice(String(current?.price ?? 0));
        setReason("");
    }, [open, current]);

    const amount = Number(price);
    const priceValid = Number.isFinite(amount) && amount >= 0;
    const valid = Boolean(plan.trim()) && priceValid && reason.trim().length >= 3;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Change subscription</DialogTitle>
                    <DialogDescription>
                        {businessName}. Every change is recorded against this business with your reason.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!valid) return;
                        onSubmit({ status, plan: plan.trim(), billingPeriod, price: amount, reason: reason.trim() });
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Status">
                            <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                                {SUBSCRIPTION_STATUSES.map((value) => (
                                    <option key={value} value={value}>{value.replace("_", " ")}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Billing period">
                            <select className={fieldClass} value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value)}>
                                {BILLING_PERIODS.map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Plan">
                            <input className={fieldClass} value={plan} onChange={(event) => setPlan(event.target.value)} />
                        </Field>
                        <Field label={`Price (${current?.currency || "BDT"})`}>
                            <input
                                className={fieldClass}
                                type="number"
                                min={0}
                                step="1"
                                value={price}
                                onChange={(event) => setPrice(event.target.value)}
                            />
                        </Field>
                    </div>
                    <Field label="Reason" hint="Kept in the audit log. At least a few words.">
                        <textarea
                            rows={2}
                            className={`${fieldClass} h-auto resize-none py-2`}
                            value={reason}
                            placeholder="Why this subscription is changing"
                            onChange={(event) => setReason(event.target.value)}
                        />
                    </Field>
                    {status === "CANCELLED" && (
                        <p className="rounded-lg bg-destructive/10 p-3 text-xs leading-5 text-destructive">
                            Saving this cancels the subscription. You will be asked to confirm once more.
                        </p>
                    )}
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={!valid || pending}>
                            {pending ? "Saving…" : "Save subscription"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function BillingAdjustmentDialog({
    open,
    onOpenChange,
    businessName,
    currency = "BDT",
    pending,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    businessName: string;
    currency?: string;
    pending?: boolean;
    onSubmit: (values: BillingValues) => void;
}) {
    const [amount, setAmount] = useState("");
    const [type, setType] = useState<string>("ADJUSTMENT");
    const [reason, setReason] = useState("");
    // Every adjustment used to be filed as a test whether it was one or not.
    const [isTest, setIsTest] = useState(true);

    useEffect(() => {
        if (!open) return;
        setAmount("");
        setType("ADJUSTMENT");
        setReason("");
        setIsTest(true);
    }, [open]);

    const value = Number(amount);
    const amountValid = amount.trim() !== "" && Number.isFinite(value) && value >= 0;
    const valid = amountValid && reason.trim().length >= 3;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manual billing adjustment</DialogTitle>
                    <DialogDescription>
                        {businessName}. This books a paid transaction by hand and is recorded against your operator account.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!valid) return;
                        onSubmit({ amount: value, type, reason: reason.trim(), isTest });
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={`Amount (${currency})`}>
                            <input
                                className={fieldClass}
                                type="number"
                                min={0}
                                step="1"
                                value={amount}
                                placeholder="0"
                                onChange={(event) => setAmount(event.target.value)}
                            />
                        </Field>
                        <Field label="Type">
                            <select className={fieldClass} value={type} onChange={(event) => setType(event.target.value)}>
                                {ADJUSTMENT_TYPES.map((option) => (
                                    <option key={option} value={option}>
                                        {option === "REFUND" ? "Refund" : "Adjustment"}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <Field label="Reason" hint="Kept in the audit log. At least a few words.">
                        <textarea
                            rows={2}
                            className={`${fieldClass} h-auto resize-none py-2`}
                            value={reason}
                            placeholder="Why this adjustment is being booked"
                            onChange={(event) => setReason(event.target.value)}
                        />
                    </Field>
                    <label className="flex items-start gap-2.5 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                        <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={isTest}
                            onChange={(event) => setIsTest(event.target.checked)}
                        />
                        <span>
                            Record as a test transaction
                            <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                                Leave this on unless the money really moved. Test transactions are kept out of revenue reporting.
                            </span>
                        </span>
                    </label>
                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={!valid || pending}>
                            {pending ? "Recording…" : "Record adjustment"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
