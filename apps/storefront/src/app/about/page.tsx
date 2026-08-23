import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Bot, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { FinalCTA, PageHero, SectionHeading } from "@/components/marketing";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Digitross is building practical AI commerce infrastructure for Bangladesh businesses.",
};
const principles: Array<[LucideIcon, string, string]> = [
  [MapPin, "Local context", "Build for how Bangladesh businesses sell today."],
  [
    ShieldCheck,
    "Bounded by design",
    "Respect tenant, role, cost, and action boundaries.",
  ],
  [
    UsersRound,
    "Human authority",
    "Make takeover visible, immediate, and reversible.",
  ],
  [
    Bot,
    "Useful automation",
    "Automate only where context and confirmation support it.",
  ],
];

export default function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow="About Digitross"
        title="Commerce AI should understand the business behind the conversation."
        copy="Digitross is being built for teams in Bangladesh that already sell through messages—and need a dependable operating layer around those conversations."
      />
      <Reveal>
        <section className="site-container grid gap-12 py-20 sm:py-28 lg:grid-cols-[.42fr_.58fr]">
          <SectionHeading
            eyebrow="Our point of view"
            title="The agent is only useful when the system around it is trustworthy."
          />
          <div className="space-y-6 text-lg leading-8 text-[var(--muted)]">
            <p>
              Customers do not experience sales, support, inventory, and
              delivery as separate systems. They ask one question and expect the
              business to understand the context.
            </p>
            <p>
              That is why Digitross combines grounded AI conversation with
              product data, customer context, confirmed commerce actions, human
              control, and tenant isolation. The aim is practical: help teams
              respond with more clarity while keeping people accountable for the
              operation.
            </p>
            <p>
              Bangladesh is not an afterthought in that work. Facebook-led
              commerce, local operating habits, and the path toward courier
              connectivity shape the product direction from the beginning.
            </p>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="bg-[var(--page-soft)] py-20 sm:py-28">
          <div className="site-container">
            <SectionHeading
              eyebrow="What guides the product"
              title="Four principles, visible in the workflow."
              center
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {principles.map(([Icon, title, copy]) => (
                <article key={title} className="surface-card p-6">
                  <Icon className="h-5 w-5 text-blue-500" />
                  <h2 className="mt-5 font-semibold text-[var(--ink)]">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {copy}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Reveal>
      <FinalCTA
        title="Build a better commerce conversation with us."
        copy="Join early access and help shape an agent grounded in the realities of your team, customers, and operation."
      />
    </main>
  );
}
