"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Check,
  ArrowRight,
  Store,
  MessageSquare,
  Crown,
  Sparkles,
  Palette,
  Layers,
  Package,
  FolderTree,
  ShoppingBag,
  Truck,
  Settings,
  Smartphone,
  Monitor,
  Eye,
  Send,
  MousePointer2,
  CheckCircle2,
  ShieldCheck,
  Globe,
  Radio,
  SlidersHorizontal,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                               Atmosphere                                    */
/* -------------------------------------------------------------------------- */

function CinematicStoreBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* SellPilot midnight-violet product environment */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#08091C] via-[#0D0B24] to-[#050617]" />

      {/* SellPilot violet light blooms (upper left / behind editor) */}
      <div 
        className="absolute -top-32 -left-20 w-[900px] h-[550px] rounded-full blur-[140px] opacity-35"
        style={{
          background: "radial-gradient(ellipse at center, rgba(108,59,255,0.42) 0%, rgba(69,48,190,0.22) 45%, transparent 70%)",
        }}
      />
      <div 
        className="absolute top-12 left-[20%] w-[680px] h-[400px] rounded-full blur-[120px] opacity-30"
        style={{
          background: "radial-gradient(ellipse at center, rgba(154,77,255,0.28) 0%, rgba(108,59,255,0.14) 50%, transparent 75%)",
        }}
      />

      {/* SellPilot Violet Accent Glows (Behind Mobile & Right Stage) */}
      <div 
        className="absolute -top-24 right-[-10%] w-[850px] h-[520px] rounded-full blur-[150px] opacity-25"
        style={{
          background: "radial-gradient(ellipse at center, rgba(124,58,237,0.35) 0%, rgba(108,59,255,0.18) 45%, transparent 75%)",
        }}
      />
      <div 
        className="absolute top-[280px] right-[25%] w-[500px] h-[260px] rounded-full blur-[110px] opacity-20"
        style={{
          background: "radial-gradient(ellipse at center, rgba(192,132,252,0.25) 0%, transparent 70%)",
        }}
      />

      {/* Luminous curved violet and electric-blue energy ribbons */}
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sageRibbonGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6C3BFF" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#9A4DFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="violetRibbonGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#6C3BFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4EA7FF" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Long swooping arc under editor */}
        <path
          d="M -100 240 C 280 160, 680 340, 1150 260 C 1450 210, 1750 310, 2050 240"
          fill="none"
          stroke="url(#sageRibbonGrad1)"
          strokeWidth="1.6"
          strokeDasharray="8 6"
          className="opacity-60"
        />
        {/* Subtle crossing orbital curve */}
        <path
          d="M 50 120 C 450 360, 920 180, 1420 320 C 1720 400, 1980 280, 2100 290"
          fill="none"
          stroke="url(#violetRibbonGrad2)"
          strokeWidth="1.2"
          strokeOpacity="0.45"
        />
      </svg>

      {/* Tiny Twinkling Stars & Dust */}
      {[
        { top: "14%", left: "8%", size: 2, delay: 0 },
        { top: "22%", left: "18%", size: 1.5, delay: 1.2 },
        { top: "11%", left: "34%", size: 2.2, delay: 0.8 },
        { top: "28%", left: "48%", size: 1.5, delay: 2.1 },
        { top: "16%", left: "62%", size: 2, delay: 1.6 },
        { top: "24%", left: "76%", size: 1.8, delay: 0.4 },
        { top: "12%", left: "88%", size: 2.2, delay: 2.4 },
        { top: "32%", left: "94%", size: 1.5, delay: 1.8 },
      ].map((star, idx) => (
        <motion.div
          key={idx}
          className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 0.9, 0.2],
            scale: [0.9, 1.3, 0.9],
          }}
          transition={{
            duration: 3 + (idx % 3),
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Subtle Grid Sheen */}
      <div 
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             Store Builder Showcase (Desktop Editor + Mobile + Cards)       */
/* -------------------------------------------------------------------------- */

export function StoreBuilderShowcase() {
  const shouldReduceMotion = useReducedMotion();
  
  // Looping animation steps (0 to 6)
  // 0: Idle over canvas
  // 1: Select Hero Block (highlight outline + floating toolbar appears)
  // 2: Click Design/Theme -> Palette popout reveals & accents shift to warm sage
  // 3: Click Products -> Product card updates price & stock status
  // 4: Toggle Mobile Preview mode
  // 5: Click Publish -> button turns green ("✓ Published!")
  // 6: Pause state, then loop back
  const [animStep, setAnimStep] = useState(0);
  const [themePalette, setThemePalette] = useState<"sage" | "earth" | "minimal">("sage");
  const [isPublished, setIsPublished] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (shouldReduceMotion) return;

    const interval = setInterval(() => {
      setAnimStep((prev) => {
        const next = (prev + 1) % 7;
        // Side-effects per step
        if (next === 2) setThemePalette("sage");
        if (next === 4) setPreviewDevice("mobile");
        if (next === 5) setIsPublished(true);
        if (next === 6) {
          // Keep published for pause
        }
        if (next === 0) {
          setIsPublished(false);
          setPreviewDevice("desktop");
        }
        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  // Gentle 3D parallax on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  return (
    <div 
      className="relative mx-auto max-w-[1720px] px-3 sm:px-5 xl:px-8 select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Main 4-Column Balanced Grid: Left Info / Editor / Mobile / Badges  */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 xl:gap-4 items-center">

        {/* ================================================================ */}
        {/* LEFT COLUMN (~22%): Identity Badge + Short Headline + 3 Bullets   */}
        {/* ================================================================ */}
        <div className="lg:col-span-3 flex flex-col justify-center text-left z-20">
          
          {/* B2Roll Store Builder Identity Pill */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#17122F]/85 border border-violet-400/35 px-3 py-1 shadow-[0_2px_16px_rgba(108,59,255,0.3)] w-fit mb-2 xl:mb-2.5 backdrop-blur-md"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6C3BFF] text-white shadow-2xs">
              <Store className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight">
              <span className="text-violet-300 font-extrabold uppercase text-[10.5px]">b2roll</span>
              <span className="text-white/40">•</span>
              <span className="text-[#EAE5DC] font-semibold text-[11px]">Store Builder</span>
            </div>
          </motion.div>

          {/* Short Headline (Hierarchical match to reference) */}
          <motion.h1 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="text-xl sm:text-2xl xl:text-[28px] 2xl:text-[32px] font-black tracking-tight text-white leading-[1.15] mb-2 xl:mb-3"
          >
            Your Online Store,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-white">
              Without Limits.
            </span>
          </motion.h1>

          {/* Max 3 Factual Benefit Bullets (Sourced directly from B2Roll) */}
          <motion.ul 
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="space-y-1.5 xl:space-y-2 text-xs xl:text-[13px] text-slate-300 font-medium mb-3"
          >
            <li className="flex items-start gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 shrink-0 mt-0.5 border border-violet-400/30">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                Custom domain with automatic SSL — <strong className="text-white">live in minutes</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 shrink-0 mt-0.5 border border-violet-400/30">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                Pathao, Steadfast & RedX courier <strong className="text-white">automation native</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 shrink-0 mt-0.5 border border-violet-400/30">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </div>
              <span className="leading-snug">
                Automated COD, <strong className="text-white">5-stage SMS tracking</strong> & bKash/Nagad
              </span>
            </li>
          </motion.ul>

          {/* Left Handwritten Micro Copy with animated curved SVG arrow */}
          <div className="hidden xl:flex items-center gap-2 text-violet-300 text-[12.5px] rotate-[-2deg] select-none pt-1">
            <span style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif" }}>
              From idea to your own store — in minutes.
            </span>
            <svg width="34" height="24" viewBox="0 0 50 36" fill="none" className="text-violet-300 opacity-80">
              <path
                d="M 6 12 C 20 6, 32 14, 44 26"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 36 28 L 45 27 L 43 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

        </div>


        {/* ================================================================ */}
        {/* CENTER COLUMN (~52%): Large Desktop Store Builder / Editor UI   */}
        {/* ================================================================ */}
        <div 
          className="lg:col-span-6 flex flex-col z-10 transition-transform duration-200"
          style={{
            transform: `perspective(1200px) rotateY(${mouseOffset.x * 1.8}deg) rotateX(${-mouseOffset.y * 1.4}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Main Desktop Editor Frame */}
          <div className="relative rounded-2xl bg-[#0D1612] border border-[#4E715E]/40 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_35px_rgba(78,113,94,0.25)] flex flex-col overflow-hidden text-slate-100 h-[260px] xl:h-[310px]">

            {/* 1. Top Editor Chrome / Control Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#122019] border-b border-[#4E715E]/30 text-xs">
              {/* Traffic dots + Store identifier */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#FF5F56]/80" />
                  <span className="h-2 w-2 rounded-full bg-[#FFBD2E]/80" />
                  <span className="h-2 w-2 rounded-full bg-[#27C93F]/80" />
                </div>
                <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-[#08110D] px-2 py-0.5 border border-white/10 text-[10px] text-slate-300">
                  <ShieldCheck className="h-2.5 w-2.5 text-[#87A96B]" />
                  <span className="font-bold text-white">digitross.b2roll.com</span>
                </div>
              </div>

              {/* Viewport switcher + Preview & Publish Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Desktop / Mobile toggle */}
                <div className="flex items-center rounded-lg bg-[#09140F] p-0.5 border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                      previewDevice === "desktop"
                        ? "bg-[#4E715E] text-white font-bold shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Monitor className="h-2.5 w-2.5" />
                    <span className="hidden md:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                      previewDevice === "mobile"
                        ? "bg-[#4E715E] text-white font-bold shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Smartphone className="h-2.5 w-2.5" />
                    <span className="hidden md:inline">Mobile</span>
                  </button>
                </div>

                {/* Preview Button */}
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold text-white transition-colors"
                >
                  <Eye className="h-2.5 w-2.5 text-slate-300" />
                  <span>Preview</span>
                </button>

                {/* Publish Button with Animated Success Feedback */}
                <motion.button
                  type="button"
                  animate={{
                    backgroundColor: isPublished ? "#2E7D32" : "#4E715E",
                    scale: animStep === 5 ? [1, 1.05, 1] : 1,
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10.5px] font-bold text-white shadow-[0_2px_10px_rgba(78,113,94,0.4)] transition-all cursor-pointer"
                >
                  {isPublished ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                      <span>Published!</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-2.5 w-2.5" />
                      <span>Publish</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* 2. Workspace Body: Left Sidebar + Live Canvas */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Sidebar (Verified B2Roll Modules) */}
              <div className="w-[105px] xl:w-[125px] bg-[#0E1A14] border-r border-[#4E715E]/25 p-1.5 flex flex-col justify-between shrink-0 text-[10px]">
                <div className="space-y-0.5">
                  <div className="px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">
                    Store Manager
                  </div>
                  {[
                    { id: "design", label: "Design / Themes", icon: Palette, active: animStep === 2 },
                    { id: "pages", label: "Pages & Blocks", icon: Layers, active: false },
                    { id: "products", label: "Products", icon: Package, active: animStep === 3 },
                    { id: "collections", label: "Collections", icon: FolderTree, active: false },
                    { id: "orders", label: "Orders (COD)", icon: ShoppingBag, active: false },
                    { id: "delivery", label: "Delivery Couriers", icon: Truck, active: false },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <div
                        key={tab.id}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-all ${
                          tab.active
                            ? "bg-[#4E715E] text-white font-bold shadow-xs"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className={`h-3 w-3 ${tab.active ? "text-white" : "text-[#87A96B]"}`} />
                        <span className="truncate leading-tight">{tab.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Settings Link */}
                <div className="pt-1 border-t border-white/10 flex items-center gap-1.5 px-1.5 py-0.5 text-slate-400 hover:text-white cursor-pointer">
                  <Settings className="h-3 w-3" />
                  <span>Settings</span>
                </div>
              </div>

              {/* Center live storefront canvas */}
              <div className="flex-1 relative bg-[#FAF8F5] text-slate-900 overflow-hidden flex flex-col">
                
                {/* Simulated Store Navigation Bar */}
                <div className="flex items-center justify-between px-3 py-1 bg-white border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-tight text-[#18181B]">DIGITROSS</span>
                    <span className="hidden sm:inline text-[8.5px] text-[#4E715E] font-semibold bg-[#4E715E]/10 px-1.5 py-0.2 rounded">
                      Modern Home
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-slate-600 font-medium">
                    <span className="hover:text-black cursor-pointer">Living</span>
                    <span className="hover:text-black cursor-pointer">Decor</span>
                    <span className="hover:text-black cursor-pointer">Lighting</span>
                    <div className="h-3 w-px bg-slate-300" />
                    <span className="font-bold text-[#18181B] bg-slate-100 px-1.5 py-0.5 rounded-full text-[8.5px]">
                      Cart (2)
                    </span>
                  </div>
                </div>

                {/* Canvas Body: Live Hero & Product Grid with Interactive Selection */}
                <div className="flex-1 p-2.5 overflow-hidden flex flex-col justify-between">
                  
                  {/* Hero Block with Animated Selection Outline */}
                  <motion.div
                    animate={{
                      borderColor: (animStep === 1 || animStep === 2) ? "#4E715E" : "transparent",
                      boxShadow: (animStep === 1 || animStep === 2) ? "0 0 0 1.5px #4E715E, 0 4px 14px rgba(78,113,94,0.2)" : "none",
                    }}
                    className="relative rounded-xl p-2 sm:p-2.5 border transition-all duration-300 flex items-center justify-between gap-2.5 overflow-hidden"
                    style={{
                      background: themePalette === "sage" 
                        ? "linear-gradient(135deg, #F0ECE4 0%, #E7E0D3 100%)" 
                        : "linear-gradient(135deg, #FAF8F5 0%, #F1EEE9 100%)",
                    }}
                  >
                    {/* Contextual Floating Edit Toolbar */}
                    <AnimatePresence>
                      {(animStep === 1 || animStep === 2) && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.9 }}
                          className="absolute -top-1.5 left-3 bg-[#18181B] text-white px-2 py-0.5 rounded-full text-[8px] font-bold flex items-center gap-1.5 shadow-md z-30"
                        >
                          <span className="flex h-1.5 w-1.5 rounded-full bg-[#87A96B]" />
                          <span>Hero Block</span>
                          <span className="text-white/40">|</span>
                          <span className="text-[#87A96B]">Edit Style</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Hero Left Content */}
                    <div className="space-y-1 z-10 max-w-[60%]">
                      <div className="flex items-center gap-1">
                        <span className="rounded-full bg-[#4E715E] text-white text-[7.5px] font-extrabold px-1.5 py-0.2 uppercase tracking-wide">
                          Spring Drop
                        </span>
                        <span className="text-[8.5px] text-[#4E715E] font-bold">New Arrival</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-[#18181B] leading-tight">
                        Minimalist Oak Lounge Chair
                      </h3>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-[#18181B]">৳8,450</span>
                        <span className="text-[9px] text-slate-500 line-through">৳9,800</span>
                      </div>
                      <button 
                        type="button"
                        className="rounded-md bg-[#18181B] text-white text-[8px] font-bold px-2 py-0.5 hover:bg-[#4E715E] transition-colors"
                      >
                        Shop Now →
                      </button>
                    </div>

                    {/* Hero Right Visual (Chair / Lifestyle Furniture graphic) */}
                    <div className="relative w-20 sm:w-24 h-16 sm:h-20 rounded-lg bg-gradient-to-br from-white via-[#EFECE6] to-[#DDD7CA] flex items-center justify-center shadow-inner shrink-0 border border-slate-200/80">
                      {/* Graphic depiction of modern lounge chair */}
                      <svg width="44" height="44" viewBox="0 0 64 64" fill="none" className="text-[#3D5A4B]">
                        <rect x="16" y="24" width="32" height="12" rx="3" fill="#4E715E" />
                        <rect x="20" y="12" width="24" height="14" rx="3" fill="#6A947F" />
                        <path d="M18 36 L14 52 M46 36 L50 52 M24 36 L22 48 M40 36 L42 48" stroke="#18181B" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="32" cy="18" r="2" fill="#EAE5DC" />
                      </svg>
                      <span className="absolute bottom-1 right-1 rounded bg-white/90 px-1 py-0.1 text-[6.5px] font-bold text-slate-700 shadow-2xs">
                        In Stock (8)
                      </span>
                    </div>
                  </motion.div>

                  {/* Featured Product Cards Row (Demonstrates Catalog Engine) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1.5">
                    {[
                      { name: "Ceramic Carafe", price: "৳1,650", tag: "Best Seller", color: "#E9E2D2" },
                      { name: "Brass Desk Lamp", price: "৳4,850", tag: "6 left", color: "#D9CDB7" },
                      { name: "Linen Field Shirt", price: "৳2,480", tag: "Popular", color: "#C9B79C" },
                    ].map((prod, idx) => (
                      <motion.div
                        key={prod.name}
                        animate={{
                          borderColor: (animStep === 3 && idx === 0) ? "#4E715E" : "#E5E0D8",
                          backgroundColor: (animStep === 3 && idx === 0) ? "#FFFFFF" : "#FAF8F5",
                          scale: (animStep === 3 && idx === 0) ? 1.02 : 1,
                        }}
                        className="rounded-lg border border-[#E5E0D8] p-1.5 flex flex-col justify-between bg-white text-[8px] shadow-2xs transition-all"
                      >
                        <div 
                          className="w-full h-7 rounded flex items-center justify-center mb-1 relative overflow-hidden"
                          style={{ backgroundColor: prod.color }}
                        >
                          <span className="text-[6.5px] font-bold text-slate-700 bg-white/80 px-1 rounded absolute top-0.5 left-0.5">
                            {prod.tag}
                          </span>
                        </div>
                        <span className="font-bold text-[#18181B] truncate">{prod.name}</span>
                        <div className="flex items-center justify-between text-[7.5px] text-slate-600">
                          <span className="font-extrabold text-[#3D5A4B]">{prod.price}</span>
                          <span className="text-[6.5px] text-[#4E715E] font-medium">+ COD</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Trust badge footer on canvas */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 text-[7px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <Truck className="h-2 w-2 text-[#4E715E]" /> Pathao & Steadfast native
                    </span>
                    <span className="flex items-center gap-0.5">
                      <ShieldCheck className="h-2 w-2 text-[#4E715E]" /> Cash on Delivery
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Globe className="h-2 w-2 text-[#4E715E]" /> Custom domain + SSL
                    </span>
                  </div>

                </div>

                {/* Simulated Animated Cursor moving through workflow */}
                {!shouldReduceMotion && (
                  <motion.div
                    animate={{
                      x: [40, 220, 220, 60, 60, 310, 310, 40][animStep],
                      y: [30, 90, 90, 50, 110, 18, 18, 30][animStep],
                      opacity: [0.8, 1, 1, 1, 1, 1, 1, 0.8][animStep],
                    }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="absolute pointer-events-none z-50 drop-shadow-md text-[#18181B]"
                  >
                    <MousePointer2 className="h-4 w-4 fill-white stroke-[#18181B]" />
                  </motion.div>
                )}

              </div>
            </div>

          </div>
        </div>


        {/* ================================================================ */}
        {/* RIGHT OF CENTER (~22%): Realistic Mobile Storefront Preview     */}
        {/* ================================================================ */}
        <div 
          className="lg:col-span-3 flex items-center justify-center z-15 transition-transform duration-200"
          style={{
            transform: `perspective(1200px) rotateY(${-5 + mouseOffset.x * 2}deg) rotateX(${1 - mouseOffset.y * 1.2}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Smartphone Frame */}
          <div className="relative w-[155px] xl:w-[175px] h-[255px] xl:h-[305px] rounded-[26px] bg-[#101914] border-[3px] border-[#3D5A4B]/60 p-1.5 shadow-[0_20px_45px_rgba(0,0,0,0.6),0_0_24px_rgba(78,113,94,0.3)] flex flex-col overflow-hidden text-[#18181B]">
            
            {/* Phone Speaker & Notch */}
            <div className="w-12 h-2.5 bg-black rounded-full mx-auto mb-1 shrink-0 flex items-center justify-center">
              <span className="h-1 w-1 rounded-full bg-slate-700" />
            </div>

            {/* Mobile storefront preview */}
            <div className="flex-1 rounded-[18px] bg-[#FAF8F5] overflow-hidden flex flex-col justify-between border border-slate-200">
              
              {/* Mobile Header */}
              <div className="px-2 py-1 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-black tracking-tight text-[#18181B]">DIGITROSS</span>
                <span className="text-[7.5px] font-bold bg-[#4E715E] text-white px-1.5 py-0.2 rounded-full">
                  Cart (2)
                </span>
              </div>

              {/* Mobile Hero Block */}
              <div className="p-1.5 space-y-1">
                <div 
                  className="rounded-lg p-1.5 border border-[#E5E0D8] space-y-0.5"
                  style={{
                    background: themePalette === "sage" ? "#F0ECE4" : "#FAF8F5",
                  }}
                >
                  <span className="text-[6.5px] font-extrabold uppercase bg-[#4E715E] text-white px-1 py-0.1 rounded">
                    Spring Drop
                  </span>
                  <div className="text-[8.5px] font-extrabold leading-tight text-[#18181B]">
                    Minimalist Oak Chair
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-black text-[#18181B]">৳8,450</span>
                    <button type="button" className="rounded bg-[#18181B] text-white text-[6.5px] font-bold px-1.5 py-0.2">
                      Order
                    </button>
                  </div>
                </div>

                {/* Mobile Catalog Item */}
                <div className="rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded bg-[#E9E2D2] flex items-center justify-center shrink-0">
                      <span className="text-[6px] font-bold text-slate-700">Lamp</span>
                    </div>
                    <div>
                      <div className="text-[7.5px] font-bold text-[#18181B]">Desk Lamp</div>
                      <div className="text-[7px] text-[#3D5A4B] font-bold">৳4,850</div>
                    </div>
                  </div>
                  <span className="text-[6.5px] text-[#4E715E] font-extrabold">Instant COD</span>
                </div>
              </div>

              {/* Mobile Checkout / Courier Status Strip */}
              <div className="px-2 py-1 bg-[#122019] text-white flex items-center justify-between text-[7px]">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pathao Courier Synced
                </span>
                <span className="text-[6.5px] text-slate-300">1-Click COD</span>
              </div>

            </div>

            {/* Mobile Home Bar */}
            <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mt-1 shrink-0" />
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FAR RIGHT / FLOATING CONTEXTUAL CAPABILITY CARDS (Max 3, Refined)   */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden 2xl:block pointer-events-none">
        
        {/* Card 1: Courier Automation (Native Pathao / Steadfast / RedX) */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0, y: [0, -4, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: 0.3 },
            x: { duration: 0.5, delay: 0.3 },
            y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
          }}
          className="absolute -right-2 3xl:right-2 top-[32px] w-[185px] rounded-xl bg-[#0C1712]/90 border border-[#4E715E]/40 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_16px_rgba(78,113,94,0.25)] backdrop-blur-md z-30 text-white"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#4E715E] text-white shadow-2xs">
              <Truck className="h-2.5 w-2.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-white leading-tight">Courier Automation</div>
              <div className="text-[7.5px] text-emerald-400 font-semibold">Pathao • Steadfast • RedX</div>
            </div>
          </div>
          <div className="text-[8.5px] text-slate-300 leading-snug">
            Automated COD consignments, label printing & cash reconciliation.
          </div>
        </motion.div>

        {/* Card 2: 5-Stage Live SMS Tracking */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0, y: [0, 4, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: 0.45 },
            x: { duration: 0.5, delay: 0.45 },
            y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
          }}
          className="absolute -right-6 3xl:-right-2 top-[125px] w-[190px] rounded-xl bg-[#0E1528]/90 border border-violet-500/40 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_16px_rgba(124,58,237,0.25)] backdrop-blur-md z-30 text-white"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-violet-300 flex items-center gap-1">
              <Radio className="h-2 w-2 text-violet-400 animate-pulse" /> 5-Stage SMS
            </span>
            <span className="text-[7.5px] text-slate-400">08:41 AM</span>
          </div>
          <div className="bg-white/10 rounded-md p-1.5 text-[8px] text-white leading-snug">
            “Out for delivery. Rider Mizan is 1.4 km away — ETA 20 min.”
          </div>
        </motion.div>

        {/* Card 3: Real Orders & Dashboard Revenue */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0, y: [0, -3, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: 0.6 },
            x: { duration: 0.5, delay: 0.6 },
            y: { duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1 },
          }}
          className="absolute -right-2 3xl:right-2 top-[225px] w-[180px] rounded-xl bg-[#0F1C16]/90 border border-[#4E715E]/40 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md z-30 text-white"
        >
          <div className="flex items-center justify-between text-[8px] text-slate-300 mb-0.5">
            <span className="font-bold">Orders Today</span>
            <span className="text-emerald-400 font-extrabold">+22%</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-black text-white">184 orders</span>
            <span className="text-[8px] text-slate-400 font-medium">৳42,600 COD</span>
          </div>
          {/* Micro bar chart */}
          <div className="flex items-end gap-1 h-3.5 mt-1">
            {[35, 55, 45, 75, 60, 90, 80, 100].map((val, i) => (
              <span
                key={i}
                className="flex-1 rounded-xs"
                style={{
                  height: `${val}%`,
                  backgroundColor: i === 7 ? "#87A96B" : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*             Cloud Transition (Deep Sage/Navy -> Warm White Ground)         */
/* -------------------------------------------------------------------------- */

function CloudTransitionToPricing() {
  return (
    <div className="relative w-full h-[40px] xl:h-[44px] overflow-visible pointer-events-none select-none z-10 my-0 flex items-center justify-center">
      {/* Upper Atmospheric Sage & Violet Glows */}
      <div className="absolute -top-12 left-1/4 -translate-x-1/2 w-[700px] h-[130px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(78,113,94,0.45)_0%,_rgba(106,148,127,0.2)_40%,_transparent_75%)] blur-[35px]" />
      <div className="absolute -top-12 right-1/4 translate-x-1/2 w-[700px] h-[130px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(192,132,252,0.35)_0%,_rgba(124,58,237,0.15)_40%,_transparent_75%)] blur-[35px]" />

      {/* Soft Luminous Cloud Base Billows */}
      <div className="absolute -top-10 -left-10 w-[600px] h-[140px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(250,248,245,0.95)_0%,_rgba(234,229,220,0.6)_45%,_transparent_75%)] blur-[30px]" />
      <div className="absolute -top-10 -right-10 w-[620px] h-[140px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(250,248,245,0.95)_0%,_rgba(216,196,255,0.45)_45%,_transparent_75%)] blur-[30px]" />
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-[950px] h-[110px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,1)_0%,_rgba(250,248,245,0.85)_45%,_transparent_75%)] blur-[22px]" />
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[1920px] h-[90px] rounded-full bg-[radial-gradient(ellipse_at_center,_#FAF8FC_0%,_#FAF8FC_65%,_transparent_95%)] blur-[18px]" />

      {/* Centered Compact "See all features" Button */}
      <Link
        href="/features"
        className="pointer-events-auto group inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/95 border border-[#4E715E]/40 text-slate-900 font-bold text-[11px] shadow-[0_4px_14px_rgba(78,113,94,0.22)] hover:border-[#4E715E] hover:shadow-[0_6px_20px_rgba(78,113,94,0.35)] hover:scale-[1.03] active:scale-[0.98] transition-all z-20"
      >
        <SlidersHorizontal className="h-3 w-3 text-[#4E715E]" />
        <span>See all features</span>
        <ArrowRight className="h-3 w-3 text-[#4E715E] group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*        Pricing Section (Approved SellPilot 3-Card Dominant System)         */
/* -------------------------------------------------------------------------- */

function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const isYearly = billingCycle === "yearly";
  const [highlightPulse, setHighlightPulse] = useState(false);

  useEffect(() => {
    const handler = () => {
      setHighlightPulse(true);
      setTimeout(() => setHighlightPulse(false), 1200);
    };
    window.addEventListener("sellpilot:highlight-pricing", handler);
    return () => window.removeEventListener("sellpilot:highlight-pricing", handler);
  }, []);

  return (
    <section 
      id="pricing" 
      className={`relative z-20 w-full bg-gradient-to-b from-[#FAF8FC] via-white to-[#F6F2FB] text-slate-900 pt-1 sm:pt-1.5 pb-2.5 sm:pb-3.5 overflow-hidden transition-all duration-500 ${
        highlightPulse ? "ring-2 ring-emerald-500/60 shadow-[0_0_80px_rgba(78,113,94,0.35)]" : ""
      }`}
    >
      {/* Soft atmospheric cloud puffs framing the pricing section corners */}
      <div className="pointer-events-none absolute -bottom-10 -left-16 w-[450px] h-[260px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(78,113,94,0.25)_0%,_rgba(234,229,220,0.2)_40%,_transparent_75%)] blur-[50px] select-none" />
      <div className="pointer-events-none absolute -bottom-10 -right-16 w-[480px] h-[280px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(216,180,254,0.35)_0%,_rgba(233,213,255,0.18)_40%,_transparent_75%)] blur-[50px] select-none" />
      
      <div className="mx-auto max-w-[1260px] xl:max-w-[1300px] px-3 sm:px-5">
        
        {/* Header + Billing Toggle Row */}
        <div className="flex flex-row items-center justify-between mb-2 xl:mb-2.5 gap-4">
          <div>
            <h2 className="text-lg sm:text-xl xl:text-2xl font-extrabold tracking-tight text-[#11182F] leading-tight">
              Simple plans.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4E715E] via-[#6A947F] to-[#7C3AED]">
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
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-b from-violet-500/50 via-purple-600/30 to-[#4E715E]/25 opacity-80 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />

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
            className="group relative flex flex-col justify-between rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] p-3 xl:p-4 2xl:p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_rgba(78,113,94,0.25)] hover:border-[#4E715E]/60 transition-all text-[#18181B] h-[310px] min-[1400px]:h-[340px] 2xl:h-[420px]"
          >
            {/* Restrained Muted Sage Ambient Glow on Hover */}
            <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-b from-[#4E715E]/20 via-[#6A947F]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />

            <div>
              {/* Card Top: Storefront Icon, Title, Discount Badge */}
              <div className="flex items-center justify-between mb-1.5 xl:mb-2">
                <div className="flex items-center gap-1.5 xl:gap-2">
                  <div className="flex h-7 w-7 xl:h-8 xl:w-8 items-center justify-center rounded-lg bg-[#EAE5DC] text-[#3D5A4B] shadow-2xs">
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
                    <div className="flex h-3.5 w-3.5 xl:h-4 xl:w-4 items-center justify-center rounded-full bg-[#4E715E]/15 text-[#3D5A4B] shrink-0">
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

export function StoreBuilderProductPage() {
  return (
    <main className="relative w-full min-h-screen xl:h-screen xl:max-h-[1080px] flex flex-col justify-between overflow-x-hidden overflow-y-auto xl:overflow-hidden bg-[#070817] text-slate-100 selection:bg-violet-600 selection:text-white">
      {/* Unified Atmospheric Background */}
      <CinematicStoreBackground />

      {/* Top Store Builder Showcase Section (Positioned directly below Navbar) */}
      <section className="relative pt-[56px] sm:pt-[60px] pb-1 z-10 flex-shrink-0">
        <StoreBuilderShowcase />
      </section>

      {/* Organic Cloud Transition Layer */}
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
