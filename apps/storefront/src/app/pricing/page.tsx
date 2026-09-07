import {PageHero,FinalCTA} from "@/components/marketing";
import {PlanGrid} from "@/components/commerce-system";
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


export default function Page(){return <main className="reset-public"><PageHero eyebrow="Early-access plans" title="Start small. Grow with clarity." copy="Choose a focused rollout for your business. Final commercial pricing is not yet published and will be confirmed before you commit."/><section className="sp-dark pb-20"><div className="sp-wrap"><PlanGrid/></div></section><section className="sp-light sp-section"><div className="sp-wrap reset-faq"><div><p className="sp-eyebrow">Before you begin</p><h2 className="sp-heading mt-5">The details matter.</h2></div><div>{faqs.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></div></section><FinalCTA/></main>;}
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Pricing and Early Access", description: "Explore SellPilot early-access plans and find the right fit for your business." };
