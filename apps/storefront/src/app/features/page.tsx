import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Globe2,
  Headphones,
  ImageIcon,
  LockKeyhole,
  MessageCircle,
  PackageCheck,
  SearchCheck,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { FinalCTA, PageHero, SectionHeading } from "@/components/marketing";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore Digitross AI conversations, commerce operations, human control, security, and cost controls.",
};

const capabilityGroups: Array<{
  title: string;
  copy: string;
  items: Array<[LucideIcon, string, string]>;
}> = [
  {
    title: "Commerce operations",
    copy: "The conversation connects to actual business records and confirmed backend actions.",
    items: [
      [
        Boxes,
        "Products and stock",
        "Relevant product data, variants, pricing, and stock-aware responses.",
      ],
      [
        UsersRound,
        "Customer context",
        "Customer details remain inside the correct business workspace.",
      ],
      [
        PackageCheck,
        "Confirmed orders",
        "Order success is communicated only after backend confirmation.",
      ],
      [
        ShoppingBag,
        "Exact answers",
        "High-confidence stock, price, and order status paths avoid unnecessary AI.",
      ],
    ],
  },
  {
    title: "Team control",
    copy: "One visible controller keeps AI and people from talking over each other.",
    items: [
      [
        Headphones,
        "Human takeover",
        "Pause AI instantly while incoming messages remain available to the team.",
      ],
      [
        MessageCircle,
        "Conversation history",
        "Recent messages and compact summaries preserve useful context.",
      ],
      [
        UsersRound,
        "Workspace roles",
        "Owner, Admin, and Staff access aligns with conversation handling.",
      ],
      [
        CheckCircle2,
        "Return to AI",
        "Resume only future messages without replaying historical actions.",
      ],
    ],
  },
  {
    title: "Platform foundations",
    copy: "The system is designed to stay bounded, observable, and isolated as it grows.",
    items: [
      [
        LockKeyhole,
        "Tenant isolation",
        "Business-scoped boundaries across conversations and commerce data.",
      ],
      [
        Globe2,
        "Live channels",
        "Facebook Messenger and website chat are available now.",
      ],
      [
        CircleDollarSign,
        "Cost guardrails",
        "Bounded history, retrieval, product candidates, and model output.",
      ],
      [
        BarChart3,
        "Usage tracking",
        "Provider token usage and configurable cost estimates by business.",
      ],
    ],
  },
];

const contextSignals: Array<[LucideIcon, string]> = [
  [BrainCircuit, "Knowledge · Returns policy"],
  [SearchCheck, "Catalog · 3 candidates"],
  [ShieldCheck, "Tenant · Correct business"],
];

export default function FeaturesPage() {
  return (
    <main>
      <PageHero
        eyebrow="Product capabilities"
        title="A commerce agent that understands when to talk—and when to act."
        copy="Digitross brings AI conversation, real commerce context, team control, and cost visibility into one carefully bounded workflow."
      />
      <Reveal>
        <section className="site-container py-20 sm:py-28">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <article className="bento-card dark-panel min-h-[26rem]">
              <div className="relative z-10">
                <p className="section-kicker !text-cyan-300">AI conversation</p>
                <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-.04em]">
                  Grounded answers, not free-form guessing.
                </h2>
                <p className="max-w-xl">
                  Recent context, business knowledge, product candidates, and
                  customer information are assembled only when relevant.
                </p>
              </div>
              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Bot className="h-4 w-4 text-blue-300" />
                    Conversation
                  </div>
                  <div className="mt-6 ml-auto rounded-xl bg-blue-600 p-3 text-xs text-white">
                    Which black bag is in stock?
                  </div>
                  <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-slate-200">
                    Classic Backpack is available in Black. 12 units are
                    currently in stock.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.07] p-5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Context used
                  </div>
                  {contextSignals.map(([Icon, text]) => (
                    <div
                      key={String(text)}
                      className="mt-4 flex items-center gap-3 text-xs text-slate-300"
                    >
                      <Icon className="h-4 w-4 text-cyan-300" />
                      {text}
                    </div>
                  ))}
                </div>
              </div>
            </article>
            <article className="bento-card min-h-[26rem]">
              <div className="icon-tile">
                <ImageIcon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                Image understanding
              </h2>
              <p>
                Customer images can enter a product-matching flow before a small
                set of relevant products is returned.
              </p>
              <div className="relative mt-8 grid grid-cols-2 gap-3">
                <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-violet-100 via-blue-100 to-cyan-100 p-3 dark:from-violet-950 dark:via-blue-950 dark:to-cyan-950">
                  <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold text-slate-700 dark:bg-black/30 dark:text-white">
                    Customer image
                  </span>
                </div>
                <div className="space-y-3 pt-5">
                  {[
                    "Category found",
                    "Features extracted",
                    "Catalog matched",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[10px] font-semibold text-[var(--ink)]"
                    >
                      <span className="mr-2 text-blue-500">0{index + 1}</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>
      </Reveal>
      {capabilityGroups.map((group, index) => (
        <Reveal key={group.title}>
          <section
            className={`${index % 2 ? "bg-[var(--page-soft)]" : ""} py-20 sm:py-24`}
          >
            <div className="site-container grid gap-10 lg:grid-cols-[.36fr_.64fr]">
              <div>
                <p className="section-kicker">
                  0{index + 2} · Capability group
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-[var(--ink)]">
                  {group.title}
                </h2>
                <p className="mt-4 leading-7 text-[var(--muted)]">
                  {group.copy}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.items.map(([Icon, title, copy], itemIndex) => (
                  <article
                    key={title}
                    className={`surface-card p-6 ${itemIndex === 0 ? "sm:row-span-2 sm:flex sm:flex-col sm:justify-between" : ""}`}
                  >
                    <div>
                      <div className="icon-tile">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 font-semibold text-[var(--ink)]">
                        {title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {copy}
                      </p>
                    </div>
                    <span className="mt-6 inline-flex w-fit rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Available now
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      ))}
      <Reveal>
        <section
          id="channels"
          className="site-container scroll-mt-24 py-20 sm:py-28"
        >
          <SectionHeading
            eyebrow="Channels and roadmap"
            title="Clear about what is live today."
            copy="Digitross does not present future integrations as finished product."
            center
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <StatusCard
              title="Facebook Messenger"
              status="Available now"
              live
            />
            <StatusCard title="Website chat" status="Available now" live />
            <StatusCard title="WhatsApp" status="Coming soon" />
            <StatusCard title="Instagram" status="Future direction" />
            <StatusCard title="Courier automation" status="Coming soon" />
            <StatusCard title="Steadfast integration" status="Coming soon" />
          </div>
          <div id="coming-soon" className="scroll-mt-24 pt-8 text-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400"
            >
              Discuss your rollout <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </Reveal>
      <FinalCTA />
    </main>
  );
}

function StatusCard({
  title,
  status,
  live = false,
}: {
  title: string;
  status: string;
  live?: boolean;
}) {
  return (
    <div className="surface-card flex items-center gap-4 p-5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(34,197,94,.1)]" : "bg-amber-400 shadow-[0_0_0_6px_rgba(251,191,36,.1)]"}`}
      />
      <div>
        <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">{status}</p>
      </div>
    </div>
  );
}
