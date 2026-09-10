"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { onboardingApi } from "@/lib/api";
import { OnboardingPaymentStep } from "@/components/onboarding-payment-step";
import { TrainingWorkspace } from "@/components/training/training-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthVisual } from "@/components/auth-visual";

const businessTypes = [
  ["ECOMMERCE", "Ecommerce / Online store"],
  ["VISA_CONSULTANCY", "Visa consultancy"],
  ["EDUCATION_CONSULTANCY", "Education consultancy"],
  ["EDTECH", "Education / EdTech"],
  ["AGENCY", "Agency / Professional service"],
  ["REAL_ESTATE", "Real estate"],
  ["CLINIC_SERVICE", "Clinic / Service provider"],
  ["RESTAURANT", "Restaurant / Food business"],
  ["SAAS", "Software / SaaS"],
  ["OTHER", "Other"],
] as const;

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [businessCreated, setBusinessCreated] = useState(
    Boolean(session?.businessId),
  );
  const [busy, setBusy] = useState(false);
  const [setupStage, setSetupStage] = useState<"payments" | "training">("payments");
  const [finishing, setFinishing] = useState(false);
  useEffect(() => { if (session?.businessId) setBusinessCreated(true); }, [session?.businessId]);
  const [error, setError] = useState("");
  const [business, setBusiness] = useState({
    name: "",
    businessType: "",
    description: "",
    phone: "",
    preferredLanguage: "bn",
  });
  const [trialContext, setTrialContext] = useState<Record<
    string,
    unknown
  > | null>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("sellpilot:pending-trial");
      if (!saved) return;
      const parsed = JSON.parse(saved) as Record<string, unknown>;
      setTrialContext(parsed);
      setBusiness((current) => ({
        ...current,
        name:
          typeof parsed.businessName === "string"
            ? parsed.businessName
            : current.name,
        businessType:
          typeof parsed.businessType === "string"
            ? parsed.businessType
            : current.businessType,
        description:
          typeof parsed.salesChannel === "string"
            ? `Primary sales channel: ${parsed.salesChannel}`
            : current.description,
      }));
    } catch {
      sessionStorage.removeItem("sellpilot:pending-trial");
    }
  }, []);
  async function createBusiness() {
    setBusy(true);
    setError("");
    try {
      const result = await onboardingApi.createBusiness({
        ...business,
        trialContext,
      });
      await update({
        accessToken: result.accessToken,
        accountToken: undefined,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        needsOnboarding: false,
        businessId: result.business.id,
        businessName: result.business.name,
        role: result.role,
        onboardingComplete: false,
      });
      sessionStorage.removeItem("sellpilot:pending-trial");
      setBusinessCreated(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create your business.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setFinishing(true);
    setError("");
    try {
      await onboardingApi.complete();
      await update({ onboardingComplete: true });
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not finish setup. Your saved work is preserved.");
    } finally { setFinishing(false); }
  }
  if (status === "loading") return <main className="grid min-h-screen place-items-center"><p role="status">Opening your workspace setup…</p></main>;
  if (businessCreated) return <main className="min-h-screen bg-background p-4 md:p-10"><div className="mx-auto max-w-7xl space-y-6">
    <nav aria-label="Onboarding progress" className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4 text-sm">
      <span className="rounded-lg bg-primary/10 px-3 py-2 text-primary">✓ Business details</span>
      <button onClick={() => setSetupStage("payments")} aria-current={setupStage === "payments" ? "step" : undefined} className="rounded-lg border px-3 py-2">1 · Payment preferences</button>
      <button onClick={() => setSetupStage("training")} aria-current={setupStage === "training" ? "step" : undefined} className="rounded-lg border px-3 py-2">2 · Product import & AI training</button>
      <span className="px-3 py-2 text-muted-foreground">3 · Dashboard ready</span>
    </nav>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-destructive">{error}</p>}
    {setupStage === "payments" ? <OnboardingPaymentStep onContinue={() => setSetupStage("training")} /> : <div aria-busy={finishing}><TrainingWorkspace onboarding onFinish={finishing ? undefined : finish} /></div>}
  </div></main>;
  return <main className="auth-reset">
    <AuthVisual mode="signup" />
    <section className="auth-reset-form"><div>
      <p className="sp-eyebrow">Step 1 · Business basics</p>
      <h1>Make it yours.</h1>
      <p className="auth-copy">Start with your business details. Next, connect your sources and review what SellPilot learns.</p>
      <form onSubmit={(event) => { event.preventDefault(); void createBusiness(); }} className="space-y-5">
        {error && <p role="alert" className="auth-error">{error}</p>}
        <label>Business name<Input required minLength={2} value={business.name} onChange={(event) => setBusiness({ ...business, name: event.target.value })} /></label>
        <label>Business type<select required className="sp-field" value={business.businessType} onChange={(event) => setBusiness({ ...business, businessType: event.target.value })}><option value="">Choose your business type</option>{businessTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Short description <span className="font-normal">(optional)</span><textarea className="sp-field min-h-24" value={business.description} onChange={(event) => setBusiness({ ...business, description: event.target.value })} /></label>
        <label>Support phone <span className="font-normal">(optional)</span><Input type="tel" value={business.phone} onChange={(event) => setBusiness({ ...business, phone: event.target.value })} /></label>
        <label>Preferred language<select className="sp-field" value={business.preferredLanguage} onChange={(event) => setBusiness({ ...business, preferredLanguage: event.target.value })}><option value="bn">Bangla / Banglish</option><option value="en">English</option></select></label>
        <Button className="w-full" disabled={busy || business.name.trim().length < 2 || !business.businessType.trim()}>{busy ? 'Creating workspace…' : 'Continue to sources'}</Button>
      </form>
    </div></section>
  </main>;
}
