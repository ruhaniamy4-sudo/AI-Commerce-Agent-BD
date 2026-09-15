"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ArrowRight, Sparkles, Plus } from "lucide-react";
import { PRICING_PLANS } from "@/lib/marketing-config";

const faqItems = [
  ["Does SellPilot understand Bangla and Banglish?", "Yes. SellPilot works with Bangla, Banglish, and English, using your approved business and product knowledge to answer customer questions naturally."],
  ["Which channels can I connect?", "Messenger and website chat are available today. WhatsApp is coming soon — the demos on this page illustrate the planned experience."],
  ["Where does the AI get its product information?", "From the catalog, website content, business files, and answers you provide. Your team reviews imported knowledge before it becomes approved context."],
  ["Can my team take over a conversation?", "Yes. Your team can see the full conversation history and take over when a customer needs a person. The full context stays with the conversation."],
  ["Can I try it before setting up my business?", "Yes. Open Test AI to explore a demo conversation and see how SellPilot responds. Demo conversations and orders are illustrative."],
];

export function SpPricingAndFaq() {
  const reduced = useReducedMotion();
  const t = (delay = 0) => ({ duration: 0.65, ease: [0.22, 1, 0.36, 1] as [number,number,number,number], delay });

  return (
    <>
      {/* PRICING */}
      <section className="sp-pricing-root" id="pricing">
        <div className="sp-pricing-glow" aria-hidden="true" />
        <div className="sp-wrap">
          <motion.div
            className="sp-section-header"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={t(0)}
          >
            <p className="sp-kicker"><Sparkles size={11} />Early access</p>
            <h2>Start with the right scope.</h2>
            <p className="sp-section-sub">
              Choose a rollout that matches your operations. Final commercial pricing is confirmed with our team separately.
            </p>
          </motion.div>

          <div className="sp-plan-grid">
            {PRICING_PLANS.map((plan, i) => (
              <motion.article
                key={plan.name}
                className={`sp-plan-card ${plan.featured ? "sp-plan-featured" : ""}`}
                initial={reduced ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={t(i * 0.08)}
              >
                <div className="sp-plan-label">
                  <span className="sp-plan-name">{plan.name}</span>
                  {plan.featured && <span className="sp-plan-badge">Popular</span>}
                </div>
                <div className="sp-plan-price">{plan.price}</div>
                <p className="sp-plan-desc">{plan.description}</p>
                <Link href="/demo" className={`sp-btn ${plan.featured ? "sp-btn-primary" : "sp-btn-ghost"}`}>
                  Talk to us <ArrowRight size={14} />
                </Link>
                <ul className="sp-plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}><Check size={13} />{feature}</li>
                  ))}
                </ul>
                <small className="sp-plan-note">Early access · Final pricing confirmed separately</small>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sp-faq-root">
        <div className="sp-wrap sp-faq-inner">
          <motion.div
            className="sp-faq-copy"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={t(0)}
          >
            <p className="sp-kicker">A few good questions</p>
            <h2>Before you say hello.</h2>
            <p className="sp-faq-sub">Get to know the agent that gets to know your business.</p>
          </motion.div>
          <div className="sp-faq-list">
            {faqItems.map(([question, answer]) => (
              <details key={question} className="sp-faq-item">
                <summary>
                  {question}
                  <Plus size={15} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
