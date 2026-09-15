"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Headphones, Sparkles, ArrowRight, CheckCircle2, User } from "lucide-react";

export function SpHumanHandoff() {
  const reduced = useReducedMotion();
  const t = (delay = 0) => ({ duration: 0.65, ease: [0.22, 1, 0.36, 1] as [number,number,number,number], delay });

  return (
    <section className="sp-handoff-root">
      <div className="sp-wrap sp-handoff-inner">
        <motion.div
          className="sp-handoff-visual"
          initial={reduced ? {} : { opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={t(0)}
        >
          {/* AI phase */}
          <div className="sp-handoff-card sp-handoff-card-ai">
            <div className="sp-handoff-card-label"><Sparkles size={11} /> AI handling conversation</div>
            <div className="sp-hb-msg customer">&ldquo;Custom logo embroidery er jonno 50 pcs lagbe.&rdquo;</div>
            <div className="sp-hb-msg agent">
              <span><Sparkles size={9} /> SELLPILOT</span>
              &ldquo;Custom batch er jonno standard catalog cover kore na. Specialist ke connect korchi.&rdquo;
            </div>
          </div>

          {/* Arrow */}
          <div className="sp-handoff-arrow" aria-hidden="true">
            <ArrowRight size={18} />
            <span>Escalated</span>
          </div>

          {/* Human phase */}
          <div className="sp-handoff-card sp-handoff-card-human">
            <div className="sp-handoff-card-label"><User size={11} /> Human agent takes over</div>
            <div className="sp-context-packet">
              <div className="sp-cp-header">
                <Headphones size={12} />
                <strong>Context Packet</strong>
                <span className="sp-cp-badge">Full history attached</span>
              </div>
              <p className="sp-cp-summary">
                Customer wants corporate custom-logo embroidery for 50 pieces.
                Standard catalog pricing does not cover batch orders.
              </p>
              <div className="sp-cp-assign">
                <CheckCircle2 size={12} />
                <span>Assigned: Corporate Sales Lead</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="sp-handoff-copy"
          initial={reduced ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={t(0.1)}
        >
          <p className="sp-kicker"><Headphones size={11} />Human handoff</p>
          <h2>AI handles the volume.<br />You take the VIPs.</h2>
          <p className="sp-handoff-sub">
            When a conversation needs a human judgment — a custom order, a sensitive request,
            a high-value client — SellPilot passes the full context to your team.
            No lost history. No repeat explanations.
          </p>
          <ul className="sp-handoff-bullets">
            <li><CheckCircle2 size={14} />Full conversation history passed on</li>
            <li><CheckCircle2 size={14} />Your team decides when to take over</li>
            <li><CheckCircle2 size={14} />Customer experience stays seamless</li>
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
