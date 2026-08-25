"use client";
import { FormEvent, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function DemoForm() {
  const { text } = useLanguage();
  const t = (en: string, bn: string) => text({ en, bn });
  const [brief, setBrief] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBrief(`SellPilot demo request\nBusiness: ${data.get("business")}\nContact: ${data.get("contact")}\nChannel: ${data.get("channel")}\nMonthly conversations: ${data.get("size")}`);
    setCopied(false);
  }
  async function copyBrief() { if (!brief) return; await navigator.clipboard.writeText(brief); setCopied(true); }
  return <div><form onSubmit={handleSubmit} className="surface-card p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-[var(--ink)]">{t("Business name","Business-এর নাম")}<input name="business" required className="form-field mt-2" placeholder={t("Your business","আপনার business")} /></label><label className="text-sm font-semibold text-[var(--ink)]">{t("Email or phone","Email অথবা phone")}<input name="contact" required className="form-field mt-2" placeholder="you@business.com" /></label><label className="text-sm font-semibold text-[var(--ink)]">{t("Primary channel","প্রধান channel")}<select name="channel" className="form-field mt-2" defaultValue="Facebook Messenger"><option>Facebook Messenger</option><option>Website chat</option><option>{t("Both","দুটিই")}</option></select></label><label className="text-sm font-semibold text-[var(--ink)]">{t("Monthly conversations","মাসিক conversation")}<select name="size" className="form-field mt-2" defaultValue="500–2,000"><option>{t("Under 500","৫০০-এর কম")}</option><option>500–2,000</option><option>2,000–10,000</option><option>10,000+</option></select></label></div><button type="submit" className="button-primary mt-7 w-full sm:w-auto">{t("Prepare demo brief","Demo brief তৈরি করুন")} <Check className="h-4 w-4" /></button><p className="mt-4 text-xs leading-5 text-[var(--muted)]">{t("Demo mode only: this prepares a brief locally in your browser. It does not submit or store your information.","শুধু demo mode: brief আপনার browser-এ locally তৈরি হয়। কোনো তথ্য submit বা store হয় না।")}</p></form>{brief && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm font-bold text-blue-900">{t("Your demo brief is ready","আপনার demo brief তৈরি হয়েছে")}</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-blue-950">{brief}</pre><button type="button" onClick={copyBrief} className="button-secondary mt-4 !border-blue-200 !bg-white">{copied ? <><Check className="h-4 w-4" />{t("Copied","Copy হয়েছে")}</> : <><Clipboard className="h-4 w-4" />{t("Copy brief","Brief copy করুন")}</>}</button></div>}</div>;
}
