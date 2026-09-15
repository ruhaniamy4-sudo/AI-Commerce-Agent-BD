"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { SellPilotMascot } from "./mascot/sellpilot-mascot";

export function SpRobotHero() {
  const reduced = useReducedMotion();

  const fadeUp = { initial: reduced ? {} : { opacity: 0, y: 28 } as const, animate: { opacity: 1, y: 0 } as const };
  const t = (delay = 0) => ({ duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number,number,number,number], delay });

  return (
    <section className="sp-hero-root" aria-label="SellPilot hero">
      <div className="sp-hero-atmosphere" aria-hidden="true">
        <span className="sp-atm-orb sp-atm-orb-1" />
        <span className="sp-atm-orb sp-atm-orb-2" />
        <span className="sp-atm-orb sp-atm-orb-3" />
      </div>
      <div className="sp-wrap sp-hero-grid">
        {/* LEFT: Copy */}
        <div className="sp-hero-copy">
          <motion.div className="sp-hero-badge" {...fadeUp} transition={t(0.05)}>
            <Sparkles size={11} /><span>Your AI sales team</span>
          </motion.div>
          <motion.h1 {...fadeUp} transition={t(0.15)}>
            Never miss<br /><span className="sp-hero-accent">a customer</span><br />message.
          </motion.h1>
          <motion.p className="sp-hero-sub" {...fadeUp} transition={t(0.25)}>
            SellPilot answers customer questions, finds products, and gets orders moving — across Messenger, WhatsApp, and website chat.
          </motion.p>
          <motion.div className="sp-hero-actions" {...fadeUp} transition={t(0.35)}>
            <Link href="/signup" className="sp-btn sp-btn-primary">Get started <ArrowRight size={15} /></Link>
            <Link href="#demo-section" className="sp-btn sp-btn-ghost"><Play size={12} /> See it in action</Link>
          </motion.div>
          <motion.div className="sp-hero-channels" {...fadeUp} transition={t(0.45)}>
            <span className="sp-channel-pill messenger"><span className="sp-channel-dot" />Messenger</span>
            <span className="sp-channel-pill whatsapp"><span className="sp-channel-dot" />WhatsApp<small>Soon</small></span>
            <span className="sp-channel-pill website"><span className="sp-channel-dot" />Website Chat</span>
          </motion.div>
        </div>

        {/* RIGHT: 3D Robot */}
        <motion.div className="sp-hero-robot"
          initial={reduced ? {} : { opacity: 0, scale: 0.96 } as const}
          animate={{ opacity: 1, scale: 1 }}
          transition={t(0.2)}
        >
          <div className="sp-robot-glow" aria-hidden="true" />
          <SellPilotMascot
            size="full"
            pose="hero"
            status="idle"
            scale={0.46}
            position={[0, 1.45, 0]}
            interactive
            className="w-full h-full"
          />
          <motion.div className="sp-robot-status"
            initial={reduced ? {} : { opacity: 0, x: 16 } as const}
            animate={{ opacity: 1, x: 0 }}
            transition={t(0.65)}
            aria-hidden="true"
          >
            <span className="sp-status-orb" />
            <span><strong>Always on</strong><small>Responding now</small></span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
