"use client";
import { FormEvent, useState } from "react";
import { Check, Clipboard } from "lucide-react";

export function DemoForm() {
  const [brief, setBrief] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBrief(`Digitross demo request\nBusiness: ${data.get("business")}\nContact: ${data.get("contact")}\nChannel: ${data.get("channel")}\nMonthly conversations: ${data.get("size")}`);
    setCopied(false);
  }
  async function copyBrief() { if (!brief) return; await navigator.clipboard.writeText(brief); setCopied(true); }
  return <div><form onSubmit={handleSubmit} className="surface-card p-6 sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Business name<input name="business" required className="form-field mt-2" placeholder="Your business" /></label><label className="text-sm font-semibold text-slate-700">Email or phone<input name="contact" required className="form-field mt-2" placeholder="you@business.com" /></label><label className="text-sm font-semibold text-slate-700">Primary channel<select name="channel" className="form-field mt-2" defaultValue="Facebook Messenger"><option>Facebook Messenger</option><option>Website chat</option><option>Both</option></select></label><label className="text-sm font-semibold text-slate-700">Monthly conversations<select name="size" className="form-field mt-2" defaultValue="500–2,000"><option>Under 500</option><option>500–2,000</option><option>2,000–10,000</option><option>10,000+</option></select></label></div><button type="submit" className="button-primary mt-7 w-full sm:w-auto">Prepare demo brief <Check className="h-4 w-4" /></button><p className="mt-4 text-xs leading-5 text-slate-500">Demo mode only: this prepares a brief locally in your browser. It does not submit or store your information.</p></form>{brief && <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-sm font-bold text-blue-900">Your demo brief is ready</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-blue-950">{brief}</pre><button type="button" onClick={copyBrief} className="button-secondary mt-4 !border-blue-200 !bg-white">{copied ? <><Check className="h-4 w-4" />Copied</> : <><Clipboard className="h-4 w-4" />Copy brief</>}</button></div>}</div>;
}
