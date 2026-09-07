"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";

export function LoginExperience() {
  const shouldReduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Progressive Workflow Animation Timeline
  // Step 0: Initial atmosphere & agent rise
  // Step 1: "1. Chat" node activates
  // Step 2: Customer message travels & "Hi! How can I help you today?" message card appears
  // Step 3: "2. Understand" node activates
  // Step 4: Central AI brain & orb reaction glow
  // Step 5: Energy pulse travels & "3. Act" node activates
  // Step 6: "4. Complete" node activates (settled state)
  const [animStep, setAnimStep] = useState<number>(0);
  const currentStep = shouldReduceMotion ? 6 : animStep;

  useEffect(() => {
    if (shouldReduceMotion) return;

    const timeline = [
      { step: 1, delay: 600 },   // 1. Chat node activates
      { step: 2, delay: 1300 },  // Message card appears
      { step: 3, delay: 2000 },  // 2. Understand activates
      { step: 4, delay: 2700 },  // AI brain processes
      { step: 5, delay: 3400 },  // 3. Act activates
      { step: 6, delay: 4200 },  // 4. Complete activates
    ];

    const timers = timeline.map(({ step, delay }) =>
      setTimeout(() => setAnimStep(step), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [shouldReduceMotion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#060719] font-sans text-slate-100 selection:bg-violet-500 selection:text-white">
      {/* ========================================================================= */}
      {/* ATMOSPHERIC CONTINUOUS BACKGROUND (Subtly Alive & Breathing)              */}
      {/* Deep cosmic night on left -> Luminous Violet -> Soft Lavender on right    */}
      {/* High-contrast depth: deep navy darkness + diffused violet clouds of LIGHT */}
      {/* ========================================================================= */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Continuous gradient base: deep cosmic night #060719 on far left */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060719] via-[#0D0826] to-[#1C103C] lg:to-[#E2DCF3]" />

        {/* 1. BLOOM A: Soft violet illumination entering from upper-left / behind workflow cards */}
        <motion.div
          animate={shouldReduceMotion ? {} : { x: [-6, 6, -6], y: [-4, 4, -4], opacity: [0.88, 1, 0.88] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-36 -left-20 h-[720px] w-[980px] rounded-[48%] bg-[radial-gradient(ellipse_at_35%_35%,_rgba(139,92,246,0.32)_0%,_rgba(124,58,237,0.20)_35%,_rgba(108,59,255,0.08)_60%,_transparent_75%)] blur-[120px] will-change-transform pointer-events-none"
        />

        {/* 1. BLOOM B: Brighter but diffused purple glow around & behind the AI focal area, spreading broadly */}
        <motion.div
          animate={shouldReduceMotion ? {} : { x: [5, -5, 5], y: [4, -4, 4], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute top-[22%] left-[8%] h-[700px] w-[860px] rounded-[52%_48%_55%_45%] bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.30)_0%,_rgba(147,51,234,0.18)_35%,_rgba(99,102,241,0.07)_60%,_transparent_75%)] blur-[115px] will-change-transform pointer-events-none"
        />

        {/* 1. BLOOM C: Pale lavender atmospheric illumination coming from far-right edge behind login area */}
        <motion.div
          animate={shouldReduceMotion ? {} : { scale: [1, 1.03, 1], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -right-40 h-[880px] w-[880px] rounded-[46%] bg-[radial-gradient(ellipse_at_70%_30%,_rgba(232,225,253,0.36)_0%,_rgba(216,196,254,0.24)_35%,_rgba(167,139,250,0.12)_60%,_transparent_75%)] blur-[130px] will-change-transform pointer-events-none"
        />
        <div className="absolute bottom-0 right-0 h-[650px] w-[650px] rounded-full bg-gradient-to-tl from-indigo-200/50 via-purple-300/25 to-transparent blur-[120px]" />

        {/* 2. LIGHT SWEEP: Extremely subtle broad diagonal light sweep through the dark area (Light, not a line) */}
        <motion.div
          animate={shouldReduceMotion ? {} : { opacity: [0.75, 0.95, 0.75], x: [-4, 4, -4], y: [-2, 2, -2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[18%] -left-20 h-[280px] w-[1150px] -rotate-[22deg] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(192,132,252,0.18)_0%,_rgba(147,51,234,0.14)_35%,_rgba(108,59,255,0.06)_60%,_transparent_80%)] blur-[75px] will-change-transform pointer-events-none"
        />

        {/* 4. FAINT DISTANT ORBITAL TRACES: Almost invisible atmospheric texture (3–6% opacity only) */}
        <div className="pointer-events-none absolute -top-8 -left-8 w-[880px] h-[640px] hidden md:block select-none overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 880 640" fill="none">
            {/* Distant orbital trace 1 (~5% opacity) */}
            <path
              d="M -40 430 C 180 210, 480 150, 800 230"
              stroke="rgba(192, 132, 252, 0.05)"
              strokeWidth="1.2"
            />
            {/* Distant orbital trace 2 (~4% opacity) */}
            <path
              d="M 50 540 C 270 390, 540 290, 840 350"
              stroke="rgba(168, 85, 247, 0.04)"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* 3. TINY STARLIGHT POINTS: 6 sparse points across the dark side with different sizes/brightness */}
        {/* Star 1 - Tiny crisp white starlight */}
        <div className="absolute top-[15%] left-[12%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_6px_#fff]" />
        {/* Star 2 - Soft cyan node with subtle slow twinkle pulse */}
        <motion.div
          animate={shouldReduceMotion ? {} : { opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[38%] left-[7%] h-1 w-1 rounded-full bg-cyan-200/70 shadow-[0_0_6px_#a5f3fc]"
        />
        {/* Star 3 - Pale violet star point */}
        <div className="absolute top-[28%] left-[44%] h-1.5 w-1.5 rounded-full bg-violet-300/80 shadow-[0_0_6px_#c4b5fd]" />
        {/* Star 4 - Faint white distant node */}
        <div className="absolute top-[62%] left-[16%] h-1 w-1 rounded-full bg-white/50" />
        {/* Star 5 - Soft purple starlight with subtle twinkle pulse */}
        <motion.div
          animate={shouldReduceMotion ? {} : { opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[78%] left-[34%] h-1.5 w-1.5 rounded-full bg-purple-300/70 shadow-[0_0_6px_#d8b4fe]"
        />
        {/* Star 6 - Subtle distant starlight */}
        <div className="absolute top-[86%] left-[10%] h-1 w-1 rounded-full bg-slate-300/40" />

        {/* Faint cross sparkle */}
        <div className="absolute top-24 left-[32%] text-violet-300/25 select-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" />
          </svg>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN CONTAINER                                                */}
      {/* Headings & stats removed; space rebalanced to make Workflow the Hero.    */}
      {/* ========================================================================= */}
      <main className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 py-10 sm:py-16 lg:py-20 min-h-screen flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">

          {/* ===================================================================== */}
          {/* LEFT COLUMN: SELLPILOT AI WORKFLOW (THE HERO STORYTELLING)            */}
          {/* Progressive animation: Chat -> Understand -> AI -> Act -> Complete   */}
          {/* Mobile order: order-2 (shown below login form on mobile).             */}
          {/* ===================================================================== */}
          <div className="order-2 lg:order-1 lg:col-span-7 xl:col-span-7 flex flex-col justify-center items-center lg:items-start relative w-full">

            {/* Rebalanced, Larger Workflow Composition */}
            <div className="relative w-full max-w-[620px] mx-auto lg:mx-0 py-6">

              {/* =================================================================== */}
              {/* CENTRAL WORKFLOW STAGES CONTAINER                                   */}
              {/* Row: Node 1 -> Node 2 -> Central AI Agent -> Node 3 -> Node 4       */}
              {/* =================================================================== */}
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3.5 sm:gap-3 items-center">

                {/* ----------------------------------------------------------------- */}
                {/* NODE 1: 1. Chat (Customer sends a message)                         */}
                {/* ----------------------------------------------------------------- */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  animate={{
                    opacity: currentStep >= 1 ? 1 : 0.4,
                    y: 0,
                    borderColor: currentStep >= 1 ? "rgba(168, 85, 247, 0.45)" : "rgba(255, 255, 255, 0.08)",
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`relative rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl border transition-all duration-500 ${
                    currentStep >= 1
                      ? "bg-[#120D2C]/90 shadow-[0_0_25px_rgba(168,85,247,0.25)]"
                      : "bg-[#0C0920]/60 border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                        currentStep >= 1
                          ? "bg-violet-600/30 text-violet-300 border border-violet-400/40 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                          : "bg-white/[0.05] text-slate-400 border border-white/[0.08]"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    {/* Active pulsing pulse dot */}
                    {currentStep >= 1 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-bold text-white tracking-tight">1. Chat</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight">
                    Customer sends a message
                  </p>
                </motion.div>

                {/* ----------------------------------------------------------------- */}
                {/* NODE 2: 2. Understand (AI understands intent & context)            */}
                {/* ----------------------------------------------------------------- */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  animate={{
                    opacity: currentStep >= 3 ? 1 : 0.4,
                    y: 0,
                    borderColor: currentStep >= 3 ? "rgba(192, 132, 252, 0.45)" : "rgba(255, 255, 255, 0.08)",
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`relative rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl border transition-all duration-500 ${
                    currentStep >= 3
                      ? "bg-[#140E32]/90 shadow-[0_0_25px_rgba(192,132,252,0.25)]"
                      : "bg-[#0C0920]/60 border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                        currentStep >= 3
                          ? "bg-purple-600/30 text-purple-300 border border-purple-400/40 shadow-[0_0_12px_rgba(192,132,252,0.4)]"
                          : "bg-white/[0.05] text-slate-400 border border-white/[0.08]"
                      }`}
                    >
                      <Brain className="h-4 w-4" />
                    </div>
                    {currentStep >= 3 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-bold text-white tracking-tight">2. Understand</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight">
                    AI understands intent & context
                  </p>
                </motion.div>

                {/* ----------------------------------------------------------------- */}
                {/* NODE 3: 3. Act (AI recommends, sells & takes action)               */}
                {/* ----------------------------------------------------------------- */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  animate={{
                    opacity: currentStep >= 5 ? 1 : 0.4,
                    y: 0,
                    borderColor: currentStep >= 5 ? "rgba(217, 70, 239, 0.45)" : "rgba(255, 255, 255, 0.08)",
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`relative rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl border transition-all duration-500 ${
                    currentStep >= 5
                      ? "bg-[#180F38]/90 shadow-[0_0_25px_rgba(217,70,239,0.25)]"
                      : "bg-[#0C0920]/60 border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                        currentStep >= 5
                          ? "bg-fuchsia-600/30 text-fuchsia-300 border border-fuchsia-400/40 shadow-[0_0_12px_rgba(217,70,239,0.4)]"
                          : "bg-white/[0.05] text-slate-400 border border-white/[0.08]"
                      }`}
                    >
                      <Zap className="h-4 w-4" />
                    </div>
                    {currentStep >= 5 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-bold text-white tracking-tight">3. Act</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight">
                    AI recommends, sells & acts
                  </p>
                </motion.div>

                {/* ----------------------------------------------------------------- */}
                {/* NODE 4: 4. Complete (Order confirmed & customer happy)             */}
                {/* ----------------------------------------------------------------- */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  animate={{
                    opacity: currentStep >= 6 ? 1 : 0.4,
                    y: 0,
                    borderColor: currentStep >= 6 ? "rgba(129, 140, 248, 0.5)" : "rgba(255, 255, 255, 0.08)",
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`relative rounded-2xl p-3.5 sm:p-4 backdrop-blur-xl border transition-all duration-500 ${
                    currentStep >= 6
                      ? "bg-[#100D30]/90 shadow-[0_0_25px_rgba(129,140,248,0.25)]"
                      : "bg-[#0C0920]/60 border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                        currentStep >= 6
                          ? "bg-indigo-600/30 text-indigo-300 border border-indigo-400/40 shadow-[0_0_12px_rgba(129,140,248,0.4)]"
                          : "bg-white/[0.05] text-slate-400 border border-white/[0.08]"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    {currentStep >= 6 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-bold text-white tracking-tight">4. Complete</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight">
                    Order confirmed & happy
                  </p>
                </motion.div>

              </div>

              {/* =================================================================== */}
              {/* CENTRAL AI AGENT HERO & MESSAGE CARD                                */}
              {/* Spherical glowing glass orb with cute 3D-styled robot head         */}
              {/* =================================================================== */}
              <div className="mt-8 flex flex-col items-center justify-center relative">

                {/* 5. Central AI Environmental Violet Illumination Spreading into Surrounding Background */}
                <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[580px] w-[580px] rounded-full bg-[radial-gradient(circle,_rgba(168,85,247,0.28)_0%,_rgba(139,92,246,0.18)_38%,_rgba(108,59,255,0.08)_60%,_transparent_78%)] blur-[90px] -z-10" />
                <motion.div
                  animate={shouldReduceMotion ? {} : { scale: [0.96, 1.04, 0.96], opacity: [0.85, 1, 0.85] }}
                  transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                  className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,_rgba(192,132,252,0.42)_0%,_rgba(168,85,247,0.28)_45%,_transparent_74%)] blur-[40px] -z-10 will-change-transform"
                />

                {/* Central AI Agent Orb with Buttery Ambient Float */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1, y: 0 }
                      : currentStep >= 6
                      ? { opacity: 1, y: [-2.5, 2.5, -2.5] }
                      : { opacity: 1, y: 0 }
                  }
                  transition={
                    currentStep >= 6 && !shouldReduceMotion
                      ? { duration: 3.0, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
                  }
                  className="relative flex flex-col items-center will-change-transform"
                >
                  {/* Outer Glass Bubble Sphere with Dynamic Radial Glow */}
                  <div className="relative h-32 w-32 sm:h-36 sm:w-36 rounded-full bg-gradient-to-b from-white/[0.12] via-[#1B1042]/70 to-[#0A061C]/90 backdrop-blur-2xl border border-violet-400/30 p-2 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.3)]">

                    {/* Spherical highlight ring */}
                    <div className="pointer-events-none absolute inset-1.5 rounded-full border border-white/20" />
                    <div className="pointer-events-none absolute top-2 left-4 h-5 w-10 rounded-full bg-white/20 blur-[2px] -rotate-45" />

                    {/* Processing Reaction Glow (Step 4 pulse) */}
                    <motion.div
                      animate={
                        currentStep === 4
                          ? { scale: [1, 1.25, 1], opacity: [0.3, 0.8, 0.3] }
                          : { opacity: 0.25 }
                      }
                      transition={{ duration: 0.8 }}
                      className="absolute -inset-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-md -z-10"
                    />

                    {/* Robot Head Body */}
                    <div className="relative h-20 w-20 sm:h-22 sm:w-22 rounded-[24px] bg-gradient-to-b from-[#FAF8FE] to-[#D8CEF8] p-2 flex flex-col items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-white/80">
                      {/* Robot Ears / Antennas */}
                      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3.5 w-1.5 rounded-full bg-violet-600 shadow-[0_0_6px_#9333ea]" />
                      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-1.5 rounded-full bg-violet-600 shadow-[0_0_6px_#9333ea]" />

                      {/* Screen Visor */}
                      <div className="h-11 w-14 sm:h-12 sm:w-16 rounded-[14px] bg-[#0A071E] border border-violet-400/40 p-1.5 flex items-center justify-center gap-2 relative overflow-hidden">
                        {/* Cyan Glowing Eyes */}
                        <motion.div
                          animate={
                            currentStep >= 4 && !shouldReduceMotion
                              ? { scaleY: [1, 0.1, 1] }
                              : {}
                          }
                          transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 4 }}
                          className="h-2 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]"
                        />
                        <motion.div
                          animate={
                            currentStep >= 4 && !shouldReduceMotion
                              ? { scaleY: [1, 0.1, 1] }
                              : {}
                          }
                          transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 4 }}
                          className="h-2 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Top Thought Bubble with Pulsing Dots */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="absolute -top-3 right-2 px-2.5 py-1 rounded-full bg-[#180E38]/90 border border-violet-400/40 backdrop-blur-md shadow-[0_0_14px_rgba(168,85,247,0.4)] flex items-center gap-1"
                  >
                    <span className="h-1 w-1 rounded-full bg-violet-300 animate-pulse" />
                    <span className="h-1 w-1 rounded-full bg-violet-300 animate-pulse [animation-delay:0.2s]" />
                    <span className="h-1 w-1 rounded-full bg-violet-300 animate-pulse [animation-delay:0.4s]" />
                  </motion.div>
                </motion.div>

                {/* ----------------------------------------------------------------- */}
                {/* MESSAGE CARD: "👋 Hi! How can I help you today?"                   */}
                {/* Animates in at Step 2 with smooth fade and upward motion           */}
                {/* Decorative strokes removed as requested                           */}
                {/* ----------------------------------------------------------------- */}
                <div className="mt-4 min-h-[44px] flex flex-col items-center">
                  <AnimatePresence>
                    {currentStep >= 2 && (
                      <motion.div
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="rounded-2xl bg-gradient-to-b from-[#140D30]/95 to-[#0E0924]/95 border border-violet-400/30 py-2.5 px-5 sm:px-6 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl text-center"
                      >
                        <p className="text-xs sm:text-[13px] font-semibold text-slate-100 flex items-center justify-center gap-1.5">
                          <span>👋</span>
                          <span>Hi! How can I help you today?</span>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

            </div>

          </div>

          {/* ===================================================================== */}
          {/* RIGHT COLUMN: LOGIN FORM CARD                                         */}
          {/* Surface: Pale Lavender / Cool-white with subtle violet sheen          */}
          {/* Immediately interactive from page load (no blocking or delay)         */}
          {/* ===================================================================== */}
          <div className="order-1 lg:order-2 lg:col-span-5 xl:col-span-5 flex justify-center lg:justify-end w-full">
            <div className="w-full max-w-[480px] rounded-[32px] sm:rounded-[36px] bg-[#FAF8FE]/95 backdrop-blur-2xl border border-violet-200/80 shadow-[0_25px_80px_rgba(12,8,45,0.22)] p-6 sm:p-8 lg:p-9 text-slate-900 transition-all">

              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100/90 text-[#6C3BFF] border border-violet-200/60 mb-3 sm:mb-4 shadow-2xs">
                <span>Welcome back! 👋</span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight text-slate-900 leading-tight">
                Log In
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Enter your credentials to access your commerce workspace.
              </p>

              {/* Main Login Form */}
              <form onSubmit={handleSubmit} className="mt-6 sm:mt-7 space-y-4">

                {/* Email Field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@business.com"
                      autoComplete="email"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 sm:py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Password Field with Forgot Password link on the label line */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-[#6C3BFF] hover:text-[#8B35FF] transition-colors"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 sm:py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/15 transition-all shadow-2xs"
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
                      Logging in...
                    </span>
                  ) : (
                    <>
                      <span>Log In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Submission notice */}
                {isSubmitted && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Signing into your workspace...</span>
                  </div>
                )}

              </form>

              {/* Or Divider */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-[#FAF8FE] px-3 text-xs font-medium text-slate-400">
                  or continue with
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

              {/* Sign up switch link */}
              <p className="mt-6 text-center text-xs sm:text-sm text-slate-600">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-bold text-[#6C3BFF] hover:text-[#8B35FF] transition-colors"
                >
                  Sign up for free
                </Link>
              </p>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
