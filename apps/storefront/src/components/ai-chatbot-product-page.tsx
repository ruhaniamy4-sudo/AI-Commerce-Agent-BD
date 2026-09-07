"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Check,
  ArrowRight,
  ShoppingCart,
  MessageSquare,
  Crown,
  Store,
  LayoutGrid,
  CheckCheck,
  Phone,
  MoreVertical,
  ThumbsUp,
  Plus,
  Mic,
  Star,
  Search,
  User,
  Sparkles,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                               Atmosphere                                    */
/* -------------------------------------------------------------------------- */

function CinematicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Base Deep Navy Canvas */}
      <div className="absolute inset-0 bg-[#060719]" />

      {/* Layer 1: Massive Soft Light Blooms */}
      <div 
        className="absolute -left-36 -top-20 h-[680px] w-[680px] rounded-full opacity-45"
        style={{
          background: "radial-gradient(circle, rgba(124, 58, 237, 0.45) 0%, rgba(99, 102, 241, 0.18) 45%, transparent 70%)",
          filter: "blur(90px)",
          transform: "translate3d(0, 0, 0)",
        }}
      />

      <div 
        className="absolute left-1/3 top-[2%] h-[620px] w-[750px] rounded-full opacity-40"
        style={{
          background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.4) 0%, rgba(192, 132, 252, 0.16) 45%, transparent 72%)",
          filter: "blur(95px)",
          transform: "translate3d(0, 0, 0)",
        }}
      />

      <div 
        className="absolute -right-24 top-[10%] h-[580px] w-[700px] rounded-full opacity-35"
        style={{
          background: "radial-gradient(circle, rgba(221, 214, 254, 0.32) 0%, rgba(167, 139, 250, 0.16) 45%, transparent 75%)",
          filter: "blur(95px)",
          transform: "translate3d(0, 0, 0)",
        }}
      />

      {/* Layer 2: Subtle Distant Orbital Traces (SVG) */}
      <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="orbit-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.0" />
            <stop offset="35%" stopColor="#A855F7" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d="M -100 130 C 400 30, 1100 240, 1980 80"
          fill="none"
          stroke="url(#orbit-grad-1)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
        <path
          d="M 1980 480 C 1350 630, 520 440, -80 550"
          fill="none"
          stroke="url(#orbit-grad-1)"
          strokeWidth="1.3"
          strokeDasharray="4 6"
        />
      </svg>

      {/* Layer 3: Sparse Twinkling Starlight Points */}
      {[
        { x: "12%", y: "9%", s: 2, c: "#FFFFFF", o: 0.85, a: "4.2s" },
        { x: "26%", y: "6%", s: 1.5, c: "#C084FC", o: 0.7, a: "5.1s" },
        { x: "48%", y: "11%", s: 2.2, c: "#38BDF8", o: 0.9, a: "3.8s" },
        { x: "80%", y: "10%", s: 1.8, c: "#FFFFFF", o: 0.75, a: "4.7s" },
        { x: "90%", y: "17%", s: 2, c: "#E9D5FF", o: 0.8, a: "5.5s" },
        { x: "8%", y: "30%", s: 1.6, c: "#DDD6FE", o: 0.65, a: "4.0s" },
        { x: "92%", y: "34%", s: 2.2, c: "#38BDF8", o: 0.85, a: "3.5s" },
      ].map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none animate-pulse"
          style={{
            left: star.x,
            top: star.y,
            width: `${star.s}px`,
            height: `${star.s}px`,
            backgroundColor: star.c,
            boxShadow: `0 0 ${star.s * 3}px ${star.c}`,
            opacity: star.o,
            animationDuration: star.a,
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                  Three-Channel Animated 3D Commerce Showcase               */
/* -------------------------------------------------------------------------- */

function ThreeChannelShowcase() {
  const prefersReduced = useReducedMotion();
  const [stage, setStage] = useState<number>(prefersReduced ? 13 : 0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const isReset = stage === 0;

  useEffect(() => {
    if (prefersReduced) return;

    const timings = [
      { s: 1, d: 400 },   // Messenger: customer asks
      { s: 2, d: 900 },   // Messenger: AI reply + product
      { s: 3, d: 1500 },  // Messenger: customer orders
      { s: 4, d: 2100 },  // Messenger: AI asks address (complete)
      { s: 5, d: 2700 },  // Website: widget launcher pulses
      { s: 6, d: 3300 },  // Website: widget opens + customer asks
      { s: 7, d: 4100 },  // Website: AI reply + product
      { s: 8, d: 4900 },  // Website: customer orders + AI asks address (complete)
      { s: 9, d: 5600 },  // WhatsApp: customer asks
      { s: 10, d: 6400 }, // WhatsApp: AI reply
      { s: 11, d: 7200 }, // WhatsApp: customer orders + AI asks details
      { s: 12, d: 8200 }, // WhatsApp: customer sends info + AI confirms (complete)
      { s: 13, d: 9200 }, // All 3 complete and hold for 5 seconds
      { s: 0, d: 14500 }, // Loop restart smoothly
    ];

    const timeouts = timings.map(({ s, d }) =>
      setTimeout(() => setStage(s), d)
    );

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isReset, prefersReduced]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouseOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  // Stage progress steps
  const mStep = prefersReduced ? 4 : (stage >= 4 ? 4 : stage >= 3 ? 3 : stage >= 2 ? 2 : stage >= 1 ? 1 : 0);
  const wOpen = prefersReduced || stage >= 6;
  const wStep = prefersReduced ? 3 : (stage >= 8 ? 3 : stage >= 7 ? 2 : stage >= 6 ? 1 : 0);
  const waStep = prefersReduced ? 4 : (stage >= 12 ? 4 : stage >= 11 ? 3 : stage >= 10 ? 2 : stage >= 9 ? 1 : 0);

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative mx-auto w-full max-w-[1260px] xl:max-w-[1300px] px-3 sm:px-5 select-none"
      style={{ perspective: 1200 }}
    >
      
      {/* ------------------------------------------------------------------ */}
      {/* Left Handwritten Annotation (Tucked close to Messenger device)     */}
      {/* ------------------------------------------------------------------ */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ 
          opacity: 1, 
          x: 0,
          y: [0, -3, 0]
        }}
        transition={{ 
          opacity: { duration: 0.6, delay: 0.2 },
          x: { duration: 0.6, delay: 0.2 },
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
        className="hidden 2xl:flex absolute -left-16 3xl:-left-20 top-[65px] z-30 flex-col items-start pointer-events-none select-none"
      >
        <span 
          className="text-[13.5px] font-medium tracking-tight text-[#BFDBFE] -rotate-6 leading-snug drop-shadow-[0_2px_8px_rgba(56,189,248,0.4)]"
          style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif" }}
        >
          Same AI.
          <br />
          Everywhere
          <br />
          your customers
          <br />
          chat.
        </span>
        <svg width="40" height="34" viewBox="0 0 60 50" fill="none" className="mt-0.5 ml-2 text-[#38BDF8]">
          <motion.path
            d="M 10 6 C 24 28, 40 38, 48 42"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, delay: 0.4, ease: "easeInOut" }}
          />
          <motion.path
            d="M 38 42 L 50 43 L 46 32"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1.3, ease: "easeInOut" }}
          />
        </svg>
      </motion.div>

      {/* ------------------------------------------------------------------ */}
      {/* Right Handwritten Annotation (Tucked close to WhatsApp device)     */}
      {/* ------------------------------------------------------------------ */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ 
          opacity: 1, 
          x: 0,
          y: [0, -3, 0]
        }}
        transition={{ 
          opacity: { duration: 0.6, delay: 0.2 },
          x: { duration: 0.6, delay: 0.2 },
          y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }
        }}
        className="hidden 2xl:flex absolute -right-16 3xl:-right-20 top-[65px] z-30 flex-col items-end pointer-events-none select-none text-right"
      >
        <span 
          className="text-[13.5px] font-medium tracking-tight text-[#E9D5FF] rotate-6 leading-snug drop-shadow-[0_2px_8px_rgba(192,132,252,0.4)]"
          style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif" }}
        >
          Turn
          <br />
          conversations
          <br />
          into orders —
          <br />
          automatically.
        </span>
        <svg width="40" height="34" viewBox="0 0 60 50" fill="none" className="mt-0.5 mr-2 text-[#C084FC]">
          <motion.path
            d="M 50 6 C 36 28, 20 38, 12 42"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, delay: 0.4, ease: "easeInOut" }}
          />
          <motion.path
            d="M 22 32 L 10 43 L 22 42"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1.3, ease: "easeInOut" }}
          />
        </svg>
      </motion.div>

      {/* 3-Panel Panoramic 3D Grid (Scaled down ~18% proportionally) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 xl:gap-4 items-center">

        {/* ================================================================== */}
        {/* PANEL 1: MESSENGER (Left - 3D Angle +4deg)                         */}
        {/* ================================================================== */}
        <div 
          className="lg:col-span-3 flex flex-col transition-transform duration-200"
          style={{
            transform: `perspective(1200px) rotateY(${4 + mouseOffset.x * 2}deg) rotateX(${1 - mouseOffset.y * 1.2}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Channel Header */}
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#0084FF] to-[#0062FF] text-white shadow-[0_2px_8px_rgba(0,132,255,0.4)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.513 3.734 7.21V22l3.385-1.858c.91.252 1.88.388 2.881.388 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.066 12.445l-2.67-2.848-5.213 2.848 5.733-6.088 2.735 2.848 5.148-2.848-5.733 6.088z" />
              </svg>
            </div>
            <h3 className="text-xs font-bold text-white tracking-tight">Messenger</h3>
          </div>

          {/* Messenger Card Window (Reduced height ~285px) */}
          <div className="relative flex-1 rounded-[18px] bg-white border border-white/25 shadow-[0_16px_36px_rgba(0,0,0,0.45),0_0_18px_rgba(0,132,255,0.18)] flex flex-col overflow-hidden text-slate-900 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(0,132,255,0.28)] h-[240px] xl:h-[285px]">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-1.5">
                <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[#0084FF] text-white font-bold text-[8.5px] shadow-xs">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.513 3.734 7.21V22l3.385-1.858c.91.252 1.88.388 2.881.388 5.523 0 10-4.145 10-9.258C22 6.145 17.523 2 12 2zm1.066 12.445l-2.67-2.848-5.213 2.848 5.733-6.088 2.735 2.848 5.148-2.848-5.733 6.088z" />
                  </svg>
                  <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-900 leading-tight">DigitRoss</div>
                  <div className="text-[7.5px] text-slate-400">Active now</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <Phone className="h-2.5 w-2.5 hover:text-slate-800 cursor-pointer" />
                <MoreVertical className="h-2.5 w-2.5 hover:text-slate-800 cursor-pointer" />
              </div>
            </div>

            {/* Conversation Flow */}
            <div className="flex-1 p-2 space-y-1 bg-[#F9FAFB] overflow-y-auto text-[9.5px]">
              
              {/* Step 1: Customer Question */}
              <AnimatePresence>
                {mStep >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="self-end ml-auto max-w-[85%]"
                  >
                    <div className="bg-[#0084FF] text-white px-2 py-0.5 rounded-xl rounded-tr-xs shadow-xs font-medium">
                      এই হেডফোনটা কি available আছে?
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 2: SellPilot Reply + Product Card */}
              <AnimatePresence>
                {mStep >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="self-start mr-auto max-w-[95%] space-y-0.5"
                  >
                    <div className="flex items-start gap-1">
                      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#7C3AED] text-white text-[7.5px] font-bold shrink-0 mt-0.5 shadow-2xs">
                        SP
                      </div>
                      <div className="bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-xl rounded-tl-xs shadow-2xs leading-tight">
                        জি, আছে! 🎧 <strong>SoundMax Pro</strong>
                        <div className="text-violet-700 font-bold mt-0.5">Price: ৳4,500</div>
                      </div>
                    </div>

                    {/* Product Card Attachment */}
                    <div className="ml-4 rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <div className="relative h-7 w-7 rounded bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                          <Image
                            src="/images/soundmax-pro.jpg"
                            alt="SoundMax Pro Headphone"
                            fill
                            className="object-contain p-0.5"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 text-[8.5px] truncate">SoundMax Pro</div>
                          <div className="text-[8.5px] font-extrabold text-violet-700">৳4,500</div>
                          <div className="text-[7.5px] font-bold text-emerald-600">● In stock</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 3: Customer Order Request */}
              <AnimatePresence>
                {mStep >= 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="self-end ml-auto max-w-[80%]"
                  >
                    <div className="bg-[#0084FF] text-white px-2 py-0.5 rounded-xl rounded-tr-xs shadow-xs font-medium">
                      Order করতে চাই
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 4: SellPilot Response */}
              <AnimatePresence>
                {mStep >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="self-start mr-auto max-w-[95%]"
                  >
                    <div className="flex items-start gap-1">
                      <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#7C3AED] text-white text-[7.5px] font-bold shrink-0 mt-0.5 shadow-2xs">
                        SP
                      </div>
                      <div className="bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-xl rounded-tl-xs shadow-2xs leading-tight">
                        অবশ্যই! 😊 আপনার নাম, ফোন নম্বর ও delivery address দিন।
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Bottom Input Bar */}
            <div className="flex items-center gap-1.5 px-2 py-1 border-t border-slate-100 bg-white">
              <Plus className="h-3 w-3 text-[#0084FF] cursor-pointer" />
              <div className="flex-1 rounded-full bg-slate-100 px-2 py-0.5 text-[8.5px] text-slate-400">
                Type a message...
              </div>
              <ThumbsUp className="h-3 w-3 text-[#0084FF] cursor-pointer" />
            </div>

          </div>
        </div>


        {/* ================================================================== */}
        {/* PANEL 2: YOUR WEBSITE (Center - 3D Hero Front-Facing Elevated)     */}
        {/* ================================================================== */}
        <div 
          className="lg:col-span-6 flex flex-col z-10 transition-transform duration-200"
          style={{
            transform: `perspective(1200px) rotateY(${mouseOffset.x * 1.5}deg) rotateX(${-mouseOffset.y * 1.2}deg) translateZ(16px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Channel Header */}
          <div className="flex items-center gap-1.5 mb-1 px-1 justify-center sm:justify-start">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#7C3AED] to-[#6C3BFF] text-white shadow-[0_2px_8px_rgba(108,59,255,0.4)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.93V17a1 1 0 11-2 0v-.07A8.006 8.006 0 014.07 11H5a1 1 0 110-2h-.93A8.006 8.006 0 0111 4.07V5a1 1 0 112 0v-.93A8.006 8.006 0 0119.93 9H19a1 1 0 110 2h.93A8.006 8.006 0 0113 16.93z" />
              </svg>
            </div>
            <h3 className="text-xs font-bold text-white tracking-tight">Your Website</h3>
          </div>

          {/* Website Browser Frame (Reduced height ~305px) */}
          <div className="relative flex-1 rounded-[18px] bg-white border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.55),0_0_30px_rgba(124,58,237,0.25)] flex flex-col overflow-hidden text-slate-900 transition-all duration-300 hover:shadow-[0_25px_60px_rgba(124,58,237,0.35)] h-[255px] xl:h-[308px]">
            
            {/* Browser Top Chrome */}
            <div className="flex items-center justify-between px-2.5 py-1 bg-[#1E2235] text-white border-b border-slate-700">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF5F56]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#FFBD2E]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#27C93F]" />
              </div>
              <div className="text-[9px] font-bold tracking-tight text-slate-300 flex items-center gap-2.5">
                <span className="font-extrabold text-white text-[10.5px]">DigitRoss</span>
                <span className="text-[8.5px] text-slate-400 hover:text-white cursor-pointer">Home</span>
                <span className="text-[8.5px] text-slate-400 hover:text-white cursor-pointer">Shop</span>
                <span className="text-[8.5px] text-slate-400 hover:text-white cursor-pointer">Collections</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Search className="h-2.5 w-2.5 cursor-pointer hover:text-white" />
                <div className="relative cursor-pointer hover:text-white">
                  <ShoppingCart className="h-2.5 w-2.5" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center rounded-full bg-violet-600 text-[6px] font-bold text-white">
                    1
                  </span>
                </div>
                <User className="h-2.5 w-2.5 cursor-pointer hover:text-white" />
              </div>
            </div>

            {/* Merchant Storefront Main Stage */}
            <div className="relative flex-1 bg-gradient-to-b from-[#FAF8FD] to-white p-2 sm:p-2.5 flex items-center justify-between overflow-hidden">
              
              {/* Product Visual Area */}
              <div className="w-1/2 flex flex-col items-center justify-center pr-1.5">
                <div className="relative h-24 sm:h-28 xl:h-32 w-28 sm:w-32 xl:w-36 rounded-xl bg-white p-1 shadow-sm border border-slate-100 flex items-center justify-center group overflow-hidden">
                  <Image
                    src="/images/soundmax-pro.jpg"
                    alt="SoundMax Pro Wireless Headphones"
                    fill
                    className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                    priority
                  />
                </div>
                {/* Thumbnails */}
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="h-1 w-3 rounded-full bg-violet-600" />
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                </div>
              </div>

              {/* Product Info / Meta */}
              <div className="w-1/2 pl-1 flex flex-col justify-center space-y-1">
                <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.1 text-[8px] font-bold text-amber-700 w-fit">
                  <Star className="h-2 w-2 fill-amber-400 text-amber-400" />
                  <span>Best Seller</span>
                </div>
                <h4 className="text-xs xl:text-sm font-extrabold text-slate-900 leading-tight">
                  SoundMax Pro
                </h4>
                <p className="text-[8.5px] text-slate-500 leading-snug">
                  Wireless ANC with 40H battery life.
                </p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-sm xl:text-base font-black text-slate-900">৳4,500</span>
                  <span className="text-[8.5px] text-slate-400 line-through">৳5,500</span>
                </div>

                <div className="flex flex-wrap gap-1 text-[7.5px] font-medium text-slate-600 pt-0.5">
                  <span className="bg-slate-100 px-1.5 py-0.2 rounded">🎧 Wireless</span>
                  <span className="bg-slate-100 px-1.5 py-0.2 rounded">🔋 40H</span>
                  <span className="bg-slate-100 px-1.5 py-0.2 rounded">⚡ Type-C</span>
                </div>

                <button className="mt-1 w-fit rounded-lg bg-[#0F1128] text-white px-2.5 py-0.5 text-[8.5px] font-bold hover:bg-violet-700 transition-colors">
                  Add to Cart
                </button>
              </div>

              {/* DOCKED SELLPILOT AI CHATBOT WIDGET OVER WEBSITE */}
              <div className="absolute right-1.5 bottom-1.5 z-20 w-[165px] xl:w-[195px] h-[175px] xl:h-[208px] rounded-xl bg-white border border-violet-200/90 shadow-[0_12px_28px_rgba(108,59,255,0.3)] flex flex-col overflow-hidden text-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#7C3AED] to-[#6C3BFF] text-white">
                  <div className="flex items-center gap-1">
                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 text-[7px] font-bold">
                      SP
                    </div>
                    <div>
                      <div className="text-[8.5px] font-bold leading-tight">SellPilot</div>
                      <div className="text-[6.5px] text-violet-200">AI Sales Assistant</div>
                    </div>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-1.5 space-y-1 bg-[#FAF8FE] overflow-y-auto text-[8.5px]">
                  <AnimatePresence>
                    {wOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="self-end ml-auto max-w-[88%]"
                      >
                        <div className="bg-[#7C3AED] text-white px-1.5 py-0.5 rounded-lg rounded-tr-xs shadow-2xs">
                          Bhai, ei headphone ta black color e ache?
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {wStep >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="self-start mr-auto max-w-[95%] space-y-0.5"
                      >
                        <div className="bg-white border border-violet-100 text-slate-800 px-1.5 py-0.5 rounded-lg rounded-tl-xs shadow-2xs leading-tight">
                          Ji, Black color available ache 🎧
                          <div className="text-violet-700 font-bold mt-0.2">Price: ৳4,500</div>
                        </div>

                        {/* Mini Product Pill */}
                        <div className="flex items-center justify-between rounded bg-white p-1 border border-slate-100 shadow-2xs text-[7.5px]">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px]">🎧</span>
                            <span className="font-bold text-slate-800">SoundMax Pro</span>
                          </div>
                          <button className="rounded bg-violet-600 text-white px-1 py-0.2 text-[7px] font-bold">
                            Order করতে চাই
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {wStep >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="self-end ml-auto max-w-[80%]"
                      >
                        <div className="bg-[#7C3AED] text-white px-1.5 py-0.5 rounded-lg rounded-tr-xs shadow-2xs">
                          Order korte chai
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mini Input Box */}
                <div className="p-1 bg-white border-t border-slate-100 flex items-center gap-1">
                  <div className="flex-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[7.5px] text-slate-400">
                    Type a message...
                  </div>
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600 text-white text-[7px]">
                    ➔
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>


        {/* ================================================================== */}
        {/* PANEL 3: WHATSAPP (Right - 3D Angle -4deg)                         */}
        {/* ================================================================== */}
        <div 
          className="lg:col-span-3 flex flex-col transition-transform duration-200"
          style={{
            transform: `perspective(1200px) rotateY(${-4 + mouseOffset.x * 2}deg) rotateX(${1 - mouseOffset.y * 1.2}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Channel Header */}
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#25D366] text-white shadow-[0_2px_8px_rgba(37,211,102,0.4)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.54 1.776.819 2.796.819 3.18 0 5.767-2.587 5.768-5.766.001-3.18-2.585-5.766-5.768-5.766zm9.965 5.765c-.002 5.518-4.49 10.007-10.007 10.007-1.745 0-3.4-.455-4.851-1.258l-5.638 1.478 1.505-5.495c-.878-1.523-1.341-3.266-1.343-5.053.003-5.518 4.491-10.007 10.008-10.007 5.519 0 10.008 4.489 10.008 10.008z" />
              </svg>
            </div>
            <h3 className="text-xs font-bold text-white tracking-tight">WhatsApp</h3>
          </div>

          {/* WhatsApp Card Window (Reduced height ~285px) */}
          <div className="relative flex-1 rounded-[18px] bg-[#EFEAE2] border border-white/25 shadow-[0_16px_36px_rgba(0,0,0,0.45),0_0_18px_rgba(37,211,102,0.18)] flex flex-col overflow-hidden text-slate-900 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(37,211,102,0.28)] h-[240px] xl:h-[285px]">
            
            {/* WhatsApp Top Bar */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#075E54] text-white">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white font-bold text-[8.5px]">
                  🎧
                </div>
                <div>
                  <div className="text-[10px] font-bold text-white leading-tight">DigitRoss</div>
                  <div className="text-[7.5px] text-emerald-200">Business Account</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-white/80">
                <Phone className="h-2.5 w-2.5 hover:text-white cursor-pointer" />
                <MoreVertical className="h-2.5 w-2.5 hover:text-white cursor-pointer" />
              </div>
            </div>

            {/* Conversation Flow */}
            <div className="flex-1 p-2 space-y-1 bg-[#ECE5DD] overflow-y-auto text-[9.5px]">
              
              {/* Step 1: Customer Question */}
              <AnimatePresence>
                {waStep >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="self-end ml-auto max-w-[85%]"
                  >
                    <div className="bg-[#D9FDD3] text-slate-900 px-2 py-0.5 rounded-xl rounded-tr-xs shadow-2xs leading-tight">
                      <div>Vai, ei headphone ta stock e ase?</div>
                      <div className="text-[6.5px] text-slate-500 text-right mt-0.2 flex items-center justify-end gap-0.5">
                        <span>12:30</span>
                        <CheckCheck className="h-2 w-2 text-[#53BDEB]" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 2: SellPilot Reply */}
              <AnimatePresence>
                {waStep >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 3, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="self-start mr-auto max-w-[92%]"
                  >
                    <div className="bg-white text-slate-900 px-2 py-0.5 rounded-xl rounded-tl-xs shadow-2xs leading-tight">
                      <div>Haan! SoundMax Pro stock e ase. 🎧</div>
                      <div className="font-bold text-[#075E54] mt-0.2">Price: ৳4,500</div>
                      <div className="text-[6.5px] text-slate-400 text-right mt-0.2">12:30</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 3: Order Intent + Address Request */}
              <AnimatePresence>
                {waStep >= 3 && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 3, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="self-end ml-auto max-w-[80%]"
                    >
                      <div className="bg-[#D9FDD3] text-slate-900 px-2 py-0.5 rounded-xl rounded-tr-xs shadow-2xs leading-tight">
                        <div>Order korte chai</div>
                        <div className="text-[6.5px] text-slate-500 text-right mt-0.2 flex items-center justify-end gap-0.5">
                          <span>12:31</span>
                          <CheckCheck className="h-2 w-2 text-[#53BDEB]" />
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 3, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="self-start mr-auto max-w-[90%]"
                    >
                      <div className="bg-white text-slate-900 px-2 py-0.5 rounded-xl rounded-tl-xs shadow-2xs leading-tight">
                        <div>Thik ache! Apnar delivery address ta diben?</div>
                        <div className="text-[6.5px] text-slate-400 text-right mt-0.2">12:31</div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Step 4: Customer Details + Confirmation */}
              <AnimatePresence>
                {waStep >= 4 && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 3, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="self-end ml-auto max-w-[90%]"
                    >
                      <div className="bg-[#D9FDD3] text-slate-900 px-2 py-0.5 rounded-xl rounded-tr-xs shadow-2xs leading-tight">
                        <div className="font-semibold text-[8.5px]">Rafi - 01712xxxxxx</div>
                        <div className="text-[8px]">Dhanmondi, Dhaka</div>
                        <div className="text-[6.5px] text-slate-500 text-right mt-0.2 flex items-center justify-end gap-0.5">
                          <span>12:31</span>
                          <CheckCheck className="h-2 w-2 text-[#53BDEB]" />
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 3, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="self-start mr-auto max-w-[92%]"
                    >
                      <div className="bg-white text-slate-900 px-2 py-0.5 rounded-xl rounded-tl-xs shadow-2xs leading-tight">
                        <div className="font-bold text-emerald-700">Perfect! ✅ Order confirmed.</div>
                        <div className="text-violet-700 font-medium">Dhonnobad! 🙏</div>
                        <div className="text-[6.5px] text-slate-400 text-right mt-0.2">12:32</div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

            </div>

            {/* Bottom Input Bar */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-white border-t border-slate-100">
              <span className="text-slate-400 cursor-pointer text-[10px]">😊</span>
              <div className="flex-1 rounded-full bg-slate-100 px-2 py-0.5 text-[8.5px] text-slate-400">
                Type a message...
              </div>
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366] text-white cursor-pointer hover:bg-[#1EBE5D]">
                <Mic className="h-2 w-2" />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Center Carousel Pagination Dots */}
      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        <span className="h-1 w-4 rounded-full bg-violet-500 shadow-sm" />
        <span className="h-1 w-1 rounded-full bg-white/30" />
        <span className="h-1 w-1 rounded-full bg-white/30" />
        <span className="h-1 w-1 rounded-full bg-white/30" />
      </div>

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             Organic Compact Horizon: Dark Showcase → Light Pricing         */
/* -------------------------------------------------------------------------- */

function CloudTransitionToPricing() {
  return (
    <div className="relative w-full h-[40px] xl:h-[44px] overflow-visible pointer-events-none select-none z-10 my-0 flex items-center justify-center">
      {/* Soft Luminous Cloud Base Billows */}
      <div className="absolute -top-10 -left-10 w-[600px] h-[140px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,0.95)_0%,_rgba(216,196,255,0.45)_45%,_transparent_75%)] blur-[30px]" />
      <div className="absolute -top-10 -right-10 w-[620px] h-[140px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,0.95)_0%,_rgba(216,196,255,0.45)_45%,_transparent_75%)] blur-[30px]" />
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[950px] h-[110px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,1)_0%,_rgba(245,243,255,0.85)_45%,_transparent_75%)] blur-[22px]" />
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[1920px] h-[90px] rounded-full bg-[radial-gradient(ellipse_at_center,_#FAF8FC_0%,_#FAF8FC_65%,_transparent_95%)] blur-[18px]" />

      {/* Centered Compact "See all features" Button */}
      <Link
        href="/features"
        className="pointer-events-auto group inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/95 border border-violet-300/80 text-slate-900 font-bold text-[11px] shadow-[0_4px_14px_rgba(108,59,255,0.22)] hover:border-violet-500 hover:shadow-[0_6px_20px_rgba(108,59,255,0.35)] hover:scale-[1.03] active:scale-[0.98] transition-all z-20"
      >
        <LayoutGrid className="h-3 w-3 text-violet-600" />
        <span>See all features</span>
        <ArrowRight className="h-3 w-3 text-violet-600 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             Pricing Section: Dominant, Large, Visually Strong              */
/* -------------------------------------------------------------------------- */

function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [highlightPulse, setHighlightPulse] = useState(false);
  const isYearly = billingCycle === "yearly";

  useEffect(() => {
    const handler = () => {
      setHighlightPulse(true);
      const timer = setTimeout(() => setHighlightPulse(false), 2200);
      return () => clearTimeout(timer);
    };
    window.addEventListener("sellpilot:highlight-pricing", handler);
    return () => window.removeEventListener("sellpilot:highlight-pricing", handler);
  }, []);

  return (
    <section 
      id="pricing" 
      className={`relative z-20 w-full bg-gradient-to-b from-[#FAF8FC] via-white to-[#F6F2FB] text-slate-900 pt-1 sm:pt-1.5 pb-2.5 sm:pb-3.5 overflow-hidden transition-all duration-500 ${
        highlightPulse ? "ring-2 ring-violet-400/60 shadow-[0_0_80px_rgba(124,58,237,0.35)]" : ""
      }`}
    >
      {/* Soft atmospheric cloud puffs framing the pricing section corners */}
      <div className="pointer-events-none absolute -bottom-10 -left-16 w-[450px] h-[260px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(216,180,254,0.35)_0%,_rgba(233,213,255,0.18)_40%,_transparent_75%)] blur-[50px] select-none" />
      <div className="pointer-events-none absolute -bottom-10 -right-16 w-[480px] h-[280px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(216,180,254,0.35)_0%,_rgba(233,213,255,0.18)_40%,_transparent_75%)] blur-[50px] select-none" />
      
      <div className="mx-auto max-w-[1260px] xl:max-w-[1300px] px-3 sm:px-5">
        
        {/* Header + Billing Toggle Row */}
        <div className="flex flex-row items-center justify-between mb-2 xl:mb-2.5 gap-4">
          <div>
            <h2 className="text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight text-[#11182F] leading-tight">
              Simple plans.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] via-[#6C3BFF] to-[#9333EA]">
                Real savings.
              </span>
            </h2>
          </div>

          {/* Monthly / Yearly Switch */}
          <div className="flex items-center gap-1 rounded-full bg-white border border-slate-200/90 p-0.5 shadow-xs">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition-all ${
                !isYearly
                  ? "bg-[#0F1128] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-bold transition-all ${
                isYearly
                  ? "bg-[#0F1128] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yearly
              <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.1 text-[8.5px] font-extrabold">
                Save more
              </span>
            </button>
          </div>
        </div>

        {/* 3 Dominant Pricing Cards (Significantly Enriched, Taller, Wider, Dominant) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 xl:gap-5.5 items-stretch">
          
          {/* ============================================================ */}
          {/* CARD 1: AI CHATBOT (SellPilot Identity - Light Card)         */}
          {/* ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            whileHover={{ y: -4, scale: 1.03 }}
            className="group relative flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-3 xl:p-4 2xl:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:border-violet-400 hover:shadow-[0_20px_50px_rgba(124,58,237,0.22)] transition-all h-[310px] min-[1400px]:h-[340px] 2xl:h-[420px]"
          >
            {/* Soft Violet Glow on Hover */}
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-b from-violet-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />

            <div>
              {/* Card Top: Icon, Title, Discount Badge */}
              <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                <div className="flex items-center gap-1.5 xl:gap-2">
                  <div className="flex h-7 w-7 xl:h-8 xl:w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 shadow-2xs">
                    <MessageSquare className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                  </div>
                  <h3 className="text-sm sm:text-base xl:text-lg font-extrabold text-slate-900 tracking-tight">AI Chatbot</h3>
                </div>
                <motion.span 
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="rounded-full bg-rose-500 text-white text-[9.5px] xl:text-[10.5px] font-bold px-2 xl:px-2.5 py-0.5 shadow-xs"
                >
                  Save 15%
                </motion.span>
              </div>

              {/* Pricing Details (Substantially Larger Price Typography) */}
              <div className="mb-2 xl:mb-2.5">
                <div className="text-[10.5px] xl:text-[11.5px] text-slate-400 font-medium">
                  Regular: <span className="line-through">{isYearly ? "৳50,000 /yr" : "৳5,000"}</span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl xl:text-[42px] font-black tracking-tight text-slate-900 leading-none">
                    {isYearly ? "৳3,600" : "৳4,250"}
                  </span>
                  <span className="text-xs xl:text-sm text-slate-500 font-medium">/month</span>
                </div>
              </div>

              {/* Features List (Violet checks) */}
              <ul className="space-y-1 xl:space-y-2 text-[10.5px] xl:text-[13px] text-slate-700">
                {[
                  "AI chatbot for Website & Messenger",
                  "Product recommendations",
                  "Order taking & tracking",
                  "Customer insights",
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-1.5 xl:gap-2">
                    <div className="flex h-3.5 w-3.5 xl:h-4 xl:w-4 items-center justify-center rounded-full bg-violet-100 text-violet-700 shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                    <span className="font-medium leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA Button */}
            <Link
              href="/signup"
              className="w-full rounded-xl border border-slate-200 bg-white hover:bg-violet-600 hover:text-white hover:border-violet-600 py-2 xl:py-2.5 text-center text-xs xl:text-sm font-bold text-slate-900 shadow-2xs hover:shadow-[0_4px_16px_rgba(124,58,237,0.35)] transition-all flex items-center justify-center gap-1.5 group-hover:gap-2"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform" />
            </Link>
          </motion.div>


          {/* ============================================================ */}
          {/* CARD 2: COMPLETE SUITE (Hero Center - Raised, Dominant)      */}
          {/* ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            whileHover={{ y: -6, scale: 1.035 }}
            className="group relative flex flex-col justify-between rounded-2xl bg-[#0E1128] border-2 border-violet-500 p-3 xl:p-4 2xl:p-5 shadow-[0_24px_60px_rgba(124,58,237,0.55),0_0_35px_rgba(78,113,94,0.25)] hover:shadow-[0_28px_70px_rgba(124,58,237,0.7)] transition-all z-10 text-white -translate-y-1 sm:-translate-y-1.5 h-[320px] min-[1400px]:h-[350px] 2xl:h-[430px]"
          >
            {/* MOST POPULAR Pill Badge at Top Center */}
            <div className="absolute -top-3 xl:-top-3.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-3 xl:px-3.5 py-0.5 text-[9px] xl:text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_4px_16px_rgba(124,58,237,0.65)] border border-white/25 flex items-center gap-1">
                <Sparkles className="h-2 w-2 xl:h-2.5 xl:w-2.5 text-amber-300" />
                Most Popular
              </span>
            </div>

            {/* Persistent & Hover Dual Glow Behind Card */}
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-b from-violet-500/50 via-purple-600/30 to-blue-500/20 opacity-80 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />

            <div className="mt-0.5 xl:mt-1">
              {/* Card Top: Crown Icon, Title, Discount Badge */}
              <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                <div className="flex items-center gap-1.5 xl:gap-2">
                  <div className="flex h-7 w-7 xl:h-8 xl:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-[0_3px_12px_rgba(124,58,237,0.5)]">
                    <Crown className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                  </div>
                  <h3 className="text-sm sm:text-base xl:text-lg font-extrabold text-white tracking-tight">Complete Suite</h3>
                </div>
                <motion.span 
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                  className="rounded-full bg-rose-500 text-white text-[9.5px] xl:text-[10.5px] font-bold px-2 xl:px-2.5 py-0.5 shadow-sm"
                >
                  Save 25%
                </motion.span>
              </div>

              {/* Pricing Details (Hero Pricing Typography) */}
              <div className="mb-2 xl:mb-2.5">
                <div className="text-[10.5px] xl:text-[11.5px] text-slate-400 font-medium">
                  Regular: <span className="line-through">{isYearly ? "৳100,000 /yr" : "৳10,000"}</span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl xl:text-[44px] font-black tracking-tight text-white leading-none drop-shadow-[0_2px_14px_rgba(124,58,237,0.45)]">
                    {isYearly ? "৳6,000" : "৳7,500"}
                  </span>
                  <span className="text-xs xl:text-sm text-slate-300 font-medium">/month</span>
                </div>
              </div>

              {/* Features List */}
              <ul className="space-y-1 xl:space-y-2 text-[10.5px] xl:text-[13px] text-slate-200 font-medium">
                {[
                  "Everything in AI Chatbot",
                  "Everything in Store Builder",
                  "Seamless integration",
                  "Priority 24/7 support",
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-1.5 xl:gap-2">
                    <div className="flex h-3.5 w-3.5 xl:h-4 xl:w-4 items-center justify-center rounded-full bg-violet-600 text-white shadow-2xs shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                    <span className="leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Primary Action Button: Electric Purple Gradient */}
            <Link
              href="/signup"
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:brightness-110 py-2 xl:py-2.5 text-center text-xs xl:text-sm font-bold text-white shadow-[0_6px_22px_rgba(124,58,237,0.6)] transition-all flex items-center justify-center gap-1.5 group-hover:gap-2 active:scale-[0.98]"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform" />
            </Link>
          </motion.div>


          {/* ============================================================ */}
          {/* CARD 3: STORE BUILDER (Warm Cream / Sage Merchant Theme)    */}
          {/* ============================================================ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            whileHover={{ y: -4, scale: 1.03 }}
            className="group relative flex flex-col justify-between rounded-2xl bg-[#F8F7FF] border border-violet-200/70 p-3 xl:p-4 2xl:p-5 shadow-[0_12px_32px_rgba(36,20,82,0.08)] hover:shadow-[0_20px_50px_rgba(108,59,255,0.2)] hover:border-violet-400/60 transition-all text-[#18181B] h-[310px] min-[1400px]:h-[340px] 2xl:h-[420px]"
          >
            {/* Restrained Muted Sage Ambient Glow on Hover */}
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-b from-violet-500/20 via-fuchsia-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />

            <div>
              {/* Card Top: Storefront Icon, Title, Discount Badge */}
              <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                <div className="flex items-center gap-1.5 xl:gap-2">
                  <div className="flex h-7 w-7 xl:h-8 xl:w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 shadow-2xs">
                    <Store className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                  </div>
                  <h3 className="text-sm sm:text-base xl:text-lg font-extrabold text-[#18181B] tracking-tight">Store Builder</h3>
                </div>
                <motion.span 
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="rounded-full bg-rose-500 text-white text-[9.5px] xl:text-[10.5px] font-bold px-2 xl:px-2.5 py-0.5 shadow-xs"
                >
                  Save 20%
                </motion.span>
              </div>

              {/* Pricing Details */}
              <div className="mb-2 xl:mb-2.5">
                <div className="text-[10.5px] xl:text-[11.5px] text-[#71717A] font-medium">
                  Regular: <span className="line-through">{isYearly ? "৳15,000 /yr" : "৳1,500"}</span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl xl:text-[42px] font-black tracking-tight text-[#18181B] leading-none">
                    {isYearly ? "৳960" : "৳1,200"}
                  </span>
                  <span className="text-xs xl:text-sm text-[#71717A] font-medium">/month</span>
                </div>
              </div>

              {/* Features List (Muted Sage Green Checks) */}
              <ul className="space-y-1 xl:space-y-2 text-[10.5px] xl:text-[13px] text-[#3F3F46]">
                {[
                  "Beautiful, fast storefront",
                  "Product & inventory engine",
                  "Works with AI Chatbot",
                  "No technical skills needed",
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-1.5 xl:gap-2">
                    <div className="flex h-3.5 w-3.5 xl:h-4 xl:w-4 items-center justify-center rounded-full bg-violet-500/15 text-violet-700 shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                    <span className="font-medium leading-snug">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action CTA Button */}
            <Link
              href="/signup"
              className="w-full rounded-xl border border-slate-300 bg-white hover:bg-[#18181B] hover:text-white text-slate-900 py-2 xl:py-2.5 text-center text-xs xl:text-sm font-bold shadow-2xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 group-hover:gap-2"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*             Main Product Page (One Desktop Viewport, No Scroll)            */
/* -------------------------------------------------------------------------- */

export function AIChatbotProductPage() {
  return (
    <main className="relative w-full min-h-screen xl:h-screen xl:max-h-[1080px] flex flex-col justify-between overflow-x-hidden overflow-y-auto xl:overflow-hidden bg-[#060719] text-slate-100 selection:bg-violet-600 selection:text-white">
      {/* Unified Cinematic Atmospheric Background */}
      <CinematicBackground />

      {/* Top Three-Channel 3D Commerce Showcase (Directly below Navbar, reduced ~18%) */}
      <section className="relative pt-[56px] sm:pt-[60px] pb-1 z-10 flex-shrink-0">
        <ThreeChannelShowcase />
      </section>

      {/* Organic Compact Horizon Transition */}
      <div className="flex-shrink-0 z-10">
        <CloudTransitionToPricing />
      </div>

      {/* 3D Pricing Section (Luminous Warm Grounding, Dominant & Large, id="pricing") */}
      <div className="flex-shrink-0 z-20">
        <PricingSection />
      </div>
    </main>
  );
}
