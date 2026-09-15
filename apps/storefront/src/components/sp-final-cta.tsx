"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot } from "lucide-react";

export function SpFinalCTA() {
  const reduced = useReducedMotion();
  const t = (delay = 0) => ({ duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number,number,number,number], delay });

  return (
    <section className="sp-cta-root">
      <div className="sp-cta-glow" aria-hidden="true" />
      <div className="sp-wrap sp-cta-inner">
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={t(0)}
        >
          <div className="sp-cta-icon" aria-hidden="true"><Bot size={22} /></div>
          <h2>Make every conversation<br />easier to act on.</h2>
          <p>
            Bring your product knowledge, customer conversations,
            and commerce operations into one focused SellPilot workspace.
          </p>
          <div className="sp-cta-actions">
            <Link href="/signup" className="sp-btn sp-btn-primary sp-btn-lg">
              Get started <ArrowRight size={16} />
            </Link>
            <Link href="/test-ai" className="sp-btn sp-btn-ghost">
              Try the AI
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
