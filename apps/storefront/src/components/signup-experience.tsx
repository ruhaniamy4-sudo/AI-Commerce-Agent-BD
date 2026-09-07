"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bot,
  CheckCheck,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Paperclip,
  ShieldCheck,
  User,
} from "lucide-react";

export function SignupExperience() {
  const shouldReduceMotion = useReducedMotion();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Chat entrance and progressive conversation state
  const [hasEntered, setHasEntered] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Progressive conversation sequence once panel settles
  useEffect(() => {
    if (!hasEntered) return;

    const timers: NodeJS.Timeout[] = [];

    // STEP 1: Show first typing indicator after a brief pause
    timers.push(setTimeout(() => setIsTyping(true), 250));

    // STEP 1 reveal: Hide typing & reveal AI greeting (Hello! 👋 ...)
    timers.push(
      setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(1);
      }, 1000)
    );

    // STEP 2: Natural pause, then reveal USER message
    timers.push(
      setTimeout(() => {
        setVisibleMessages(2);
      }, 1850)
    );

    // STEP 3: Show second typing indicator
    timers.push(setTimeout(() => setIsTyping(true), 2500));

    // STEP 3 reveal: Hide typing & reveal AI response
    timers.push(
      setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(3);
      }, 3450)
    );

    // STEP 4: Short pause, then reveal AI follow-up (Shall we get you started?)
    timers.push(
      setTimeout(() => {
        setVisibleMessages(4);
      }, 4100)
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [hasEntered]);

  // Smooth scroll to keep the latest message in view as conversation unfolds
  useEffect(() => {
    if (visibleMessages > 0 || isTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [visibleMessages, isTyping]);

  // Dynamic Password Strength Evaluation
  const getPasswordStrength = (pass: string) => {
    if (!pass || pass.length === 0) return null;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    // Weak: short (<6) or simple score
    if (pass.length < 6 || score <= 2) {
      return { label: "Weak", bars: 1 };
    }
    // Strong: 8+ chars and good mix
    if (pass.length >= 8 && score >= 4) {
      return { label: "Strong", bars: 4 };
    }
    // Medium
    return { label: "Medium", bars: 2 };
  };

  const strengthInfo = getPasswordStrength(password);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 700);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#060719] font-sans text-slate-100 selection:bg-violet-500 selection:text-white">
      {/* ========================================================================= */}
      {/* ATMOSPHERIC CONTINUOUS BACKGROUND                                         */}
      {/* Deep cosmic night on left -> Luminous Violet -> Soft Lavender on right    */}
      {/* ========================================================================= */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Continuous gradient canvas */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060719] via-[#100B29] to-[#1E113E] lg:to-[#E2DCF3]" />

        {/* Ambient luminous cloud masses */}
        <div
          className="absolute -top-36 -left-24 h-[700px] w-[700px] rounded-full bg-gradient-to-br from-[#7C3AED]/25 via-[#6C3BFF]/15 to-transparent blur-[140px]"
          style={{ transform: "translate3d(0,0,0)" }}
        />
        <div
          className="absolute top-1/3 left-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-[#9333EA]/20 via-[#4F46E5]/15 to-transparent blur-[130px]"
          style={{ transform: "translate3d(0,0,0)" }}
        />
        <div
          className="absolute -bottom-48 left-12 h-[650px] w-[650px] rounded-full bg-[#1E1B4B]/30 blur-[150px]"
          style={{ transform: "translate3d(0,0,0)" }}
        />

        {/* Right side environmental soft-lavender atmosphere */}
        <div
          className="absolute -top-28 -right-20 h-[750px] w-[750px] rounded-full bg-gradient-to-bl from-purple-200/70 via-violet-300/40 to-transparent blur-[110px]"
          style={{ transform: "translate3d(0,0,0)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[650px] w-[650px] rounded-full bg-gradient-to-tl from-indigo-200/60 via-purple-300/30 to-transparent blur-[120px]"
          style={{ transform: "translate3d(0,0,0)" }}
        />

        {/* Fine background star nodes */}
        <div className="absolute top-20 left-[12%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_8px_#fff]" />
        <div className="absolute top-44 left-[36%] h-1 w-1 rounded-full bg-violet-300/80 shadow-[0_0_6px_#c4b5fd]" />
        <div className="absolute top-[68%] left-[7%] h-1.5 w-1.5 rounded-full bg-cyan-200/70 shadow-[0_0_8px_#a5f3fc]" />
        <div className="absolute top-[82%] left-[26%] h-1 w-1 rounded-full bg-white/60" />
        <div className="absolute top-32 left-[46%] h-1.5 w-1.5 rounded-full bg-purple-300/80 shadow-[0_0_8px_#d8b4fe]" />

        {/* Sparkle cross */}
        <div className="absolute top-28 left-[30%] text-violet-300/30 select-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" />
          </svg>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTAINER                                                */}
      {/* Upper-left logo removed as instructed; space breathes naturally.          */}
      {/* ========================================================================= */}
      <main className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-12 py-10 sm:py-16 lg:py-20 min-h-screen flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">

          {/* ===================================================================== */}
          {/* LEFT COLUMN: SELLPILOT AI CHAT EXPERIENCE                             */}
          {/* Panel rises from below on load, settles, then conversation plays out   */}
          {/* Mobile order: order-2 (shown below signup card on mobile).            */}
          {/* ===================================================================== */}
          <div className="order-2 lg:order-1 lg:col-span-6 xl:col-span-6 flex flex-col justify-center items-center lg:items-start relative">

            {/* Container for Chat Card + Orbital Elements */}
            <div className="relative w-full max-w-[480px] mx-auto lg:mx-0">

              {/* =================================================================== */}
              {/* LUMINOUS ORBITAL ARC & GLOWING ENERGY BEAM                          */}
              {/* Looping high into the upper negative space above the chat card       */}
              {/* =================================================================== */}
              <div className="pointer-events-none absolute -top-36 -bottom-16 -left-16 -right-16 hidden md:block select-none overflow-visible z-0">
                <svg className="w-full h-full" viewBox="0 0 600 740" fill="none">
                  {/* Dotted elliptical orbital path */}
                  <ellipse
                    cx="300"
                    cy="410"
                    rx="265"
                    ry="330"
                    stroke="rgba(168, 85, 247, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="5 7"
                  />
                  {/* Vivid neon energy beam looping over top apex */}
                  <path
                    d="M 40 400 C 50 200, 140 80, 300 80 C 460 80, 560 200, 565 410 C 570 520, 490 640, 370 700"
                    stroke="url(#neon-streak)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    filter="url(#glow-filter)"
                  />
                  {/* Secondary lower energy streak under chat card */}
                  <path
                    d="M 100 640 C 200 700, 350 710, 470 650"
                    stroke="url(#neon-streak-bottom)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    filter="url(#glow-filter)"
                  />
                  <defs>
                    <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient id="neon-streak" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#A855F7" stopOpacity="0" />
                      <stop offset="25%" stopColor="#D946EF" stopOpacity="0.85" />
                      <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
                      <stop offset="75%" stopColor="#C084FC" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="neon-streak-bottom" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#A855F7" stopOpacity="0" />
                      <stop offset="50%" stopColor="#C084FC" stopOpacity="0.7" />
                      <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Intense Anamorphic Lens Flare at top apex (in open sky above card) */}
                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                  <div className="h-4 w-4 rounded-full bg-white shadow-[0_0_25px_8px_rgba(255,255,255,1),0_0_50px_20px_rgba(217,70,239,0.9)]" />
                  <div className="absolute h-[2px] w-72 bg-gradient-to-r from-transparent via-white to-transparent blur-[0.5px]" />
                  <div className="absolute h-14 w-14 rounded-full bg-fuchsia-500/40 blur-lg" />
                </div>
              </div>

              {/* 4 FLOATING GLASS BADGES (Independent timing & phase offsets) */}
              {/* 1. Top badge: Message bubble */}
              <motion.div
                animate={shouldReduceMotion ? {} : { y: [-2, 2, -2], x: [-1, 1, -1] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                className="hidden md:flex absolute -top-14 left-[54%] -translate-x-1/2 z-20 items-center justify-center h-12 w-12 rounded-2xl bg-[#140D2F]/90 backdrop-blur-xl border border-violet-400/50 shadow-[0_0_24px_rgba(168,85,247,0.45)] text-violet-300 will-change-transform"
              >
                <MessageSquare className="h-5 w-5 text-violet-200" />
              </motion.div>

              {/* 2. Upper-Right badge: Analytics Chart */}
              <motion.div
                animate={shouldReduceMotion ? {} : { y: [2, -2, 2], x: [1, -1, 1] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="hidden md:flex absolute top-[18%] -right-7 xl:-right-8 z-20 items-center justify-center h-12 w-12 rounded-2xl bg-[#140D2F]/90 backdrop-blur-xl border border-violet-400/50 shadow-[0_0_24px_rgba(168,85,247,0.45)] text-violet-300 will-change-transform"
              >
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </motion.div>

              {/* 3. Lower-Right badge: Customer Support / Agent */}
              <motion.div
                animate={shouldReduceMotion ? {} : { y: [-2.5, 2.5, -2.5], x: [-1, 1, -1] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.0 }}
                className="hidden md:flex absolute bottom-[20%] -right-7 xl:-right-8 z-20 items-center justify-center h-12 w-12 rounded-2xl bg-[#140D2F]/90 backdrop-blur-xl border border-violet-400/50 shadow-[0_0_24px_rgba(168,85,247,0.45)] text-violet-300 will-change-transform"
              >
                <Headphones className="h-5 w-5 text-cyan-300" />
              </motion.div>

              {/* 4. Far-Left badge: Multi-channel chat */}
              <motion.div
                animate={shouldReduceMotion ? {} : { y: [2, -2, 2], x: [1, -1, 1] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="hidden md:flex absolute top-[44%] -left-7 xl:-left-8 z-20 items-center justify-center h-12 w-12 rounded-2xl bg-[#140D2F]/90 backdrop-blur-xl border border-violet-400/50 shadow-[0_0_24px_rgba(168,85,247,0.45)] text-violet-300 will-change-transform"
              >
                <MessageCircle className="h-5 w-5 text-purple-200" />
              </motion.div>

              {/* =================================================================== */}
              {/* THE CHAT CARD ENTRANCE & BUTTERY AMBIENT FLOAT                      */}
              {/* Outer container handles rising entrance from below;                */}
              {/* Inner container handles continuous 3.0s buttery ambient float.     */}
              {/* =================================================================== */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0.3 : 0.75,
                  delay: shouldReduceMotion ? 0 : 0.2,
                  ease: [0.16, 1, 0.3, 1], // confident, smooth, tiny spring-like settle
                }}
                onAnimationComplete={() => setHasEntered(true)}
                className="relative w-full will-change-transform z-10"
              >
                <motion.div
                  animate={
                    shouldReduceMotion || !hasEntered
                      ? {}
                      : { y: [-3, 3, -3] }
                  }
                  transition={{
                    duration: 3.0,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative w-full rounded-[28px] sm:rounded-[32px] bg-[#0E0926]/85 backdrop-blur-2xl border border-violet-400/25 p-5 sm:p-6 shadow-[0_20px_60px_rgba(3,1,16,0.7)] will-change-transform"
                >
                  {/* Card top edge subtle neon highlight */}
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-violet-300/40 to-transparent" />

                  {/* Chat Card Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                    <div className="flex items-center gap-3">
                      {/* Bot Avatar with glowing eyes & breathing halo */}
                      <div className="relative">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#6C3BFF] to-[#D92EFF] flex items-center justify-center text-white shadow-[0_4px_16px_rgba(108,59,255,0.45)]">
                          <Bot className="h-6 w-6" />
                        </div>
                        {/* Static soft halo glow */}
                        <div className="absolute -inset-1 rounded-2xl bg-violet-500/35 blur-[6px] -z-10 animate-pulse" />
                      </div>

                      <div>
                        <h3 className="font-bold text-white text-[15px] sm:text-base tracking-tight">
                          SellPilot AI Agent
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                          <span className="text-xs font-medium text-slate-400">Online</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progressive Chat Conversation Stream */}
                  <div className="py-5 space-y-3.5 min-h-[250px] sm:min-h-[270px] flex flex-col justify-start">

                    {/* Message 1 (AI Bot Greeting) - Introduced on Step 1 */}
                    <AnimatePresence>
                      {visibleMessages >= 1 && (
                        <motion.div
                          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="flex items-start gap-2.5 max-w-[85%]"
                        >
                          <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] backdrop-blur-md border border-white/[0.09] p-3 sm:p-3.5 text-slate-100 shadow-sm">
                            <p className="text-[13px] sm:text-[13.5px] leading-relaxed text-slate-200">
                              Hello! 👋 How can SellPilot help your business today?
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                              <span>10:30 AM</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Message 2 (User Message) - Introduced on Step 2 */}
                    <AnimatePresence>
                      {visibleMessages >= 2 && (
                        <motion.div
                          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="flex justify-end"
                        >
                          <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#6C3BFF] to-[#8B35FF] p-3 sm:p-3.5 text-white shadow-[0_4px_18px_rgba(108,59,255,0.3)]">
                            <p className="text-[13px] sm:text-[13.5px] leading-relaxed font-normal">
                              I want to automate customer support and increase sales.
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-violet-200/80">
                              <span>10:31 AM</span>
                              <CheckCheck className="h-3.5 w-3.5 text-cyan-300" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Message 3 (AI Response) - Introduced on Step 3 */}
                    <AnimatePresence>
                      {visibleMessages >= 3 && (
                        <motion.div
                          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="flex items-start gap-2.5 max-w-[90%]"
                        >
                          <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] backdrop-blur-md border border-white/[0.09] p-3 sm:p-3.5 text-slate-100 shadow-sm">
                            <p className="text-[12.5px] sm:text-[13px] leading-relaxed text-slate-200">
                              Great goal! I can help you with that. I can handle customer conversations, recommend products, and even place orders for you.
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                              <span>10:31 AM</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Message 4 (AI Follow-up) - Introduced on Step 4 */}
                    <AnimatePresence>
                      {visibleMessages >= 4 && (
                        <motion.div
                          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="flex items-start gap-2.5 max-w-[80%]"
                        >
                          <div className="rounded-2xl rounded-tl-sm bg-white/[0.07] backdrop-blur-md border border-white/[0.09] px-3.5 py-2 text-slate-100 shadow-sm">
                            <p className="text-[12.5px] sm:text-[13px] font-medium text-slate-200">
                              Shall we get you started?
                            </p>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                              <span>10:31 AM</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Real Dynamic Typing Indicator (Only visible when AI is actively composing) */}
                    <AnimatePresence>
                      {isTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2 pt-1"
                        >
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" />
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            SellPilot AI is typing...
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat Input Box */}
                  <div className="pt-2 border-t border-white/[0.08]">
                    <div className="relative flex items-center gap-2 rounded-2xl bg-white/[0.06] border border-white/[0.1] px-3.5 py-2 text-sm text-slate-300 transition-colors focus-within:border-violet-500/50">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                        title="Attach file"
                        aria-label="Attach file"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <input
                        type="text"
                        readOnly
                        placeholder="Ask me anything..."
                        className="w-full bg-transparent text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none cursor-default"
                      />
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                        title="Voice message"
                        aria-label="Voice input"
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6C3BFF] text-white shadow-[0_2px_8px_rgba(108,59,255,0.4)] hover:brightness-110 active:scale-95 transition-all shrink-0"
                        aria-label="Send message"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                </motion.div>
              </motion.div>
            </div>

          </div>

          {/* ===================================================================== */}
          {/* RIGHT COLUMN: SIGNUP FORM CARD                                        */}
          {/* Surface: Crisp Pale Lavender / Cool-white with subtle purple sheen    */}
          {/* Layout: Full Name & Email side-by-side on sm+ screens                 */}
          {/* Ends cleanly after "Already have an account? Log in" (no strip)       */}
          {/* ===================================================================== */}
          <div className="order-1 lg:order-2 lg:col-span-6 xl:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[560px] rounded-[32px] sm:rounded-[36px] bg-[#FAF8FE]/95 backdrop-blur-2xl border border-violet-200/80 shadow-[0_25px_80px_rgba(12,8,45,0.22)] p-6 sm:p-8 lg:p-9 text-slate-900 transition-all">

              {/* Eyebrow badge: exact requested copy, no rocket emoji */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100/90 text-[#6C3BFF] border border-violet-200/60 mb-3 sm:mb-4 shadow-2xs">
                <span>Get Started for Free on SellPilot</span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight text-slate-900 leading-tight">
                Create Your Account
              </h1>
              <p className="mt-2 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                Register now, give it a try and see how our AI agent helps your business grow.
              </p>

              {/* Signup Form */}
              <form onSubmit={handleSubmit} className="mt-6 sm:mt-7 space-y-4">

                {/* ROW 1: Full Name & Email Address (Side-by-side on sm+ screens) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        id="signup-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your name"
                        autoComplete="name"
                        className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        id="signup-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        autoComplete="email"
                        className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 2: Password with show/hide toggle */}
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 transition-all shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength UI: ONLY SHOWN WHEN password.length > 0 */}
                  <AnimatePresence>
                    {password.length > 0 && strengthInfo && (
                      <motion.div
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden mt-2 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            Use 8+ characters with a mix of letters, numbers & symbols
                          </span>
                          <span
                            className={`font-semibold flex items-center gap-1 ${
                              strengthInfo.label === "Strong"
                                ? "text-emerald-600"
                                : strengthInfo.label === "Medium"
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {strengthInfo.label}
                            <span
                              className={`h-1.5 w-1.5 rounded-full inline-block ${
                                strengthInfo.label === "Strong"
                                  ? "bg-emerald-500"
                                  : strengthInfo.label === "Medium"
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                            />
                          </span>
                        </div>
                        {/* 4-segment strength bar */}
                        <div className="grid grid-cols-4 gap-1.5 h-1">
                          {[1, 2, 3, 4].map((seg) => (
                            <div
                              key={seg}
                              className={`rounded-full transition-colors duration-300 ${
                                strengthInfo.bars >= seg
                                  ? strengthInfo.label === "Strong"
                                    ? "bg-emerald-500"
                                    : strengthInfo.label === "Medium"
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                  : "bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 h-12 rounded-xl bg-gradient-to-r from-[#6C3BFF] via-[#8B35FF] to-[#D92EFF] text-white font-bold text-sm sm:text-base tracking-tight shadow-[0_6px_22px_rgba(108,59,255,0.38)] hover:shadow-[0_8px_28px_rgba(108,59,255,0.55)] hover:brightness-105 active:scale-[0.99] disabled:opacity-75 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Creating Account...
                    </span>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Submission notice */}
                {isSubmitted && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Account registration request received! Redirecting to setup...</span>
                  </div>
                )}

              </form>

              {/* Or Divider */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-[#FAF8FE] px-3 text-xs font-medium text-slate-400">
                  or sign up with
                </span>
              </div>

              {/* Social Login Buttons: Google & Facebook */}
              <div className="grid grid-cols-2 gap-3">
                {/* Google Button */}
                <button
                  type="button"
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                {/* Facebook Button */}
                <button
                  type="button"
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
                >
                  <svg className="h-4 w-4 shrink-0 fill-[#1877F2]" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </button>
              </div>

              {/* Login switch link (Card ends cleanly here, no extra bottom strip) */}
              <p className="mt-5 text-center text-xs sm:text-sm text-slate-600">
                Already have an account?{" "}
                <Link
                  href="/signin"
                  className="font-bold text-[#6C3BFF] hover:text-[#8B35FF] transition-colors"
                >
                  Log in
                </Link>
              </p>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
