import type { LucideIcon } from "lucide-react";
import { Boxes,UsersRound,PackageCheck,ShoppingBag,Headphones,MessageCircle,CheckCircle2,LockKeyhole,Globe2,CircleDollarSign,BarChart3 } from "lucide-react";
import { PageHero,FinalCTA } from "@/components/marketing";
import { CommercePreview } from "@/components/commerce-system";
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


export default function FeaturesPage(){return <main className="reset-public"><PageHero eyebrow="Inside the platform" title="More context. Less busywork." copy="Conversations, commerce, and human control. Built to work together, not as a collection of disconnected tools."/><section className="sp-light sp-section"><div className="sp-wrap reset-hero-grid !pb-0"><div><p className="sp-eyebrow">Business-aware conversations</p><h2 className="sp-heading mt-5">Useful answers start with the right knowledge.</h2><p className="sp-copy mt-5">Your catalog, policies, and recent customer context give your AI a practical foundation. Your team decides when to step in.</p></div><CommercePreview/></div></section><section className="sp-dark sp-section"><div className="sp-wrap space-y-14">{capabilityGroups.map((group,i)=><div key={group.title} id={i===2?"channels":undefined}><div className="sp-section-head"><div><p className="sp-eyebrow">0{i+1} / Platform capabilities</p><h2 className="sp-heading mt-4">{group.title}</h2></div><p className="sp-copy">{group.copy}</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{group.items.map(([Icon,title,copy])=><article key={title} className="sp-glass p-6"><span className="sp-icon"><Icon/></span><h3 className="text-lg mt-6 mb-3">{title}</h3><p className="text-sm leading-7 text-[#a2a5bc]">{copy}</p></article>)}</div></div>)}<p className="sp-note">WhatsApp is coming soon. Courier automation requires separately validated rollout.</p></div></section><FinalCTA/></main>;}
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Platform Features", description: "Explore connected conversations, products, orders, and human control in SellPilot." };
