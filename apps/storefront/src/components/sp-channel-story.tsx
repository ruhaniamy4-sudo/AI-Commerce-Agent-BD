"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { ChannelIcon } from "./hero/customer-notification";

const messages = [
  { name: "Tanvir", channel: "messenger" as const, text: "Black hoodie L size ache?", delay: 0 },
  { name: "Nusrat", channel: "whatsapp" as const, text: "Delivery charge koto Mirpur te?", delay: 0.15 },
  { name: "Visitor", channel: "website" as const, text: "Do you ship to Chittagong?", delay: 0.3 },
  { name: "Rafi", channel: "messenger" as const, text: "Return policy ki?", delay: 0.45 },
  { name: "Sadia", channel: "whatsapp" as const, text: "COD available?", delay: 0.6 },
];

export function SpChannelStory() {
  const reduced = useReducedMotion();

  return (
    <section className="sp-channel-root" id="channel-story">
      <div className="sp-channel-glow" aria-hidden="true" />
      <div className="sp-wrap sp-channel-inner">
        <div className="sp-channel-copy">
          <p className="sp-kicker"><Sparkles size={11} />Every channel, one agent</p>
          <h2>Customers are messaging.<br /><span>SellPilot is on it.</span></h2>
          <p className="sp-channel-sub">
            Questions arrive across Messenger, WhatsApp, and website chat — simultaneously,
            at any hour. SellPilot handles each one with the right context from your catalog
            and business knowledge.
          </p>
          <div className="sp-channel-icons">
            <span className="sp-chan-badge messenger">
              <ChannelIcon channel="messenger" /> Messenger
            </span>
            <span className="sp-chan-badge whatsapp">
              <ChannelIcon channel="whatsapp" /> WhatsApp <small>Soon</small>
            </span>
            <span className="sp-chan-badge website">
              <ChannelIcon channel="website" /> Website
            </span>
          </div>
        </div>

        <div className="sp-message-stream" aria-hidden="true">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`sp-stream-pill sp-stream-pill-${msg.channel}`}
              initial={reduced ? {} : { opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: msg.delay }}
            >
              <span className="sp-stream-avatar">{msg.name[0]}</span>
              <div>
                <strong>{msg.name}</strong>
                <p>{msg.text}</p>
              </div>
              <span className={`sp-stream-ch sp-stream-ch-${msg.channel}`}>
                <ChannelIcon channel={msg.channel} />
              </span>
            </motion.div>
          ))}
          <div className="sp-stream-agent">
            <Sparkles size={14} />
            <span>Illustrative: SellPilot active across channels</span>
          </div>
        </div>
      </div>
    </section>
  );
}
