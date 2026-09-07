"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import { CHANNELS } from "@/lib/marketing-config";
import {
  ChannelIcon,
  CustomerNotification,
} from "./hero/customer-notification";
import { SalesPhone } from "./hero/sales-phone";
import {
  CHANNEL_NAMES,
  NOTIFICATION_TRACKS,
  PHONE_BEATS,
  PHONE_CYCLE,
  PREVIEW_EASE as ease,
  getPhoneStage,
  usePreviewClock,
  type Channel,
} from "./hero/preview-timeline";

export function HomeSalesAgent() {
  const heroRef = useRef<HTMLElement>(null);
  const inView = useInView(heroRef, { margin: "50px" });
  const reduced = !!useReducedMotion();
  const [paused, setPaused] = useState(false);
  const { elapsed, running } = usePreviewClock(inView && !paused && !reduced);
  const time = reduced ? PHONE_BEATS.order : elapsed % PHONE_CYCLE;
  const stage = getPhoneStage(time);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -45]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const satellitesY = useTransform(scrollYProgress, [0, 1], [0, -95]);
  const satellitesOpacity = useTransform(
    scrollYProgress,
    [0, 0.5, 0.85],
    [1, 0.8, 0],
  );
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0.15]);

  return (
    <section
      className="sales-hero"
      ref={heroRef}
      data-motion={running ? "running" : "paused"}
      data-preview-stage={stage.key}
    >
      <div className="sales-hero-atmosphere" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="sp-wrap sales-hero-grid">
        <div className="sales-hero-heading">
          <p className="sales-eyebrow">
            <span /> YOUR ALWAYS-ON AI SALES AGENT
          </p>
          <h1>
            Customers <br />
            are waiting.
            <br />
            <span>
              Your competitors <br />
              are replying.
            </span>
          </h1>
          <p className="sales-hero-description">
            Don’t let the next sale wait. SellPilot answers customer questions,
            finds the right products, and gets orders moving.
          </p>
          <div className="fig-actions">
            <Link href="/signup" className="fig-primary">
              Let SellPilot reply <ArrowRight size={16} />
            </Link>
            <Link href="#workflow" className="fig-secondary">
              <Play size={12} /> See it in action
            </Link>
          </div>
          <p className="sales-hero-note">
            <Check size={12} /> Your products. Your voice. Every conversation.
          </p>
        </div>

        <div className="sales-scene-wrap">
          <p className="sr-only">
            Animated example: customer questions arrive continuously from
            Messenger, WhatsApp, and website chat. SellPilot understands a
            sneaker inquiry, checks the catalog, recommends a product, and
            starts an order. Products and conversations are illustrative.
            WhatsApp is coming soon.
          </p>
          <motion.div
            className="sales-scene"
            aria-hidden="true"
            style={
              reduced ? undefined : { scale: sceneScale, opacity: sceneOpacity }
            }
          >
            <div className="sales-pressure">
              <span />
              <p>CUSTOMERS ARE MESSAGING</p>
              <i />
              <i />
              <i />
            </div>
            <div className="sales-orbits">
              <i />
              <i />
              <i />
              <span className="sales-orbit-star star-one" />
              <span className="sales-orbit-star star-two" />
              <span className="sales-orbit-star star-three" />
            </div>
            <svg className="sales-connectors" viewBox="0 0 680 590" fill="none">
              <path d="M125 80 C160 80 180 150 230 170 M580 125 C540 140 500 170 450 195 M100 280 C170 270 180 265 230 260 M580 365 C540 350 500 330 450 320 M130 490 C160 490 180 430 230 420 M560 540 C520 520 500 480 440 455" />
            </svg>
            <motion.div
              className="sales-satellites"
              style={
                reduced
                  ? undefined
                  : { y: satellitesY, opacity: satellitesOpacity }
              }
            >
              {NOTIFICATION_TRACKS.map((_, index) => (
                <CustomerNotification
                  key={index}
                  index={index}
                  elapsed={elapsed}
                  reduced={reduced}
                />
              ))}
            </motion.div>
            <motion.div
              className="sales-phone-position"
              style={reduced ? undefined : { y: phoneY }}
            >
              <SalesPhone time={time} reduced={reduced} />
            </motion.div>
            <div className="sales-agent-status" data-stage={stage.key}>
              <span className="sales-status-orb">
                {stage.key === "order" ? (
                  <Check size={15} />
                ) : (
                  <Sparkles size={15} />
                )}
              </span>
              <span>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </span>
            </div>
          </motion.div>
          <div className="sales-scene-caption">
            <span>Illustrative conversations & products</span>
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
              aria-label={
                paused
                  ? "Resume preview animations"
                  : "Pause preview animations"
              }
              disabled={reduced}
            >
              {paused || reduced ? <Play size={10} /> : <Pause size={10} />}
              {reduced ? "Reduced motion" : paused ? "Resume" : "Pause"}
            </button>
          </div>
        </div>
      </div>
      <div className="sp-wrap sales-channel-strip">
        <p>
          Questions everywhere.
          <br />
          <strong>One agent on it.</strong>
        </p>
        <div>
          {(Object.keys(CHANNEL_NAMES) as Channel[]).map((channel) => (
            <span className="sales-channel-label" key={channel}>
              <ChannelIcon channel={channel} />
              <span>
                {CHANNEL_NAMES[channel]}
                {CHANNELS[channel] === "coming-soon" && (
                  <small>Coming soon</small>
                )}
              </span>
            </span>
          ))}
        </div>
        <Link
          href="#workflow"
          className="sales-scroll-cue"
          aria-label="Explore how SellPilot works"
        >
          <ArrowDown size={16} />
        </Link>
      </div>
    </section>
  );
}

export function HomeReveal({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduceMotion ? 0 : 0.85, ease }}
    >
      {children}
    </motion.section>
  );
}

function StoryWord({
  children,
  progress,
  start,
  end,
}: {
  children: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useTransform(progress, [start, end], [0.22, 1]);
  return (
    <motion.span style={{ opacity: reduceMotion ? 1 : opacity }}>
      {children}{" "}
    </motion.span>
  );
}

export function HomeScrollStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 65%"],
  });
  const words =
    "The messages don’t stop. Your sales agent doesn’t either.".split(" ");
  return (
    <section className="sales-scroll-story" ref={ref}>
      <div className="sp-wrap">
        <p className="sales-eyebrow">
          <Sparkles size={13} /> FROM MESSAGE PRESSURE TO SALES MOMENTUM
        </p>
        <h2>
          {words.map((word, index) => (
            <StoryWord
              key={index}
              progress={scrollYProgress}
              start={(index / words.length) * 0.75}
              end={((index + 1) / words.length) * 0.75}
            >
              {word}
            </StoryWord>
          ))}
        </h2>
        <p>
          Let your AI handle the everyday questions.
          <br />
          Give your team more room to grow the business.
        </p>
      </div>
    </section>
  );
}
