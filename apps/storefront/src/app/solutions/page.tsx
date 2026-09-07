import type {LucideIcon} from "lucide-react";
import {MessagesSquare,ShoppingBag,Headphones,Building2,Check} from "lucide-react";
import {PageHero,FinalCTA} from "@/components/marketing";
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


export default function Page(){return <main className="reset-public"><PageHero eyebrow="Made for your operation" title="Different businesses. One connected way to work." copy="Start with the workflow that matters most. Keep your customer context and your team connected as you grow."/>{solutions.map((s,i)=><section id={s.id} key={s.id} className={`sp-section ${i%2===0?"sp-light":"sp-dark"}`}><div className="sp-wrap grid gap-10 lg:grid-cols-[.9fr_1.1fr] items-center"><div><span className="sp-eyebrow">{s.eyebrow}</span><h2 className="sp-heading mt-5">{s.title}</h2><p className="sp-copy mt-5">{s.copy}</p></div><article className={`p-7 sm:p-10 ${i%2===0?"sp-surface":"sp-glass"}`}><span className="sp-icon"><s.icon/></span><p className="sp-note mt-5 mb-5">Illustrative conversation</p><p className="rounded-xl p-4 bg-[#8054f612] text-sm">{s.conversation[0]}</p><p className="mt-3 text-sm leading-7">{s.conversation[1]}</p><ul className="mt-7 pt-6 border-t border-[#8883a525] space-y-3">{s.steps.map(step=><li className="flex gap-3 items-center text-xs" key={step}><Check size={14} className="text-violet-500"/>{step}</li>)}</ul></article></div></section>)}<FinalCTA/></main>;}
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Commerce Solutions", description: "See how SellPilot supports online stores, service teams, and growing businesses." };
