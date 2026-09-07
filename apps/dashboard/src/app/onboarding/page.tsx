"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { onboardingApi } from "@/lib/api";
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
  const { data: session, update } = useSession();
  const router = useRouter();
  const [businessCreated, setBusinessCreated] = useState(
    Boolean(session?.businessId),
  );
  const [busy, setBusy] = useState(false);
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
    await onboardingApi.complete();
    await update({ onboardingComplete: true });
    router.push("/assistant");
    router.refresh();
  }
  if (businessCreated) return <main className="min-h-screen bg-background p-4 md:p-10"><TrainingWorkspace onboarding onFinish={finish} /></main>;
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
