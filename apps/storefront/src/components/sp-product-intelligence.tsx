"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Package, CheckCircle2, XCircle, Sparkles } from "lucide-react";

export function SpProductIntelligence() {
  const reduced = useReducedMotion();
  const t = (delay = 0) => ({ duration: 0.65, ease: [0.22, 1, 0.36, 1] as [number,number,number,number], delay });

  return (
    <section className="sp-intel-root">
      <div className="sp-intel-glow" aria-hidden="true" />
      <div className="sp-wrap sp-intel-inner">
        <motion.div
          className="sp-intel-copy"
          initial={reduced ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={t(0)}
        >
          <p className="sp-kicker"><Package size={11} />Product intelligence</p>
          <h2>Always helpful,<br />even when an item is out of stock.</h2>
          <p className="sp-intel-sub">
            When a requested variant is unavailable, SellPilot can suggest matching
            alternatives from your approved catalog.
            Keep more product conversations moving.
          </p>
          <ul className="sp-intel-bullets">
            <li><CheckCircle2 size={14} />Looks up your real product catalog</li>
            <li><CheckCircle2 size={14} />Suggests available alternatives automatically</li>
            <li><CheckCircle2 size={14} />Your team reviews and approves the catalog</li>
          </ul>
        </motion.div>

        <motion.div
          className="sp-intel-visual"
          initial={reduced ? {} : { opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={t(0.1)}
        >
          {/* Card 1: Customer request */}
          <div className="sp-intel-card sp-intel-card-request">
            <div className="sp-intel-card-header">
              <span className="sp-intel-avatar">T</span>
              <div>
                <strong>Tanvir</strong>
                <small>Messenger</small>
              </div>
            </div>
            <p className="sp-intel-bubble customer">&ldquo;Black hoodie size L ache?&rdquo;</p>
          </div>

          {/* Card 2: Lookup */}
          <div className="sp-intel-card sp-intel-card-lookup">
            <div className="sp-intel-lookup-row">
              <Sparkles size={13} />
              <span>Checking catalog…</span>
            </div>
            <div className="sp-intel-sku">
              <Package size={13} />
              <div>
                <strong>Black Fleece Hoodie (L)</strong>
                <span className="sp-intel-out"><XCircle size={11} /> Out of stock</span>
              </div>
            </div>
            <div className="sp-intel-sku sp-intel-sku-alt">
              <Package size={13} />
              <div>
                <strong>Navy Cotton Sweatshirt (L)</strong>
                <span className="sp-intel-in"><CheckCircle2 size={11} /> In stock</span>
              </div>
            </div>
          </div>

          {/* Card 3: SellPilot response */}
          <div className="sp-intel-card sp-intel-card-reply">
            <div className="sp-intel-agent-label">
              <Sparkles size={10} /> SELLPILOT
            </div>
            <p className="sp-intel-bubble agent">
              &ldquo;Black (L) ta ektu shortage e ache. Navy Cotton Sweatshirt (L) available — same fit, similar design. Dekhte chai?&rdquo;
            </p>
            <div className="sp-intel-result">
              <CheckCircle2 size={13} /> Alternative suggested · Example interaction
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
