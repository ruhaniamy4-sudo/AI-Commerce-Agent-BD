import type {LucideIcon} from "lucide-react";
import {Bot,MapPin,ShieldCheck,UsersRound} from "lucide-react";
import {PageHero,FinalCTA} from "@/components/marketing";
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


export default function Page(){return <main className="reset-public"><PageHero eyebrow="Our point of view" title="Behind every conversation, there is a business." copy="SellPilot is building practical AI commerce infrastructure for the teams in Bangladesh who already sell through messages."/><section className="sp-light sp-section"><div className="sp-wrap grid gap-12 lg:grid-cols-2"><div><p className="sp-eyebrow">Commerce, understood</p><h2 className="sp-heading mt-5">Technology should bring things together.</h2></div><div className="sp-copy space-y-6"><p>Customers do not experience sales, support, inventory, and delivery as separate systems. They ask one question and expect the business to understand the context.</p><p>We connect grounded AI conversations with products, customers, confirmed actions, and human control. The goal is not automation for its own sake. It is a clearer, more dependable way to operate.</p><p>Bangladesh is not an afterthought. Facebook-led commerce and local operating needs shape our product from the beginning.</p></div></div></section><section className="sp-dark sp-section"><div className="sp-wrap"><div className="sp-section-head"><div><p className="sp-eyebrow">What we build on</p><h2 className="sp-heading mt-5">Practical principles.<br/>Visible in the product.</h2></div></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{principles.map(([Icon,title,copy])=><article key={title} className="sp-glass p-7"><span className="sp-icon"><Icon/></span><h3 className="text-xl mt-7 mb-3">{title}</h3><p className="text-sm text-[#a2a5bc] leading-7">{copy}</p></article>)}</div></div></section><FinalCTA/></main>;}
import type { Metadata } from "next";
export const metadata: Metadata = { title: "About SellPilot", description: "Meet SellPilot, the AI commerce workspace for Bangladesh businesses." };
