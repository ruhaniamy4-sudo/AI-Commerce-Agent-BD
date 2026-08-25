import type { Metadata } from "next";
import { Check, ChevronDown, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FinalCTA, PageHero, SectionHeading } from "@/components/marketing";
import { Reveal } from "@/components/reveal";
import { PRICING_PLANS } from "@/lib/marketing-config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Explore SellPilot early-access plans for AI commerce teams in Bangladesh.",
};

const plans = PRICING_PLANS;

const faqs = [
  [
    "Is final pricing available?",
    "SellPilot is in early access. Final plan prices are not published yet because rollout scope and usage needs are still being validated with participating businesses.",
  ],
  [
    "What determines AI usage cost?",
    "Model choice, conversation volume, context size, and output length all affect provider cost. SellPilot tracks token usage and supports configurable cost estimates by business.",
  ],
  [
    "Can we start with one channel?",
    "Yes. A focused rollout can begin with Facebook Messenger or website chat before expanding to additional supported channels.",
  ],
  [
    "Does every plan include human takeover?",
    "Human takeover is a core operating control and is included in the early-access plan structure shown here.",
  ],
  [
    "Are WhatsApp and courier integrations included?",
    "WhatsApp is not available today. A Steadfast courier foundation exists, while production courier automation and rollout validation are scoped separately.",
  ],
];

export default function PricingPage() {
  return (
    <main>
      <PageHero
        eyebrow="Early-access plans"
        title="Start focused. Scale with proof."
        copy="Choose the shape of your rollout today. Final commercial pricing will be shared transparently as SellPilot moves beyond early access."
      />
      <Reveal>
        <section className="site-container pb-20 sm:pb-28">
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex flex-col rounded-[1.75rem] border p-7 sm:p-8 ${plan.featured ? "border-blue-500 bg-slate-950 text-white shadow-[0_24px_70px_rgba(37,99,235,.2)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}
              >
                {plan.featured && (
                  <span className="absolute right-6 top-6 rounded-full bg-blue-500 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
                    Recommended
                  </span>
                )}
                <p
                  className={`text-xs font-bold uppercase tracking-[.16em] ${plan.featured ? "text-cyan-300" : "text-blue-600 dark:text-blue-400"}`}
                >
                  {plan.label}
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                  {plan.name}
                </h2>
                <p
                  className={`mt-4 min-h-14 text-sm leading-6 ${plan.featured ? "text-slate-300" : "text-[var(--muted)]"}`}
                >
                  {plan.description}
                </p>
                <div className="my-7 border-t border-current opacity-10" />
                <p className="text-sm font-semibold">Early-access pricing</p>
                <p
                  className={`mt-1 text-sm ${plan.featured ? "text-slate-400" : "text-[var(--muted)]"}`}
                >
                  Discussed during your rollout call
                </p>
                <ul className="mt-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex gap-3 text-sm ${plan.featured ? "text-slate-200" : "text-[var(--muted)]"}`}
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-cyan-300" : "text-emerald-500"}`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 justify-center ${plan.featured ? "button-primary" : "button-secondary"}`}
                >
                  Discuss {plan.name}
                </Link>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="surface-card flex gap-4 p-5">
              <Gauge className="h-5 w-5 shrink-0 text-blue-500" />
              <p className="text-sm text-[var(--muted)]">
                <strong className="block text-[var(--ink)]">
                  Bounded usage
                </strong>
                Context and output limits protect cost.
              </p>
            </div>
            <div className="surface-card flex gap-4 p-5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-violet-500" />
              <p className="text-sm text-[var(--muted)]">
                <strong className="block text-[var(--ink)]">
                  Tenant isolation
                </strong>
                Business data stays business-scoped.
              </p>
            </div>
            <div className="surface-card flex gap-4 p-5">
              <Sparkles className="h-5 w-5 shrink-0 text-cyan-500" />
              <p className="text-sm text-[var(--muted)]">
                <strong className="block text-[var(--ink)]">
                  No hidden claims
                </strong>
                Future features are labeled clearly.
              </p>
            </div>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="bg-[var(--page-soft)] py-20 sm:py-28">
          <div className="site-container max-w-4xl">
            <SectionHeading
              eyebrow="Pricing FAQ"
              title="The questions worth asking before rollout."
              center
            />
            <div className="mt-12 space-y-3">
              {faqs.map(([question, answer]) => (
                <details key={question} className="faq-item group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-[var(--ink)] sm:p-6">
                    {question}
                    <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-7 text-[var(--muted)] sm:px-6 sm:pb-6">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </Reveal>
      <FinalCTA
        title="Make the first rollout measurable."
        copy="We’ll help you define a narrow workflow, the guardrails around it, and the signals that show whether it is working."
      />
    </main>
  );
}
