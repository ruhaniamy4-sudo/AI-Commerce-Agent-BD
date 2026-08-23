"use client";

import { Bot, CheckCircle2, CircleUserRound, Hand, MessageCircle, PackageCheck, SearchCheck } from "lucide-react";
import { useEffect, useState } from "react";

const steps = [
  { title: "Customer messages", copy: "A buyer asks in the language they naturally use.", icon: MessageCircle, view: "Black color ta available?" },
  { title: "AI understands", copy: "Intent and business context are resolved before answering.", icon: Bot, view: "Intent detected · Stock enquiry" },
  { title: "Product found", copy: "Only a small relevant product set is searched.", icon: SearchCheck, view: "Classic Backpack · Black · 12 in stock" },
  { title: "Order prepared", copy: "Customer and order details move into a confirmed workflow.", icon: PackageCheck, view: "Order draft ready · COD" },
  { title: "Human can intervene", copy: "A teammate can take over without losing the conversation.", icon: Hand, view: "Human active · AI paused" },
  { title: "Conversation continues", copy: "History stays available when control returns to AI.", icon: CheckCircle2, view: "Context preserved · Ready to resume" },
];

export function ProductPreview() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive(current => (current + 1) % steps.length), 4200);
    return () => window.clearInterval(timer);
  }, []);

  const current = steps[active];
  const CurrentIcon = current.icon;
  return (
    <div className="workflow-grid">
      <div className="space-y-2" role="tablist" aria-label="Digitross workflow">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return <button key={step.title} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)} className={`workflow-step ${active === index ? "is-active" : ""}`}><span className="workflow-index">0{index + 1}</span><span className="workflow-icon"><Icon className="h-4 w-4" /></span><span className="text-left"><strong>{step.title}</strong><small>{step.copy}</small></span></button>;
        })}
      </div>
      <div className="workflow-stage" role="tabpanel">
        <div className="stage-topbar"><div className="flex items-center gap-2"><span className="status-dot" /><span>Live commerce workflow</span></div><span>AI active</span></div>
        <div className="stage-grid-lines" />
        <div key={active} className="stage-content">
          <div className="stage-orbit stage-orbit-one" /><div className="stage-orbit stage-orbit-two" />
          <div className="stage-message"><CurrentIcon className="h-5 w-5" /><span>{current.view}</span></div>
          <div className="stage-event"><CircleUserRound className="h-4 w-4 text-cyan-500" /><div><span>Workflow event</span><strong>{current.title}</strong></div><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" /></div>
          <div className="stage-progress"><span style={{ width: `${((active + 1) / steps.length) * 100}%` }} /></div>
        </div>
      </div>
    </div>
  );
}
