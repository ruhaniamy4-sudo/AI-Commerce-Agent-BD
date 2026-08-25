import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  Headphones,
  MessagesSquare,
  PackageCheck,
  ShoppingBag,
  Store,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { FinalCTA, PageHero } from "@/components/marketing";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "See how SellPilot supports Facebook sellers, ecommerce teams, customer support, and multi-brand operations in Bangladesh.",
};

const solutions: Array<{
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  icon: LucideIcon;
  steps: string[];
  conversation: [string, string];
}> = [
  {
    id: "facebook-sellers",
    eyebrow: "Facebook sellers",
    title: "Turn page messages into structured commerce.",
    copy: "Answer recurring product questions, check stock, capture customer details, and prepare an order—while keeping a human takeover one click away.",
    icon: MessagesSquare,
    steps: [
      "Resolve the connected page",
      "Find products and stock",
      "Prepare a confirmed order",
    ],
    conversation: [
      "Apu, black colour ta available?",
      "Yes—the Classic Backpack is available in black. Would you like the price and delivery details?",
    ],
  },
  {
    id: "ecommerce",
    eyebrow: "Ecommerce",
    title: "Connect the storefront to the conversation.",
    copy: "Give customers accurate product context before they buy and carry the same catalog into website chat without creating a separate source of truth.",
    icon: ShoppingBag,
    steps: [
      "Use live catalog context",
      "Narrow relevant options",
      "Move toward checkout",
    ],
    conversation: [
      "Do you have this in a smaller size?",
      "I found two smaller options in stock. I can show the closest match first.",
    ],
  },
  {
    id: "support-teams",
    eyebrow: "Support teams",
    title: "Automate the repeatable. Escalate the important.",
    copy: "Let AI handle grounded, repetitive questions while the team retains visibility, history, and control over sensitive or complex conversations.",
    icon: Headphones,
    steps: [
      "Answer from approved knowledge",
      "Preserve recent context",
      "Pause AI for takeover",
    ],
    conversation: [
      "I need help changing my delivery address.",
      "I’ll hand this to the team so they can verify the order before making that change.",
    ],
  },
  {
    id: "multi-brand",
    eyebrow: "Multi-brand operations",
    title: "Keep every business boundary intact.",
    copy: "Business-scoped channels, conversations, knowledge, customers, and commerce records help teams operate distinct brands from a shared platform foundation.",
    icon: Building2,
    steps: [
      "Resolve the correct business",
      "Apply workspace permissions",
      "Keep records tenant-scoped",
    ],
    conversation: [
      "Can another brand see this customer?",
      "No. Customer and conversation data remain within the resolved business workspace.",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <main>
      <PageHero
        eyebrow="Designed around real operations"
        title="A clearer path from customer question to commerce action."
        copy="SellPilot meets Bangladesh businesses where selling already happens, then adds the context, control, and isolation needed to operate with confidence."
      />
      {solutions.map((solution, index) => {
        const Icon = solution.icon;
        return (
          <Reveal key={solution.id}>
            <section
              id={solution.id}
              className={`scroll-mt-24 py-20 sm:py-28 ${index % 2 ? "bg-[var(--page-soft)]" : ""}`}
            >
              <div className="site-container grid items-center gap-12 lg:grid-cols-2">
                <div className={index % 2 ? "lg:order-2" : ""}>
                  <div className="icon-tile">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="section-kicker mt-6">{solution.eyebrow}</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-.045em] text-[var(--ink)] sm:text-4xl">
                    {solution.title}
                  </h2>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
                    {solution.copy}
                  </p>
                  <div className="mt-8 space-y-3">
                    {solution.steps.map((step, stepIndex) => (
                      <div
                        key={step}
                        className="flex items-center gap-3 text-sm font-semibold text-[var(--ink)]"
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          0{stepIndex + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/demo"
                    className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400"
                  >
                    Explore this workflow <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div
                  className={`surface-card p-5 sm:p-7 ${index % 2 ? "lg:order-1" : ""}`}
                >
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                        <Store className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          Commerce inbox
                        </p>
                        <p className="text-[10px] text-[var(--muted)]">
                          Correct workspace resolved
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      AI active
                    </span>
                  </div>
                  <div className="space-y-4 py-8">
                    <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-sm bg-blue-600 p-4 text-sm text-white">
                      {solution.conversation[0]}
                    </div>
                    <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-[var(--page-soft)] p-4 text-sm leading-6 text-[var(--ink)]">
                      {solution.conversation[1]}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[var(--line)] p-3 text-xs text-[var(--muted)]">
                      <PackageCheck className="mb-2 h-4 w-4 text-cyan-500" />
                      Backend checked
                    </div>
                    <div className="rounded-xl border border-[var(--line)] p-3 text-xs text-[var(--muted)]">
                      <UsersRound className="mb-2 h-4 w-4 text-violet-500" />
                      Team visible
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </Reveal>
        );
      })}
      <FinalCTA
        title="Start with the workflow that matters most."
        copy="Tell us where conversations slow your team down. We’ll map a focused early-access rollout around your operation."
      />
    </main>
  );
}
