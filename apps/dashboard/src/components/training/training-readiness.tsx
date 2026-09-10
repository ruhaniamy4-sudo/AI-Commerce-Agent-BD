"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import type { TrainingOverview } from "@/types";

const areas = [
  ["Products", "Catalog, variants and specifications", "/products"],
  ["Brand voice", "Tone, language and response style", "/settings/business#voice"],
  ["Delivery rules", "Areas, charges and delivery policy", "/settings/business#ordering"],
  ["Payment methods", "Accepted ways to pay", "/settings/business#ordering"],
  ["Returns", "Approved return and refund policy", "/settings/business#ordering"],
  ["FAQs", "Answers your customers can rely on", "/knowledge"],
];

export function TrainingReadiness({ overview }: { overview: TrainingOverview }) {
  const questions = overview.setupQuestions[overview.businessProfile.businessType || ""] || [];
  const answered = questions.filter(question => {
    const value = overview.setupAnswers[question.id]?.value;
    return Array.isArray(value) ? value.some(item => item.trim()) : Boolean(value?.trim());
  }).length;
  const percent = questions.length ? Math.round(answered / questions.length * 100) : 0;
  return <section className="rounded-2xl border bg-card p-5 sm:p-6" aria-label="AI setup readiness">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">AI setup readiness</p><h2 className="mt-2 text-2xl font-bold">{questions.length ? `${percent}% of business answers configured` : "Start with your business type"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{answered} of {questions.length} guided answers saved. This measures setup coverage, not AI accuracy. Review imported information and test the assistant before going live.</p></div>
      <span className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">{overview.readiness.ready ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}{overview.readiness.ready ? "Required answers covered" : `${overview.readiness.critical} critical details remaining`}</span>
    </div>
    <div role="progressbar" aria-label="Business answer coverage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="my-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${percent}%` }} /></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{areas.map(([title,copy,href]) => <Link key={title} href={href} className="group flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div><ArrowUpRight size={15} className="shrink-0 text-primary" /></Link>)}</div>
  </section>;
}
