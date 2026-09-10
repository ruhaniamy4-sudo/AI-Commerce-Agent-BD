"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ArrowRight, ShieldCheck } from "lucide-react";
import { businessApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function OnboardingPaymentStep({ onContinue }: { onContinue: () => void }) {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["business-profile"], queryFn: businessApi.get });
  const [methods, setMethods] = useState<string[]>([]);
  useEffect(() => { if (profile.data) setMethods(profile.data.commerce?.paymentMethods || []); }, [profile.data]);
  const save = useMutation({
    mutationFn: async () => {
      const commerce = profile.data?.commerce;
      if (!commerce) throw new Error("Open Business Settings to configure ordering before saving payment preferences.");
      return businessApi.updateCommerce({ ...commerce, paymentMethods: methods });
    },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["business-profile"] }); onContinue(); },
  });
  return <section className="mx-auto max-w-3xl rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
    <CreditCard className="mb-5 h-10 w-10 rounded-xl bg-primary/10 p-2 text-primary" />
    <p className="sp-eyebrow">Payment preferences</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Make the next step clear for customers.</h1>
    <p className="mt-4 text-sm leading-7 text-muted-foreground">Tell your AI which payment methods your business accepts. This controls your ordering preferences; it does not charge you or connect an online gateway.</p>
    {profile.isLoading ? <p role="status" className="py-6">Loading saved preferences…</p> : profile.isError ? <div role="alert" className="py-6"><p>Payment preferences could not be loaded.</p><Button variant="outline" onClick={() => profile.refetch()}>Try again</Button></div> : <fieldset className="my-6 space-y-3"><legend className="mb-3 text-sm font-semibold">Accepted payment methods</legend>
      {[...new Set(["Cash on Delivery", "bKash", ...(profile.data?.commerce?.paymentMethods || [])])].map(method => <label key={method} className="flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm"><input type="checkbox" checked={methods.includes(method)} onChange={event => setMethods(current => event.target.checked ? [...current, method] : current.filter(value => value !== method))} /><span>{method}{method === "bKash" && <small className="mt-1 block text-muted-foreground">Payment preference only. Automatic payment verification is not connected.</small>}</span></label>)}
    </fieldset>}
    <div className="flex gap-3 rounded-xl bg-primary/5 p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><p>Your SellPilot subscription is managed separately in Billing & Plan. Revisit these business preferences in Settings at any time.</p></div>
    {save.isError && <p role="alert" className="mt-4 text-sm text-destructive">{save.error.message}</p>}
    <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => save.mutate()} disabled={!profile.data?.commerce || !methods.length || save.isPending}>{save.isPending ? "Saving…" : "Save & import products"}<ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="ghost" onClick={onContinue} disabled={save.isPending}>Set up later</Button></div>
  </section>;
}
