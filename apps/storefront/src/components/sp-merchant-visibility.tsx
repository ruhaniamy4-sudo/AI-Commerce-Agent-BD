"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, MessageCircle, ShoppingBag, Sparkles, Bot, CheckCircle2 } from "lucide-react";

const recentItems = [
  { user: "Tanvir H.", ch: "Messenger", msg: "Size L hoodie — Alternative sent", state: "Handled", color: "blue" },
  { user: "Nusrat J.", ch: "WhatsApp", msg: "Delivery charge for Banani — Answered", state: "Handled", color: "green" },
  { user: "Sabbir A.", ch: "Website", msg: "Return policy — Answered", state: "Handled", color: "teal" },
  { user: "Farida B.", ch: "Messenger", msg: "Custom bulk order — Escalated to team", state: "Escalated", color: "violet" },
];

export function SpMerchantVisibility() {
  const reduced = useReducedMotion();
  const t = (delay = 0) => ({ duration: 0.65, ease: [0.22, 1, 0.36, 1] as [number,number,number,number], delay });

  return (
    <section className="sp-visibility-root">
      <div className="sp-visibility-glow" aria-hidden="true" />
      <div className="sp-wrap">
        <motion.div
          className="sp-section-header"
          initial={reduced ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={t(0)}
        >
          <p className="sp-kicker"><BarChart3 size={11} />Merchant visibility</p>
          <h2>Every conversation.<br />One clear workspace.</h2>
          <p className="sp-section-sub">
            Your team sees what the AI is doing, which conversations were handled, 
            and when a human is needed — all in one view.
          </p>
        </motion.div>

        <motion.div
          className="sp-visibility-panel"
          initial={reduced ? {} : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={t(0.15)}
        >
          {/* Panel header */}
          <div className="sp-vp-header">
            <div className="sp-vp-brand">
              <div className="sp-vp-avatar"><Bot size={16} /></div>
              <div>
                <strong>SellPilot Workspace</strong>
                <small>Illustrative preview</small>
              </div>
            </div>
            <span className="sp-vp-live"><span />Live</span>
          </div>

          {/* Key signals */}
          <div className="sp-vp-signals">
            <div className="sp-vp-signal">
              <MessageCircle size={16} />
              <div>
                <strong>Conversations</strong>
                <small>Active now</small>
              </div>
            </div>
            <div className="sp-vp-signal">
              <ShoppingBag size={16} />
              <div>
                <strong>Orders captured</strong>
                <small>Today</small>
              </div>
            </div>
            <div className="sp-vp-signal">
              <Sparkles size={16} />
              <div>
                <strong>AI responses</strong>
                <small>Sent this session</small>
              </div>
            </div>
            <div className="sp-vp-signal sp-vp-signal-alert">
              <CheckCircle2 size={16} />
              <div>
                <strong>Team takeover</strong>
                <small>Available anytime</small>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="sp-vp-feed">
            <div className="sp-vp-feed-header">
              <span>Recent Conversations</span>
              <span className="sp-vp-stream-label">Illustrative examples</span>
            </div>
            {recentItems.map((item, i) => (
              <div key={i} className="sp-vp-feed-row">
                <div className="sp-vp-user">
                  <span className="sp-vp-user-avatar">{item.user[0]}</span>
                  <div>
                    <strong>{item.user}</strong>
                    <small>via {item.ch}</small>
                  </div>
                </div>
                <span className="sp-vp-msg">{item.msg}</span>
                <span className={`sp-vp-state sp-vp-state-${item.color}`}>{item.state}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
