"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { HomeSalesAgent } from "./home-sales-agent";

export function SpDemoSection() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section className="sp-demo-root" id="demo-section" ref={sectionRef}>
      <div className="sp-demo-glow" aria-hidden="true" />
      <div className="sp-wrap">
        <motion.header
          className="sp-section-header"
          initial={reduced ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="sp-kicker"><Sparkles size={11} />See SellPilot in action</p>
          <h2>From message to order.</h2>
          <p className="sp-section-sub">
            A customer asks about a sneaker. SellPilot checks your catalog,
            recommends the right product, and starts the order — all in one conversation.
          </p>
        </motion.header>

        {/* Reuse the existing phone scene reframed in centered showcase */}
        <div className="sp-demo-phone-wrap">
          <HomeSalesAgent showcaseOnly={true} />
        </div>
      </div>
    </section>
  );
}
