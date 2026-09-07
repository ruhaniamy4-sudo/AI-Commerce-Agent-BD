"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrandVoiceProfile,
  businessApi,
  BusinessProfile,
  CommerceSettings,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/components/layout/settings-section";
import { PageHeader } from "@/components/layout/page-header";

const voiceDefaults: BrandVoiceProfile = {
  tone: "friendly",
  replyLength: "balanced",
  language: "auto",
  salesBehavior: "balanced",
  emoji: "light",
  examples: [],
};
const commerceDefaults: CommerceSettings = {
  storeEnabled: true,
  paymentMethods: ["Cash on Delivery"],
  deliveryFees: { insideDhaka: 80, outsideDhaka: 130 },
  deliveryPolicy: "",
  returnPolicy: "",
  salesChannel: "",
};

export default function BusinessSettings() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["business-profile"],
    queryFn: businessApi.get,
  });
  const [form, setForm] = useState<Partial<BusinessProfile>>({});
  const [voice, setVoice] = useState<BrandVoiceProfile>(voiceDefaults);
  const [commerce, setCommerce] = useState<CommerceSettings>(commerceDefaults);
  const [example, setExample] = useState("");
  useEffect(() => {
    if (data) {
      setForm(data);
      setVoice({
        ...voiceDefaults,
        ...data.brandVoice,
        examples: data.brandVoice?.examples || [],
      });
      setCommerce({
        ...commerceDefaults,
        ...data.commerce,
        deliveryFees: {
          ...commerceDefaults.deliveryFees,
          ...data.commerce?.deliveryFees,
        },
      });
    }
  }, [data]);
  const save = useMutation({
    mutationFn: () => businessApi.update(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business-profile"] }),
  });
  const saveVoice = useMutation({
    mutationFn: () => businessApi.updateBrandVoice(voice),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business-profile"] }),
  });
  const saveCommerce = useMutation({
    mutationFn: () => businessApi.updateCommerce(commerce),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business-profile"] }),
  });
  const owner = session?.role === "Owner";
  const field = (key: keyof BusinessProfile, label: string) => (
    <label className="space-y-2 text-sm">
      <span>{label}</span>
      <Input
        disabled={!owner}
        value={String(form[key] || "")}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      />
    </label>
  );
  const select = <K extends keyof BrandVoiceProfile>(
    key: K,
    label: string,
    options: Array<[BrandVoiceProfile[K], string]>,
  ) => (
    <label className="space-y-2 text-sm">
      <span>{label}</span>
      <select
        disabled={!owner}
        className="h-10 w-full rounded-md border bg-background px-3"
        value={String(voice[key])}
        onChange={(event) =>
          setVoice({
            ...voice,
            [key]: event.target.value as BrandVoiceProfile[K],
          })
        }
      >
        {options.map(([value, text]) => (
          <option key={String(value)} value={String(value)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-20">
      <PageHeader
        title="Business settings"
        description="Manage your customer-facing profile, storefront ordering, and SellPilot communication style."
      />
      <nav aria-label="Business settings sections" className="flex flex-wrap gap-2 text-sm">{[['profile','Profile'],['voice','AI communication'],['ordering','Ordering']].map(([id,label]) => <a key={id} href={`#${id}`} className="rounded-lg border border-border px-4 py-2 hover:bg-muted">{label}</a>)}</nav>
      <SettingsSection id="profile" title="Business profile" description="Your identity and contact details across SellPilot."><div className="grid gap-5 sm:grid-cols-2">
          {isLoading ? (
            <p>Loading…</p>
          ) : (
            <>
              {field("name", "Business name")}
              {field("businessType", "Business type")}
              {field("phone", "Phone")}
              {field("website", "Website / Facebook Page")}
              <label className="space-y-2 text-sm">
                <span>Preferred language</span>
                <select
                  disabled={!owner}
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={form.preferredLanguage || "bn"}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      preferredLanguage: event.target.value as "bn" | "en",
                    })
                  }
                >
                  <option value="bn">Bangla / Banglish</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>Currency</span>
                <Input disabled value={form.currency || "BDT"} />
              </label>
              <div className="sm:col-span-2">
                {owner ? (
<><Button
                    disabled={save.isPending}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                  {save.isError && <p role="alert" className="mt-3 text-sm text-destructive">Could not save business profile. Please try again.</p>}
                  {save.isSuccess && <p role="status" className="mt-3 text-sm text-muted-foreground">Saved successfully.</p>}</>
) : (
                  <p className="text-sm text-muted-foreground">
                    Only the Owner can change business settings.
                  </p>
                )}
              </div>
            </>
          )}
        </div></SettingsSection>
      <SettingsSection id="voice" title="AI communication" description="Set the tone, language, and examples your assistant uses."><div className="grid gap-5 sm:grid-cols-2">
          {select("tone", "Tone", [
            ["friendly", "Friendly"],
            ["professional", "Professional"],
            ["casual", "Casual"],
            ["premium", "Premium"],
            ["custom", "Custom"],
          ])}
          {select("replyLength", "Reply length", [
            ["short", "Short"],
            ["balanced", "Balanced"],
            ["detailed", "Detailed"],
          ])}
          {select("language", "Language", [
            ["auto", "Auto"],
            ["bn", "Bangla"],
            ["en", "English"],
            ["banglish", "Banglish"],
          ])}
          {select("salesBehavior", "Sales behavior", [
            ["helpful", "Helpful"],
            ["balanced", "Balanced"],
            ["sales_focused", "Sales-focused"],
          ])}
          {select("emoji", "Emoji", [
            ["none", "None"],
            ["light", "Light"],
            ["normal", "Normal"],
          ])}
          {voice.tone === "custom" && (
            <label className="space-y-2 text-sm">
              <span>Custom tone</span>
              <Input
                disabled={!owner}
                maxLength={300}
                value={voice.customTone || ""}
                onChange={(event) =>
                  setVoice({ ...voice, customTone: event.target.value })
                }
                placeholder="Warm, direct, locally familiar…"
              />
            </label>
          )}
          <div className="space-y-3 sm:col-span-2">
            <label className="space-y-2 text-sm">
              <span>Example of how we talk to customers</span>
              <textarea
                disabled={!owner}
                className="min-h-24 w-full rounded-md border bg-background p-3"
                maxLength={1000}
                value={example}
                onChange={(event) => setExample(event.target.value)}
                placeholder="জি, Blackটা available আছে 😊 কোন size লাগবে?"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={
                !owner || !example.trim() || voice.examples.length >= 10
              }
              onClick={() => {
                setVoice({
                  ...voice,
                  examples: [...voice.examples, example.trim()],
                });
                setExample("");
              }}
            >
              Add approved example
            </Button>
            {voice.examples.length > 0 && (
              <div className="space-y-2">
                {voice.examples.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm"
                  >
                    <span>{item}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!owner}
                      onClick={() =>
                        setVoice({
                          ...voice,
                          examples: voice.examples.filter(
                            (_value, current) => current !== index,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            {owner && (
<><Button
                disabled={saveVoice.isPending}
                onClick={() => saveVoice.mutate()}
              >
                {saveVoice.isPending ? "Saving…" : "Save AI style"}
              </Button>
                  {saveVoice.isError && <p role="alert" className="mt-3 text-sm text-destructive">Could not save AI style. Please try again.</p>}
                  {saveVoice.isSuccess && <p role="status" className="mt-3 text-sm text-muted-foreground">Saved successfully.</p>}</>
)}
          </div>
        </div></SettingsSection>
      <SettingsSection id="ordering" title="Storefront ordering" description="Manage delivery, payment choices, and checkout availability."><div className="grid gap-5 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-4 rounded-xl border p-4 text-sm sm:col-span-2">
            <span>
              <strong className="block text-foreground">
                Accept online orders
              </strong>
              <span className="mt-1 block text-muted-foreground">
                Customers can submit carts into SellPilot Orders.
              </span>
            </span>
            <input
              type="checkbox"
              disabled={!owner}
              checked={commerce.storeEnabled}
              onChange={(event) =>
                setCommerce({ ...commerce, storeEnabled: event.target.checked })
              }
              className="h-5 w-5 accent-violet-600"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Delivery inside Dhaka (BDT)</span>
            <Input
              type="number"
              min={0}
              max={10000}
              disabled={!owner}
              value={commerce.deliveryFees.insideDhaka}
              onChange={(event) =>
                setCommerce({
                  ...commerce,
                  deliveryFees: {
                    ...commerce.deliveryFees,
                    insideDhaka: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>Delivery outside Dhaka (BDT)</span>
            <Input
              type="number"
              min={0}
              max={10000}
              disabled={!owner}
              value={commerce.deliveryFees.outsideDhaka}
              onChange={(event) =>
                setCommerce({
                  ...commerce,
                  deliveryFees: {
                    ...commerce.deliveryFees,
                    outsideDhaka: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label className="space-y-2 text-sm sm:col-span-2">
            <span>Payment methods</span>
            <Input
              disabled={!owner}
              value={commerce.paymentMethods.join(", ")}
              onChange={(event) =>
                setCommerce({
                  ...commerce,
                  paymentMethods: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Cash on Delivery, bKash"
            />
            <span className="block text-xs text-muted-foreground">
              Separate methods with commas. Payment remains pending until
              confirmed in Orders.
            </span>
          </label>
          <label className="space-y-2 text-sm sm:col-span-2">
            <span>Main sales channels</span>
            <Input
              disabled={!owner}
              maxLength={160}
              value={commerce.salesChannel || ""}
              onChange={(event) =>
                setCommerce({ ...commerce, salesChannel: event.target.value })
              }
              placeholder="Facebook, WhatsApp, website"
            />
          </label>
          <label className="space-y-2 text-sm sm:col-span-2">
            <span>Delivery policy</span>
            <textarea
              disabled={!owner}
              maxLength={500}
              value={commerce.deliveryPolicy || ""}
              onChange={(event) =>
                setCommerce({ ...commerce, deliveryPolicy: event.target.value })
              }
              className="min-h-20 w-full rounded-md border bg-background p-3"
              placeholder="Delivery areas, timing, and customer expectations"
            />
          </label>
          <label className="space-y-2 text-sm sm:col-span-2">
            <span>Return / exchange policy</span>
            <textarea
              disabled={!owner}
              maxLength={500}
              value={commerce.returnPolicy || ""}
              onChange={(event) =>
                setCommerce({ ...commerce, returnPolicy: event.target.value })
              }
              className="min-h-20 w-full rounded-md border bg-background p-3"
              placeholder="Eligibility, window, and process"
            />
          </label>
          <div className="sm:col-span-2">
            {owner && (
<><Button
                disabled={saveCommerce.isPending}
                onClick={() => saveCommerce.mutate()}
              >
                {saveCommerce.isPending ? "Saving…" : "Save ordering settings"}
              </Button>
                  {saveCommerce.isError && <p role="alert" className="mt-3 text-sm text-destructive">Could not save ordering settings. Please try again.</p>}
                  {saveCommerce.isSuccess && <p role="status" className="mt-3 text-sm text-muted-foreground">Saved successfully.</p>}</>
)}
          </div>
        </div></SettingsSection>
    </div>
  );
}
