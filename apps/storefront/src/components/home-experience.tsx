"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  Bot,
  Send,
  CheckCircle2,
  ShoppingBag,
  Wifi,
  Battery,
  Signal,
  Lock,
} from "lucide-react";
import {
  PackageIllustration,
  DeliveryTruckIllustration,
} from "./product-illustrations";

export function HomeExperience() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const phoneY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const cardsY = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Subtle 3D tilt
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), {
    damping: 45,
    stiffness: 90,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), {
    damping: 45,
    stiffness: 90,
  });

  // Floating cards parallax tilt
  const card1RotX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), {
    damping: 40,
    stiffness: 75,
  });
  const card1RotY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 4]), {
    damping: 40,
    stiffness: 75,
  });

  const card2RotX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -12]), {
    damping: 40,
    stiffness: 75,
  });
  const card2RotY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 12]), {
    damping: 40,
    stiffness: 75,
  });

  const card3RotX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -4]), {
    damping: 40,
    stiffness: 75,
  });
  const card3RotY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 0]), {
    damping: 40,
    stiffness: 75,
  });

  return (
    <main className="sellpilot-home relative bg-[#050617] text-white font-sans selection:bg-violet-500/30 overflow-x-hidden">
      {/* ===================================================
          HERO SECTION
          Cinematic atmospheric canvas fitting 100% in first viewport (1920x1080 @ 100%)
      =================================================== */}
      <section
        ref={containerRef}
        className="sellpilot-hero relative w-full pt-[82px] sm:pt-[86px] lg:pt-[92px] pb-7 lg:pb-8 flex flex-col items-center overflow-hidden min-h-screen lg:min-h-[1100px] lg:h-[1100px]"
      >
        {/* ===================================================
            PLANE 1: BASE ATMOSPHERIC CONTINUOUS FOUNDATION
            Luminous white/lavender top -> Soft cloud transition -> Rich mid-violet -> Deep cosmic navy
        =================================================== */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, #F9F8FE 0%, #F3F0FF 12%, #EBE4FF 24%, #DED3FF 35%, #C2B0FF 45%, #9D75FF 55%, #733DEE 66%, #4A1CB8 78%, #2B116A 88%, #160A3D 95%, #07091C 100%)",
          }}
        />

        {/* Broad translucent light planes fill the hero edges without competing with the copy. */}
        <div
          className="hero-light-forms absolute inset-0 z-[1] pointer-events-none"
          aria-hidden="true"
        >
          <span className="hero-light-form hero-light-form-left" />
          <span className="hero-light-form hero-light-form-right" />
          <span className="hero-light-form hero-light-form-low" />
        </div>

        {/* Dynamic Multi-Plane Atmospheric Canvas */}
        <motion.div
          style={{ y: backgroundY }}
          className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
        >
          {/* ===================================================
              PLANE 2: ATMOSPHERIC CLOUD MASSES (Colored light diffusing through soft fog)
              7 Distinct major cloud groups with layered opacity and varied blurs
          =================================================== */}
          <motion.div
            animate={{ x: [-3, 4, -3], y: [-2, 3, -2] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* GROUP A: Upper-Left White/Lavender Cloud */}
            <div className="absolute -top-24 -left-32 w-[860px] h-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(221,211,255,0.78)_0%,_rgba(233,227,255,0.45)_50%,_transparent_75%)] blur-[90px]" />
            <div className="absolute -top-12 -left-16 w-[560px] h-[420px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(241,238,255,0.7)_0%,_rgba(221,211,255,0.32)_50%,_transparent_75%)] blur-[65px]" />

            {/* GROUP B: Tinted illumination, kept calm behind the headline */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[1360px] h-[520px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(252,250,255,0.9)_0%,_rgba(241,236,255,0.76)_38%,_rgba(218,205,255,0.34)_62%,_transparent_80%)] blur-[72px]" />
            <div className="absolute top-[46px] left-1/2 -translate-x-1/2 w-[820px] h-[310px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,245,255,0.76)_0%,_rgba(226,216,255,0.42)_48%,_transparent_76%)] blur-[58px]" />

            {/* GROUP C: Upper-Right Lavender Cloud */}
            <div className="absolute -top-20 -right-32 w-[840px] h-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(216,196,255,0.75)_0%,_rgba(233,227,255,0.42)_50%,_transparent_75%)] blur-[90px]" />
            <div className="absolute -top-10 -right-16 w-[540px] h-[420px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(241,238,255,0.65)_0%,_rgba(221,211,255,0.3)_50%,_transparent_75%)] blur-[65px]" />

            {/* GROUP D: Mid-Left Violet Cloud (behind Card 01 flank) */}
            <div className="absolute top-[290px] -left-40 w-[800px] h-[660px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(167,131,255,0.65)_0%,_rgba(139,92,255,0.42)_42%,_rgba(116,64,239,0.2)_68%,_transparent_82%)] blur-[100px]" />
            <div className="absolute top-[340px] -left-20 w-[540px] h-[480px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(196,179,255,0.5)_0%,_rgba(167,131,255,0.28)_50%,_transparent_75%)] blur-[75px]" />

            {/* GROUP E: Mid-Center Violet Bloom (3 Overlapping Radial Blooms behind Phone per Item 7) */}
            {/* 1. Large Soft Violet Ambient Halo */}
            <div className="absolute top-[330px] left-1/2 -translate-x-1/2 w-[940px] h-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(139,92,255,0.68)_0%,_rgba(116,64,239,0.45)_35%,_rgba(95,45,209,0.22)_60%,_transparent_78%)] blur-[90px]" />
            {/* 2. Medium Vibrant Purple Core */}
            <div className="absolute top-[360px] left-1/2 -translate-x-1/2 w-[600px] h-[480px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(167,131,255,0.65)_0%,_rgba(139,92,255,0.4)_45%,_transparent_72%)] blur-[55px]" />
            {/* 3. Faint Blue-Violet Depth Bloom */}
            <div className="absolute top-[400px] left-1/2 -translate-x-1/2 w-[440px] h-[340px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.38)_0%,_rgba(139,92,255,0.18)_50%,_transparent_75%)] blur-[45px]" />

            {/* GROUP F: Mid-Right Purple Cloud (behind Card 02/03 flank) */}
            <div className="absolute top-[280px] -right-40 w-[800px] h-[660px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(196,179,255,0.6)_0%,_rgba(167,131,255,0.42)_42%,_rgba(139,92,255,0.2)_68%,_transparent_82%)] blur-[100px]" />
            <div className="absolute top-[330px] -right-20 w-[540px] h-[480px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(216,196,255,0.48)_0%,_rgba(167,131,255,0.25)_50%,_transparent_75%)] blur-[75px]" />

            {/* GROUP G: Lower-Indigo Haze with Atmospheric Texture per Item 8 (#28135E, #1B1047, #100B30, #07091C) */}
            {/* Center deep indigo-purple mass */}
            <div className="absolute bottom-[30px] left-1/2 -translate-x-1/2 w-[1600px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(40,19,94,0.85)_0%,_rgba(27,16,71,0.65)_40%,_rgba(16,11,48,0.45)_65%,_transparent_85%)] blur-[85px]" />
            {/* Lower-left subtle violet glow under handwritten text (#28135E / #1B1047) */}
            <div className="absolute bottom-0 left-[2%] w-[680px] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(40,19,94,0.6)_0%,_rgba(27,16,71,0.35)_50%,_transparent_75%)] blur-[80px]" />
            {/* Lower-right subtle indigo-navy depth (#1B1047 / #100B30) */}
            <div className="absolute bottom-0 right-[2%] w-[680px] h-[400px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(27,16,71,0.55)_0%,_rgba(16,11,48,0.3)_50%,_transparent_75%)] blur-[80px]" />
            {/* Deep cosmic navy ground anchor (#07091C) */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1800px] h-[260px] rounded-full bg-[radial-gradient(ellipse_at_bottom,_rgba(7,9,28,0.92)_0%,_rgba(16,11,48,0.4)_50%,_transparent_80%)] blur-[60px]" />
          </motion.div>

          {/* ===================================================
              PLANE 3: LUMINOUS LEFT & RIGHT LIGHT RIBBONS
              Organic curved aurora ribbons with feathered outer glow, bright translucent core, and glowing edge crests
          =================================================== */}
          <motion.svg
            animate={{ x: [-3, 4, -3] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 1920 1080"
          >
            <defs>
              {/* Left Ribbon Gradients */}
              <linearGradient
                id="ribbonLeftFaint"
                x1="0%"
                y1="10%"
                x2="50%"
                y2="90%"
              >
                <stop offset="0%" stopColor="#DDD3FF" stopOpacity="0.45" />
                <stop offset="40%" stopColor="#A783FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#321575" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="ribbonLeftGlow"
                x1="0%"
                y1="10%"
                x2="50%"
                y2="90%"
              >
                <stop offset="0%" stopColor="#DDD3FF" stopOpacity="0.9" />
                <stop offset="35%" stopColor="#A783FF" stopOpacity="0.65" />
                <stop offset="70%" stopColor="#7440EF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#321575" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="ribbonLeftCore"
                x1="0%"
                y1="10%"
                x2="45%"
                y2="85%"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="28%" stopColor="#F5F3FF" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#DDD6FE" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="crestLeft" x1="0%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="35%" stopColor="#EDE9FE" stopOpacity="0.92" />
                <stop offset="75%" stopColor="#C4B3FF" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7440EF" stopOpacity="0" />
              </linearGradient>

              {/* Right Ribbon Gradients (Asymmetric) */}
              <linearGradient
                id="ribbonRightFaint"
                x1="100%"
                y1="15%"
                x2="40%"
                y2="90%"
              >
                <stop offset="0%" stopColor="#C4B3FF" stopOpacity="0.4" />
                <stop offset="45%" stopColor="#8B5CFF" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#241052" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="ribbonRightGlow"
                x1="100%"
                y1="15%"
                x2="40%"
                y2="90%"
              >
                <stop offset="0%" stopColor="#C4B3FF" stopOpacity="0.85" />
                <stop offset="40%" stopColor="#8B5CFF" stopOpacity="0.55" />
                <stop offset="75%" stopColor="#5F2DD1" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#241052" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="ribbonRightCore"
                x1="100%"
                y1="15%"
                x2="45%"
                y2="85%"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="35%" stopColor="#DDD3FF" stopOpacity="0.75" />
                <stop offset="70%" stopColor="#A783FF" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#4C1D95" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="crestRight"
                x1="100%"
                y1="0%"
                x2="50%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <stop offset="35%" stopColor="#DDD3FF" stopOpacity="0.88" />
                <stop offset="75%" stopColor="#A783FF" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#4C1D95" stopOpacity="0" />
              </linearGradient>

              {/* Feathered Glow Filters */}
              <filter
                id="ribbonFaintGlow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="65" />
              </filter>
              <filter
                id="ribbonGlowWide"
                x="-40%"
                y="-40%"
                width="180%"
                height="180%"
              >
                <feGaussianBlur stdDeviation="45" />
              </filter>
              <filter
                id="ribbonGlowCore"
                x="-25%"
                y="-25%"
                width="150%"
                height="150%"
              >
                <feGaussianBlur stdDeviation="18" />
              </filter>
              <filter
                id="crestGlow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
            </defs>

            {/* Left Ribbon: Sheer ambient veil body */}
            <path
              d="M -120 280 C 200 340, 440 510, 580 800 C 660 950, 700 1030, 730 1080"
              stroke="url(#ribbonLeftFaint)"
              strokeWidth="240"
              fill="none"
              strokeLinecap="round"
              filter="url(#ribbonFaintGlow)"
            />
            {/* Left Ribbon: Atmospheric feathered glow */}
            <path
              d="M -100 290 C 220 350, 460 520, 600 815 C 670 960, 710 1040, 740 1080"
              stroke="url(#ribbonLeftGlow)"
              strokeWidth="170"
              fill="none"
              strokeLinecap="round"
              filter="url(#ribbonGlowWide)"
            />
            {/* Left Ribbon: Strong luminous lavender/white core */}
            <path
              d="M -80 300 C 240 360, 470 530, 610 820 C 680 965, 720 1045, 745 1080"
              stroke="url(#ribbonLeftCore)"
              strokeWidth="70"
              fill="none"
              strokeLinecap="round"
              filter="url(#ribbonGlowCore)"
            />
            {/* Left Ribbon: Fine luminous edge crest highlight */}
            <path
              d="M -60 310 C 250 370, 480 535, 620 825 C 690 970, 725 1050, 750 1080"
              stroke="url(#crestLeft)"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
              filter="url(#crestGlow)"
            />

            {/* Right Ribbon: Majestic high cascade starting top-right framing cards */}
            {/* Right Ribbon: Secondary wider atmospheric faint glow */}
            <path
              d="M 1780 -30 C 1560 190, 1400 390, 1460 630 C 1520 820, 1680 960, 1850 1080"
              stroke="url(#ribbonRightFaint)"
              strokeWidth="250"
              fill="none"
              strokeLinecap="round"
              filter="url(#ribbonFaintGlow)"
            />
            {/* Right Ribbon: Atmospheric feathered violet glow */}
            <path
              d="M 1770 -20 C 1550 200, 1410 400, 1470 635 C 1530 825, 1690 965, 1845 1080"
              stroke="url(#ribbonRightGlow)"
              strokeWidth="175"
              fill="none"
              strokeLinecap="round"
              filter="url(#ribbonGlowWide)"
            />
            {/* Right Ribbon: Luminous translucent core */}
            <path
              d="M 1760 -10 C 1540 210, 1420 405, 1475 640 C 1535 830, 1695 970, 1840 1080"
              stroke="url(#ribbonRightCore)"
              strokeWidth="65"
              fill="none"
              strokeLinecap="round"
              filter="url(#ribbonGlowCore)"
            />
            {/* Right Ribbon: Fine luminous edge crest highlight */}
            <path
              d="M 1750 0 C 1535 215, 1425 410, 1480 645 C 1540 835, 1700 975, 1835 1080"
              stroke="url(#crestRight)"
              strokeWidth="2.6"
              fill="none"
              strokeLinecap="round"
              filter="url(#crestGlow)"
            />
          </motion.svg>

          {/* ===================================================
              PLANE 5: CURVED ORBITAL SVG PATHS
              Delicate, thin elliptical arcs framing the central phone and cards with gradient strokes
          =================================================== */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            viewBox="0 0 1920 1080"
          >
            <defs>
              <linearGradient id="orbitGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C4B3FF" stopOpacity="0.08" />
                <stop offset="30%" stopColor="#EDE9FE" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#EDE9FE" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#C4B3FF" stopOpacity="0.08" />
              </linearGradient>
              <linearGradient id="orbitGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#DDD3FF" stopOpacity="0.12" />
                <stop offset="50%" stopColor="#C4B3FF" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#8B5CFF" stopOpacity="0.08" />
              </linearGradient>
              <linearGradient id="orbitGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#DDD3FF" stopOpacity="0.1" />
                <stop offset="60%" stopColor="#EDE9FE" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#C4B3FF" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Arc 1: Lower-left sweeping arc through Node 2 */}
            <path
              d="M -30 680 C 240 550, 480 580, 800 690"
              fill="none"
              stroke="url(#orbitGrad1)"
              strokeWidth="1.6"
            />
            {/* Arc 2: Central sweeping arc under phone through Node 3 */}
            <path
              d="M 580 750 C 960 782, 1260 760, 1420 730"
              fill="none"
              stroke="url(#orbitGrad2)"
              strokeWidth="1.4"
            />
            {/* Arc 3: Upper-right framing orbit through prominent Star Node 1 beside Card 02 */}
            <path
              d="M 1160 310 C 1420 370, 1680 510, 1950 680"
              fill="none"
              stroke="url(#orbitGrad3)"
              strokeWidth="1.5"
            />
            {/* Arc 4: Lower-right secondary framing arc through Node 4 near Card 03 */}
            <path
              d="M 1400 600 C 1660 670, 1840 760, 1950 840"
              fill="none"
              stroke="rgba(216, 180, 254, 0.3)"
              strokeWidth="1.2"
            />
            {/* Arc 5: Upper-left transverse arc framing Card 01 */}
            <path
              d="M 10 520 C 260 400, 560 390, 820 420"
              fill="none"
              stroke="rgba(233, 213, 255, 0.25)"
              strokeWidth="1.3"
            />
          </svg>

          {/* ===================================================
              PLANE 6: GLOWING CELESTIAL NODES (Composed directly on orbital paths)
              White luminous centers with soft multi-tier violet halos and subtle flares
          =================================================== */}
          {/* Node 1: Celestial Star Node to the right of Card 02 (Key reference feature, on Arc 3) */}
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.92, 1, 0.92] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-[84%] top-[45%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          >
            <div className="relative flex items-center justify-center">
              {/* Radial Halo Flare */}
              <div className="absolute w-12 h-12 rounded-full bg-violet-400/40 blur-md animate-pulse" />
              {/* Core Light Sphere */}
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_15px_#FFFFFF,0_0_30px_#DDD6FE,0_0_55px_#8B5CF6,0_0_80px_#7C3AED]" />
              {/* Cross sparkle flare (crisp pure white with soft glow) */}
              <div className="absolute w-11 h-[1.5px] bg-white shadow-[0_0_4px_#FFFFFF]" />
              <div className="absolute h-11 w-[1.5px] bg-white shadow-[0_0_4px_#FFFFFF]" />
              <div className="absolute w-5 h-[1px] bg-white/75 rotate-45 shadow-[0_0_2px_#FFFFFF]" />
              <div className="absolute w-5 h-[1px] bg-white/75 -rotate-45 shadow-[0_0_2px_#FFFFFF]" />
            </div>
          </motion.div>

          {/* Node 2: Small node on lower-left arc below Card 01 (on Arc 1) */}
          <div className="absolute left-[21%] top-[57%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_#FFFFFF,0_0_22px_#C4B3FF,0_0_38px_#8B5CFF]" />
          </div>

          {/* Node 3: Subtle node on lower arc under phone (on Arc 2) */}
          <div className="absolute left-[50%] top-[72%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#FFFFFF,0_0_18px_#A783FF,0_0_30px_#7440EF]" />
          </div>

          {/* Node 4: Secondary right/lower node near Card 03 (on Arc 4) */}
          <div className="absolute left-[88%] top-[64%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#FFFFFF,0_0_16px_#C4B3FF,0_0_28px_#8B5CFF]" />
          </div>

          {/* ===================================================
              PLANE 7: SPARSE SPARKLE PARTICLES (✦)
              Very few, subtle, intentional placement matching reference
          =================================================== */}
          <div className="absolute left-[14%] top-[36%] pointer-events-none text-purple-200/60 text-xs animate-pulse">
            ✦
          </div>
          <div
            className="absolute right-[15%] top-[33%] pointer-events-none text-violet-200/55 text-xs animate-pulse"
            style={{ animationDelay: "1.2s" }}
          >
            ✦
          </div>
          <div
            className="absolute left-[30%] top-[68%] pointer-events-none text-fuchsia-200/45 text-xs animate-pulse"
            style={{ animationDelay: "1.8s" }}
          >
            ✦
          </div>
          <div
            className="absolute right-[23%] top-[74%] pointer-events-none text-purple-200/40 text-xs animate-pulse"
            style={{ animationDelay: "2.4s" }}
          >
            ✦
          </div>
          <div
            className="absolute left-[9%] top-[63%] pointer-events-none text-indigo-200/35 text-[11px] animate-pulse"
            style={{ animationDelay: "3.1s" }}
          >
            ✦
          </div>

          {/* ===================================================
              PLANE 8: SOFT ATMOSPHERIC DOWNLIGHT BEAM
          =================================================== */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.45)_0%,_transparent_65%)] pointer-events-none opacity-40" />
        </motion.div>

        {/* Hero Content Header Container */}
        <div className="relative z-30 flex flex-col items-center w-full max-w-[1240px] mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="hero-copy-zone flex flex-col items-center text-center"
          >
            {/* Main Headline */}
            <h1 className="text-[43px] sm:text-[60px] md:text-[72px] lg:text-[82px] font-extrabold leading-[0.94] tracking-[-0.055em] text-[#0B1024]">
              Turn Every
              <br />
              Chat Into a{" "}
              <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#6C3BFF] to-[#C52BFF] pb-1">
                Sale.
                {/* Accent Marks (3 radial rays above Sale.) */}
                <svg
                  className="absolute -top-3.5 -right-5 sm:-top-4 sm:-right-6 w-7 h-7 sm:w-8 sm:h-8 text-violet-500 overflow-visible"
                  viewBox="0 0 30 30"
                  fill="none"
                >
                  <path
                    d="M5 24 L2 20"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 16 L14 8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22 22 L27 18"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Hand-drawn Purple Underline */}
                <svg
                  className="sale-underline absolute w-[108%] h-[18px] -bottom-4 -left-[4%] text-violet-500 overflow-visible"
                  viewBox="0 0 200 24"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 0.9,
                      delay: 0.7,
                      ease: "easeInOut",
                    }}
                    d="M5,10 Q96,2 195,11 Q202,14 184,18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-5 text-[15px] sm:text-base md:text-lg text-[#26314D] max-w-xl font-semibold leading-relaxed">
              Your AI sales agent for{" "}
              <span style={{ color: "#0084FF" }} className="font-semibold">
                Messenger
              </span>
              ,{" "}
              <span style={{ color: "#25D366" }} className="font-semibold">
                WhatsApp
              </span>{" "}
              & your website.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              className="hero-primary-action flex flex-col items-center mt-5 z-30"
            >
              <div className="hero-trust-row flex flex-wrap items-center justify-center gap-4 sm:gap-7 text-xs text-[#4A5571] font-semibold relative z-30">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  Setup in 2 minutes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />
                  Works 24/7
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* ===================================================
              3D PRODUCT DEMONSTRATION STAGE
              Calibrated height so entire hero fits within 1920x1080 @ 100% zoom
          =================================================== */}
          <div
            className="hero-product-stage relative w-full max-w-[1160px] mt-1 sm:mt-2 flex justify-center items-center h-[565px] sm:h-[575px]"
            style={{ perspective: "1500px", transformStyle: "preserve-3d" }}
          >
            {/* Handwritten Note (Lower Left) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.8 }}
              className="absolute left-[-1%] xl:left-[2%] bottom-[7%] hidden lg:flex flex-col transform -rotate-6 z-20 pointer-events-none"
              style={{ translateZ: 70 }}
            >
              <div className="font-caveat text-[34px] xl:text-[38px] leading-[1.08] tracking-wide drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                <div className="text-white">One Agent.</div>
                <div className="text-white">Every Channel.</div>
                <div className="relative inline-block text-fuchsia-400">
                  Endless Sales.
                  {/* Underline under Endless Sales. */}
                  <svg
                    className="endless-underline absolute w-[112%] h-[16px] -bottom-3 -left-[4%] text-fuchsia-400 overflow-visible"
                    viewBox="0 0 160 16"
                    preserveAspectRatio="none"
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 1.4,
                        duration: 0.7,
                        ease: "easeOut",
                      }}
                      d="M 5 7 Q 78 2 155 9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              {/* Curved Arrow pointing up and right directly to the phone chassis */}
              <svg
                className="endless-arrow w-[270px] h-20 mt-1 ml-[158px] text-fuchsia-400 overflow-visible"
                viewBox="0 0 270 78"
              >
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1.7, duration: 0.7, ease: "easeOut" }}
                  d="M 8 62 Q 112 70 252 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 2.2, duration: 0.3 }}
                  d="M 236 15 L 252 20 L 244 34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>

            {/* Floating Card 01: Product Recommendation */}
            <motion.div
              initial={{ opacity: 0, x: -70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                delay: 0.5,
                bounce: 0.2,
                duration: 1.1,
              }}
              style={{
                rotateX: card1RotX,
                rotateY: card1RotY,
                translateZ: 60,
                y: cardsY,
              }}
              className="hero-feature-card hero-card-left absolute left-[-2%] xl:left-[1%] top-[8%] hidden lg:block z-20 w-[270px] xl:w-[288px] transform-gpu"
            >
              {/* Physical Slab Depth Back Layer */}
              <div
                className="absolute inset-0 rounded-[30px] bg-[#050612] shadow-[0_25px_65px_rgba(0,0,0,0.85),0_0_35px_rgba(108,59,255,0.28)]"
                style={{ transform: "translateZ(-8px)" }}
              />

              {/* Physical Outer Bevel Rim */}
              <div className="relative rounded-[30px] p-[2px] bg-gradient-to-b from-white/30 via-violet-500/25 to-slate-900/90 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]">
                {/* Front Face Glass Slab */}
                <div className="hero-card-face relative rounded-[28px] bg-gradient-to-b from-[#131432]/98 to-[#090A1C]/98 backdrop-blur-xl p-4.5 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),inset_0_0_24px_rgba(139,92,246,0.12)] overflow-hidden">
                  {/* Top Specular Edge Highlight */}
                  <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#581C87] border border-white/35 flex items-center justify-center text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.5)]">
                      01
                    </div>
                    <div className="hero-card-title text-[13px] font-extrabold text-white leading-tight tracking-tight">
                      Product Recommendation
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-300 font-medium mb-1.5 leading-snug">
                    AI recommends the right products instantly.
                  </p>

                  {/* Sneaker on subtle purple radial glow */}
                  <div className="hero-card-art w-full h-32 flex items-center justify-center relative my-0.5">
                    <Image
                      src="/images/sellpilot-performance-sneaker.png"
                      alt="Black, white and violet performance sneaker"
                      width={1536}
                      height={1024}
                      className="w-[84%] h-auto object-contain drop-shadow-2xl"
                      priority
                    />
                  </div>
                </div>
              </div>

              {/* Attached Messenger Platform Badge (Unified White Shell Family, Unclipped) */}
              <div className="absolute -bottom-2.5 -right-2.5 w-[42px] h-[42px] bg-white rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.95)] flex items-center justify-center z-30 pointer-events-none">
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-[#0084FF]"
                  fill="currentColor"
                >
                  <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.915 1.488 5.49 3.796 7.152v3.315c0 .357.378.583.693.407l3.435-1.923c.66.183 1.354.28 2.076.28 5.523 0 10-4.145 10-9.259C22 6.145 17.523 2 12 2zm1.042 12.308l-2.614-2.793-5.093 2.793 5.57-5.918 2.664 2.793 5.043-2.793-5.57 5.918z" />
                </svg>
              </div>
            </motion.div>

            {/* Floating Card 02: Order Confirmed */}
            <motion.div
              initial={{ opacity: 0, x: 70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                delay: 0.7,
                bounce: 0.2,
                duration: 1.1,
              }}
              style={{
                rotateX: card2RotX,
                rotateY: card2RotY,
                translateZ: 75,
                y: cardsY,
              }}
              className="hero-feature-card hero-card-upper-right absolute right-[-2%] xl:right-[1%] top-[3%] hidden lg:block z-20 w-[270px] xl:w-[288px] transform-gpu"
            >
              {/* Physical Slab Depth Back Layer */}
              <div
                className="absolute inset-0 rounded-[30px] bg-[#050612] shadow-[0_25px_65px_rgba(0,0,0,0.85),0_0_35px_rgba(108,59,255,0.28)]"
                style={{ transform: "translateZ(-8px)" }}
              />

              {/* Physical Outer Bevel Rim */}
              <div className="relative rounded-[30px] p-[2px] bg-gradient-to-b from-white/30 via-violet-500/25 to-slate-900/90 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]">
                {/* Front Face Glass Slab */}
                <div className="hero-card-face relative rounded-[28px] bg-gradient-to-b from-[#131432]/98 to-[#090A1C]/98 backdrop-blur-xl p-4.5 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),inset_0_0_24px_rgba(139,92,246,0.12)] overflow-hidden">
                  {/* Top Specular Edge Highlight */}
                  <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#581C87] border border-white/35 flex items-center justify-center text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.5)]">
                      02
                    </div>
                    <div className="hero-card-title text-[13px] font-extrabold text-white leading-tight tracking-tight">
                      Order Confirmed
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-300 font-medium mb-1.5 leading-snug">
                    AI takes orders &amp; confirms instantly.
                  </p>

                  {/* 3D Glowing Purple Gift Box / Package */}
                  <div className="hero-card-art w-full h-32 flex items-center justify-center relative my-0.5">
                    <PackageIllustration className="w-[165px] h-auto drop-shadow-2xl" />
                  </div>
                </div>
              </div>

              {/* Attached WhatsApp Platform Badge (Unified White Shell Family, Unclipped) */}
              <div className="absolute -bottom-2.5 -right-2.5 w-[42px] h-[42px] bg-white rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.95)] flex items-center justify-center z-30 pointer-events-none">
                <svg
                  className="w-6 h-6 text-[#25D366]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
              </div>
            </motion.div>

            {/* Floating Card 03: Delivery Tracking */}
            <motion.div
              initial={{ opacity: 0, x: 70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                delay: 0.9,
                bounce: 0.2,
                duration: 1.1,
              }}
              style={{
                rotateX: card3RotX,
                rotateY: card3RotY,
                translateZ: 85,
                y: cardsY,
              }}
              className="hero-feature-card hero-card-lower-right absolute right-[-3%] xl:right-[0%] bottom-[4%] hidden lg:block z-30 w-[270px] xl:w-[288px] transform-gpu"
            >
              {/* Physical Slab Depth Back Layer */}
              <div
                className="absolute inset-0 rounded-[30px] bg-[#050612] shadow-[0_30px_70px_rgba(0,0,0,0.85),0_0_40px_rgba(108,59,255,0.28)]"
                style={{ transform: "translateZ(-8px)" }}
              />

              {/* Physical Outer Bevel Rim */}
              <div className="relative rounded-[30px] p-[2px] bg-gradient-to-b from-white/30 via-violet-500/25 to-slate-900/90 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]">
                {/* Front Face Glass Slab */}
                <div className="hero-card-face relative rounded-[28px] bg-gradient-to-b from-[#131432]/98 to-[#090A1C]/98 backdrop-blur-xl p-4.5 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),inset_0_0_24px_rgba(139,92,246,0.12)] overflow-hidden">
                  {/* Top Specular Edge Highlight */}
                  <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#581C87] border border-white/35 flex items-center justify-center text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.5)]">
                      03
                    </div>
                    <div className="hero-card-title text-[13px] font-extrabold text-white leading-tight tracking-tight">
                      Delivery Tracking
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-300 font-medium mb-1.5 leading-snug">
                    AI tracks &amp; updates customers automatically.
                  </p>

                  {/* 3D Delivery Truck */}
                  <div className="hero-card-art delivery-truck-stage w-full h-32 flex items-center justify-center relative my-0.5">
                    <div className="truck-smoke" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="delivery-truck-motion">
                      <DeliveryTruckIllustration className="w-[210px] h-auto drop-shadow-2xl" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attached Globe / Web Platform Badge (Unified White Shell Family, Unclipped) */}
              <div className="absolute -bottom-2.5 -right-2.5 w-[42px] h-[42px] bg-white rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.95)] flex items-center justify-center z-30 pointer-events-none">
                <svg
                  className="w-6 h-6 text-[#6366F1]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
            </motion.div>

            {/* Central 3D Phone Shell — Flagship Smartphone Physical Hardware */}
            <motion.div
              style={{
                rotateX,
                rotateY,
                z: 50,
                y: phoneY,
                transformStyle: "preserve-3d",
              }}
              initial={{ opacity: 0, y: 70, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 85,
                damping: 22,
                delay: 0.35,
              }}
              className="relative z-20 w-[260px] sm:w-[265px] h-[520px] sm:h-[530px] rounded-[46px] transform-gpu"
            >
              {/* Layer 0: Physical Drop Shadow & Ambient Violet Glow */}
              <div
                className="absolute inset-0 rounded-[46px] bg-black/70 shadow-[0_35px_95px_rgba(0,0,0,0.85),0_15px_40px_rgba(0,0,0,0.65),0_0_80px_rgba(124,58,237,0.38)]"
                style={{ transform: "translateZ(-14px)" }}
              />

              {/* Layer 1: Physical Side Thickness Planes & Metallic Hardware Buttons */}
              {/* Left Metallic Rail */}
              <div className="absolute -left-[4.5px] top-14 bottom-14 w-[5px] bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400 rounded-l-md shadow-xs" />
              {/* Left Hardware Buttons */}
              <div className="absolute -left-[6.5px] top-28 w-[3.5px] h-5 bg-gradient-to-b from-slate-200 to-slate-400 rounded-l-xs shadow-xs border-y border-l border-white/60" />
              <div className="absolute -left-[6.5px] top-38 w-[3.5px] h-11 bg-gradient-to-b from-slate-200 to-slate-400 rounded-l-xs shadow-xs border-y border-l border-white/60" />
              <div className="absolute -left-[6.5px] top-52 w-[3.5px] h-11 bg-gradient-to-b from-slate-200 to-slate-400 rounded-l-xs shadow-xs border-y border-l border-white/60" />
              {/* Left Antenna Bands */}
              <div className="absolute -left-[4.5px] top-20 w-[5px] h-[2px] bg-slate-500/70" />
              <div className="absolute -left-[4.5px] bottom-20 w-[5px] h-[2px] bg-slate-500/70" />

              {/* Right Metallic Rail */}
              <div className="absolute -right-[4.5px] top-14 bottom-14 w-[5px] bg-gradient-to-l from-slate-300 via-slate-400 to-slate-500 rounded-r-md shadow-xs" />
              {/* Right Hardware Power Button */}
              <div className="absolute -right-[6.5px] top-42 w-[3.5px] h-15 bg-gradient-to-b from-slate-200 to-slate-400 rounded-r-xs shadow-xs border-y border-r border-white/60" />
              {/* Right Antenna Bands */}
              <div className="absolute -right-[4.5px] top-20 w-[5px] h-[2px] bg-slate-500/70" />
              <div className="absolute -right-[4.5px] bottom-20 w-[5px] h-[2px] bg-slate-500/70" />

              {/* Layer 2: Ceramic / Polished Titanium Outer Frame */}
              <div className="relative w-full h-full rounded-[46px] p-[3.5px] bg-gradient-to-b from-[#FFFFFF] via-[#F1F5F9] to-[#CBD5E1] shadow-[inset_0_1.5px_2px_rgba(255,255,255,1),inset_0_-1.5px_2px_rgba(148,163,184,0.4),0_0_0_1px_#E2E8F0,0_25px_65px_rgba(0,0,0,0.5)] flex flex-col">
                {/* Top Specular Frame Highlight */}
                <div className="absolute top-0 inset-x-12 h-[1.5px] bg-white rounded-full opacity-90 pointer-events-none" />
                {/* Bottom Ambient Violet Rim Reflection */}
                <div className="absolute bottom-0 inset-x-16 h-[1.5px] bg-violet-400/40 rounded-full pointer-events-none" />

                {/* Layer 3: Inset Black Display Bezel */}
                <div className="w-full h-full rounded-[43px] p-[2.5px] bg-[#0A0A10] flex flex-col relative shadow-[inset_0_0_4px_rgba(0,0,0,0.9)]">
                  {/* Layer 4: Phone Screen Inset (Crisp Light Commerce UI) */}
                  <div className="w-full h-full rounded-[41px] bg-[#FAF8FE] overflow-hidden flex flex-col relative">
                    {/* Polished Status Bar (Light mode text/icons) */}
                    <div className="h-7.5 flex items-center justify-between px-5.5 shrink-0 z-50 text-slate-800 font-semibold text-[11px] pt-1.5">
                      <span className="w-10">9:41</span>
                      {/* Dynamic Island with Camera & FaceID Sensors */}
                      <div className="w-[84px] h-[21px] bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-1.5 shadow-xs flex items-center justify-between px-2.5 z-50">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#151525]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#080816] border border-[#1e203c] flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-[#25284e] relative">
                            <div className="w-0.5 h-0.5 rounded-full bg-[#7dd3fc] absolute top-0 right-0 opacity-80" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 w-10 justify-end text-slate-800">
                        <Signal className="w-3 h-3 fill-current" />
                        <Wifi className="w-3 h-3" />
                        <Battery className="w-3.5 h-3.5 fill-current" />
                      </div>
                    </div>

                    {/* Phone Header (White clean header) */}
                    <div className="h-[44px] bg-white/95 backdrop-blur-sm border-b border-slate-200/90 flex items-center justify-between px-3.5 shrink-0 shadow-2xs">
                      <div className="flex items-center gap-2">
                        {/* Back Arrow */}
                        <button
                          type="button"
                          aria-label="Back"
                          className="p-1 -ml-1 text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-xs relative">
                          <ShoppingBag className="w-3.5 h-3.5 text-white" />
                          <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-slate-900 leading-tight">
                            DigitRoss
                          </div>
                          <div className="text-[9px] font-semibold text-emerald-600">
                            Active now
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 items-center text-slate-400 p-1">
                        <div className="w-1 h-1 bg-slate-500 rounded-full" />
                        <div className="w-1 h-1 bg-slate-500 rounded-full" />
                        <div className="w-1 h-1 bg-slate-500 rounded-full" />
                      </div>
                    </div>

                    {/* Live Conversation Simulation */}
                    <PhoneChatSimulation />

                    {/* Phone Footer Input */}
                    <div className="h-[48px] bg-white border-t border-slate-200/90 flex items-center px-3 shrink-0 mt-auto pb-1 pt-1">
                      <div className="flex-1 h-8 bg-slate-100 border border-slate-200 rounded-full px-3 flex items-center text-[11px] text-slate-500">
                        Type a message...
                      </div>
                      <button className="w-8 h-8 ml-1.5 rounded-full bg-violet-600 flex items-center justify-center text-white shadow-xs">
                        <Send className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>

                    {/* Bottom Safe Area Pill */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[100px] h-1 bg-slate-400/70 rounded-full pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Layer 5: Front Protective Glass & Specular Sweep Reflection */}
              <div
                className="absolute inset-1.5 rounded-[41px] pointer-events-none z-40 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.025) 26%, transparent 42%, rgba(255,255,255,0.018) 70%, transparent 100%)",
                }}
              />
              {/* Bottom Ambient Violet Bounce on Glass */}
              <div className="absolute inset-x-3 bottom-2 h-14 pointer-events-none rounded-b-[41px] z-40 bg-gradient-to-t from-violet-500/12 via-transparent to-transparent" />

              {/* Gentle Floating Idle Loop */}
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 pointer-events-none"
              />
            </motion.div>
          </div>

          {/* Primary action follows the complete product story, as a clear visual conclusion. */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            className="hero-post-visual-cta relative z-30 mt-1 flex flex-col items-center"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-[#6C3BFF] via-[#8B35FF] to-[#D92EFF] text-white px-9 py-3.5 rounded-xl font-bold text-sm sm:text-base shadow-[0_14px_35px_rgba(65,24,176,0.5)] hover:shadow-[0_18px_45px_rgba(217,46,255,0.46)] hover:-translate-y-1 transition-all duration-300"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===================================================
          SECTION 2: PRODUCTS
          Continuous atmospheric transition: Zero horizontal line, zero gradient band.
          Color journey: The dark navy hero sky is organically entered and consumed by
          large soft billowing lavender and white cloud masses.
      =================================================== */}
      <section className="products-atmosphere relative z-20 pt-16 lg:pt-20 pb-20 lg:pb-24 text-[#11182F] overflow-visible">
        {/* Core Product Showcase Canvas (Pale Lavender, extending seamlessly) */}
        <div className="product-base-field absolute inset-0 -bottom-16 -z-20" />

        {/* ===================================================
            PART 1: TOP ATMOSPHERIC SEAMLESS CLOUD BLEND (Hero -> Products)
            Organic cloud formation: 9 distinct, asymmetric, overlapping cloud masses.
            Light background (#F8F6FF, #FFFFFF, #EDE8FF) rises into the dark Hero sky,
            eating away the darkness irregularly with soft, blurred cloud summits.
            Zero horizontal line. Zero dark rectangular smudge. Zero banding.
        =================================================== */}
        <div className="hero-to-products-ribbons absolute -top-16 sm:-top-20 inset-x-0 h-[280px] pointer-events-none overflow-visible z-[1]">
          {/* Cloud 1: High Left Giant Cloud Tower (reaches into Hero under 'Endless Sales') */}
          <div className="absolute top-0 -left-10 w-[760px] h-[260px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,1)_0%,_rgba(243,240,255,0.96)_40%,_rgba(233,227,255,0.7)_65%,_transparent_82%)] blur-[50px]" />

          {/* Cloud 2: High Right Giant Cloud Tower (reaches into Hero under delivery truck) */}
          <div className="absolute top-2 -right-10 w-[780px] h-[270px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,1)_0%,_rgba(243,240,255,0.96)_40%,_rgba(225,215,255,0.7)_65%,_transparent_82%)] blur-[50px]" />

          {/* Cloud 3: Mid-Left Billowing Cloud Puff */}
          <div className="absolute top-4 left-[12%] w-[620px] h-[230px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(248,246,255,1)_0%,_rgba(238,232,255,0.92)_45%,_rgba(216,196,255,0.55)_70%,_transparent_84%)] blur-[42px]" />

          {/* Cloud 4: Mid-Right Billowing Cloud Puff */}
          <div className="absolute top-4 right-[12%] w-[640px] h-[240px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,1)_0%,_rgba(240,235,255,0.94)_45%,_rgba(216,196,255,0.55)_70%,_transparent_84%)] blur-[42px]" />

          {/* Cloud 5: Center-Left Soft Swell */}
          <div className="absolute top-12 left-[26%] w-[520px] h-[190px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,1)_0%,_rgba(248,246,255,0.95)_45%,_rgba(233,227,255,0.65)_65%,_transparent_80%)] blur-[35px]" />

          {/* Cloud 6: Center-Right Soft Swell */}
          <div className="absolute top-12 right-[24%] w-[500px] h-[190px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,1)_0%,_rgba(248,246,255,0.95)_45%,_rgba(233,227,255,0.65)_65%,_transparent_80%)] blur-[35px]" />

          {/* Cloud 7: Center Dip Cushion (safely below trust badges) */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[640px] h-[170px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,0.98)_0%,_rgba(243,240,255,0.9)_45%,_rgba(221,211,255,0.5)_70%,_transparent_85%)] blur-[35px]" />

          {/* Cloud 8: Luminous Violet Cloud Fringe (atmospheric rim light along cloud summits) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1500px] h-[220px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(167,131,255,0.2)_0%,_rgba(139,92,255,0.08)_45%,_transparent_75%)] blur-[60px]" />

          {/* Cloud 9: Broad Merging Foundation Floor (fusing all clouds seamlessly into #F8F6FF) */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[1920px] h-[220px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(248,246,255,1)_0%,_rgba(248,246,255,1)_55%,_rgba(248,246,255,0.92)_75%,_transparent_95%)] blur-[30px]" />
        </div>

        {/* Atmospheric Violet Radial Glows Behind Product Showcases (Connected to hero palette) */}
        <div className="absolute top-[22%] -left-20 w-[640px] h-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(137,80,247,0.06)_0%,_transparent_70%)] blur-[90px] pointer-events-none" />
        <div className="absolute top-[54%] -right-20 w-[640px] h-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(167,121,255,0.06)_0%,_transparent_70%)] blur-[90px] pointer-events-none" />
        <svg
          aria-hidden="true"
          className="ambient-flow ambient-flow-products"
          viewBox="0 0 1600 1100"
          preserveAspectRatio="none"
        >
          <path d="M-120 300 C 280 80, 510 520, 890 320 S 1370 80, 1740 370" />
          <path d="M-160 850 C 240 620, 620 1040, 1040 760 S 1450 560, 1710 760" />
        </svg>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex justify-center mb-8 lg:mb-10">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#11182F] leading-tight">
                Two powerful tools.
                <br />
                One unified platform.
              </h2>
            </div>
          </div>

          {/* Product 1: AI Chatbot (Visual Left, Copy Right) */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-10 lg:mb-12">
            {/* Visual: Realistic Large Commerce Chat Showcase */}
            <div className="product-showcase-frame order-2 lg:order-1 relative w-full rounded-[32px] bg-white border border-slate-200/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] overflow-hidden p-4 sm:p-7 flex flex-col">
              <div className="w-full bg-[#0a0a18] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                {/* Chat Header */}
                <div className="h-14 bg-[#121224] border-b border-white/10 flex items-center justify-between px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-[14px] text-white">
                        SellPilot AI
                      </div>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        ● Replies in &lt; 1s
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                      Messenger
                    </span>
                    <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      WhatsApp
                    </span>
                  </div>
                </div>

                {/* Conversation Flow */}
                <div className="p-5 flex flex-col gap-3.5 bg-[#0a0a18]">
                  {/* Customer Question */}
                  <div className="self-end bg-violet-600 text-white p-3 rounded-2xl rounded-tr-sm text-[13px] shadow-sm max-w-[85%]">
                    Do you have a reliable HDMI cable for my monitor setup?
                  </div>

                  {/* AI Response with Product */}
                  <div className="self-start bg-[#141428] text-slate-200 p-3.5 rounded-2xl rounded-tl-sm text-[13px] border border-white/10 shadow-sm max-w-[90%]">
                    <div className="mb-2.5">
                      Yes — DigitRoss has a 3-meter HDMI cable ready to order:
                    </div>

                    {/* Realistic Product Card */}
                    <div className="bg-[#1a1b32] rounded-xl overflow-hidden border border-white/10 p-3 flex gap-3.5 items-center">
                      <div
                        role="img"
                        aria-label="HDMI to HDMI cable from DigitRoss"
                        className="w-20 h-16 bg-white rounded-lg shrink-0 border border-white/10 bg-center bg-contain bg-no-repeat"
                        style={{
                          backgroundImage:
                            "url('https://res.cloudinary.com/dnqggfhe1/image/upload/v1780681750/products/d0c4nvepuqrttlbp0okt.webp')",
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-bold text-white text-[13px]">
                          HDMI to HDMI Cable
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">
                          In Stock • 3 meter
                        </div>
                        <div className="text-violet-400 font-bold text-[13px] mt-0.5">
                          ৳550
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Order Request */}
                  <div className="self-end bg-violet-600 text-white p-3 rounded-2xl rounded-tr-sm text-[13px] shadow-sm max-w-[85%]">
                    Great! Send it to House 12, Road 4, Dhanmondi, Dhaka.
                  </div>

                  {/* AI Order Confirmation */}
                  <div className="self-start bg-[#141428] text-slate-200 p-3 rounded-2xl rounded-tl-sm text-[13px] border border-emerald-500/30 shadow-sm max-w-[90%] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold text-white">
                        Order Confirmed!
                      </span>{" "}
                      Order{" "}
                      <span className="text-violet-400 font-semibold">
                        #SP7892
                      </span>{" "}
                      is being packed for Dhanmondi, Dhaka. 🚚
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Copy: AI Chatbot */}
            <div className="order-1 lg:order-2 flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-bold uppercase tracking-wider mb-5">
                Product 1 · Sales automation
              </div>
              <h3 className="text-4xl sm:text-5xl font-extrabold mb-5 tracking-tight text-[#11182F]">
                AI Chatbot
              </h3>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
                Turn conversations into customers. Our AI understands context,
                recommends the perfect products, and handles the entire checkout
                flow automatically inside the chat.
              </p>
              <Link
                href="/products/ai-chatbot"
                className="group inline-flex items-center gap-2 text-violet-700 font-bold text-lg hover:text-violet-900 transition-colors"
              >
                <span>Explore AI Chatbot</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Product 2: Store Builder (Copy Left, Visual Right) */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            {/* Copy: Store Builder */}
            <div className="flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider mb-5">
                Product 2 · Live storefront
              </div>
              <h3 className="text-4xl sm:text-5xl font-extrabold mb-5 tracking-tight text-[#11182F]">
                Store Builder
              </h3>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-lg">
                Launch your online store without the technical headache.
                Beautiful, fast, and seamlessly connected to your AI sales agent
                for synchronized inventory and operations.
              </p>
              <Link
                href="/products/store-builder"
                className="group inline-flex items-center gap-2 text-blue-700 font-bold text-lg hover:text-blue-900 transition-colors"
              >
                <span>Explore Store Builder</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://digitross.b2roll.com/"
                target="_blank"
                rel="noreferrer"
                className="mt-4 text-sm font-semibold text-slate-500 hover:text-violet-700 transition-colors"
              >
                Live B2Roll example: DigitRoss ↗
              </a>
            </div>

            {/* Visual: Real Fictional Storefront Mockup inside Browser Window */}
            <div className="product-showcase-frame product-showcase-frame-right relative w-full rounded-[32px] bg-white border border-slate-200/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] overflow-hidden p-4 sm:p-7 flex flex-col">
              <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                {/* Browser Top Chrome */}
                <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mx-auto w-[65%] h-6 bg-white border border-slate-200 rounded-md text-[11px] flex items-center justify-center text-slate-500 gap-1.5 shadow-xs">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    <span>digitross.b2roll.com</span>
                  </div>
                  <div className="w-10" />
                </div>

                {/* Storefront Navigation */}
                <div className="h-12 border-b border-slate-100 flex items-center justify-between px-5 bg-white">
                  <div className="font-extrabold text-[13px] tracking-wider text-slate-900">
                    DIGITROSS
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-[11px] font-medium text-slate-600">
                    <span className="text-slate-900 font-semibold">Home</span>
                    <span>Tech accessories</span>
                    <span>Smart devices</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative p-1.5 rounded-full bg-slate-100 text-slate-700">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                        2
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hero Banner inside Storefront */}
                <div className="h-20 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white m-3.5 rounded-xl flex items-center justify-between px-5 relative overflow-hidden shadow-inner">
                  <div>
                    <div className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">
                      DigitRoss essentials
                    </div>
                    <div className="text-[14px] font-bold">
                      Tech that works for you
                    </div>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-full font-semibold">
                    Shop Now →
                  </span>
                </div>

                {/* 4-Item Real Product Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-3.5 pb-4">
                  {/* Real product data from the deployed DigitRoss B2Roll store. */}
                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 flex flex-col">
                    <div
                      role="img"
                      aria-label="HDMI to HDMI cable"
                      className="h-20 bg-white rounded-lg mb-2 border border-slate-100 shadow-2xs bg-center bg-contain bg-no-repeat"
                      style={{
                        backgroundImage:
                          "url('https://res.cloudinary.com/dnqggfhe1/image/upload/v1780681750/products/d0c4nvepuqrttlbp0okt.webp')",
                      }}
                    />
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      HDMI Cable 3M
                    </div>
                    <div className="text-[11px] font-bold text-violet-600 mt-0.5">
                      ৳550
                    </div>
                    <button className="mt-2 w-full py-1 text-[10px] font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors">
                      Add to Cart
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 flex flex-col">
                    <div className="h-20 bg-white rounded-lg flex items-center justify-center p-2 mb-2 border border-slate-100 shadow-2xs">
                      <Lock className="h-10 w-10 text-slate-700" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      3-in-1 USB-C Hub
                    </div>
                    <div className="text-[11px] font-bold text-violet-600 mt-0.5">
                      ৳700
                    </div>
                    <button className="mt-2 w-full py-1 text-[10px] font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors">
                      Add to Cart
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 flex flex-col">
                    <div className="h-20 bg-white rounded-lg flex items-center justify-center p-2 mb-2 border border-slate-100 shadow-2xs">
                      <Battery className="h-10 w-10 text-slate-700" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      RB40 Battery
                    </div>
                    <div className="text-[11px] font-bold text-violet-600 mt-0.5">
                      ৳1,250
                    </div>
                    <button className="mt-2 w-full py-1 text-[10px] font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors">
                      Add to Cart
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 flex flex-col">
                    <div className="h-20 bg-white rounded-lg flex items-center justify-center p-2 mb-2 border border-slate-100 shadow-2xs">
                      <Wifi className="h-10 w-10 text-slate-700" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      WiFi 6 USB Dongle
                    </div>
                    <div className="text-[11px] font-bold text-violet-600 mt-0.5">
                      ৳960
                    </div>
                    <button className="mt-2 w-full py-1 text-[10px] font-bold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors">
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Badge: Store Live */}
              <div className="absolute right-4 -bottom-3 bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 z-20 border-2 border-white">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Store Live ✓
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          SECTION 3: TEST AI
          Organic atmospheric transition: Deep cosmic navy and rich violet atmosphere
          enters the pale lavender canvas organically from below through 9 cloud formations.
          Zero linear gradient strip. Zero rectangular cut. Zero card obscuration.
      =================================================== */}
      <section className="test-atmosphere relative z-20 pt-16 lg:pt-20 pb-12 lg:pb-14 overflow-visible text-center">
        {/* Solid Dark Cosmic Navy Canvas covering Test AI content area with feathered top mask */}
        <div
          className="absolute inset-x-0 bottom-0 top-[75px] -z-10"
          style={{
            background: "linear-gradient(180deg, #08091C 0%, #070617 100%)",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 80px)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 80px)",
          }}
        />

        {/* ===================================================
            PART 2: TEST AI TOP ORGANIC CLOUD BLEND (Products -> Test AI)
            9 distinct, asymmetric, overlapping dark violet and cosmic navy cloud lobes
            rising up into the pale lavender space below Store Builder.
            Irregular contour: peaks on right and left flanks, soft dip in center.
        =================================================== */}
        <div className="products-to-test-ribbons absolute -top-32 sm:-top-36 inset-x-0 h-[380px] pointer-events-none overflow-visible -z-10">
          {/* Lobe 1: Soft Atmospheric Purple Haze blooming highest into light area */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1600px] h-[220px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(167,121,255,0.2)_0%,_rgba(137,80,247,0.1)_45%,_transparent_75%)] blur-[70px]" />

          {/* Lobe 2: High-rising Right Violet Cloud Puff (away from cards) */}
          <div className="absolute top-4 -right-10 w-[780px] h-[280px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(20,10,55,0.92)_0%,_rgba(74,28,184,0.75)_45%,_rgba(113,56,232,0.4)_65%,_transparent_80%)] blur-[50px]" />

          {/* Lobe 3: High-rising Left Violet Cloud Puff (away from cards) */}
          <div className="absolute top-8 -left-10 w-[740px] h-[270px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(20,10,55,0.92)_0%,_rgba(74,28,184,0.75)_45%,_rgba(113,56,232,0.4)_65%,_transparent_80%)] blur-[50px]" />

          {/* Lobe 4: Mid-Right Soft Violet Swell */}
          <div className="absolute top-16 right-[16%] w-[660px] h-[240px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(25,12,65,0.95)_0%,_rgba(91,33,182,0.7)_45%,_rgba(137,80,247,0.35)_70%,_transparent_82%)] blur-[45px]" />

          {/* Lobe 5: Mid-Left Soft Violet Swell */}
          <div className="absolute top-20 left-[16%] w-[640px] h-[230px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(25,12,65,0.95)_0%,_rgba(91,33,182,0.7)_45%,_rgba(137,80,247,0.35)_70%,_transparent_82%)] blur-[45px]" />

          {/* Lobe 6: Center Dip Cushion (safely below Store Builder card) */}
          <div className="absolute top-28 left-1/2 -translate-x-1/2 w-[660px] h-[210px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(16,8,44,0.96)_0%,_rgba(43,18,106,0.85)_45%,_rgba(87,37,199,0.4)_65%,_transparent_80%)] blur-[42px]" />

          {/* Lobe 7: Deep Violet-Navy Foundation Left */}
          <div className="absolute top-36 -left-12 w-[840px] h-[240px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(8,9,28,0.98)_0%,_rgba(20,10,55,0.9)_50%,_transparent_75%)] blur-[40px]" />

          {/* Lobe 8: Deep Violet-Navy Foundation Right */}
          <div className="absolute top-36 -right-12 w-[860px] h-[240px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(8,9,28,0.98)_0%,_rgba(20,10,55,0.9)_50%,_transparent_75%)] blur-[40px]" />

          {/* Lobe 9: Seamless Full-Width Merging Base (fusing lobes into solid #08091C) */}
          <div className="absolute top-44 left-1/2 -translate-x-1/2 w-[1920px] h-[240px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(8,9,28,1)_0%,_rgba(8,9,28,1)_55%,_rgba(8,9,28,0.9)_75%,_transparent_95%)] blur-[32px]" />
        </div>

        {/* Top ambient violet halo catching incoming atmospheric light */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[1100px] h-[180px] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(113,56,232,0.25)_0%,_rgba(87,37,199,0.1)_45%,_transparent_70%)] blur-[55px] pointer-events-none -z-10" />

        {/* Atmospheric Glow inside Test AI */}
        <div className="absolute inset-0 top-[75px] bg-[radial-gradient(ellipse_at_top,_rgba(113,56,232,0.18)_0%,_#08091C_60%,_#070617_100%)] pointer-events-none -z-10" />
        <svg
          aria-hidden="true"
          className="ambient-flow ambient-flow-test"
          viewBox="0 0 1600 420"
          preserveAspectRatio="none"
        >
          <path d="M-120 250 C 260 40, 590 370, 930 180 S 1390 20, 1710 210" />
          <path d="M-160 335 C 210 130, 600 470, 1020 230 S 1480 120, 1740 300" />
        </svg>

        <div className="max-w-[800px] mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 tracking-tight text-white leading-tight">
            Don&apos;t take our word for it.
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              Talk to the AI.
            </span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-slate-300 mb-6 max-w-xl mx-auto leading-relaxed">
            Experience firsthand how SellPilot handles inquiries, recommends
            products, and seamlessly takes orders in real-time.
          </p>
          <Link
            href="/test-ai"
            className="inline-flex items-center gap-2.5 bg-white text-slate-900 px-7 py-3.5 rounded-full font-bold text-base hover:bg-slate-100 hover:scale-105 transition-all shadow-[0_0_35px_rgba(255,255,255,0.18)]"
          >
            <span>Try AI Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

// Mini component for simulating the phone chat loop with stable keys and instant reference fullness
function PhoneChatSimulation() {
  const [step, setStep] = useState(1);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const runSequence = async () => {
      await new Promise((r) => setTimeout(r, 1600));
      if (!active) return;
      setStep(2); // AI typing
      await new Promise((r) => setTimeout(r, 1400));
      if (!active) return;
      setStep(3); // AI replies + product
      await new Promise((r) => setTimeout(r, 2600));
      if (!active) return;
      setStep(4); // User accepts
      await new Promise((r) => setTimeout(r, 1400));
      if (!active) return;
      setStep(5); // AI asks address
      await new Promise((r) => setTimeout(r, 2200));
      if (!active) return;
      setStep(6); // Customer gives address
      await new Promise((r) => setTimeout(r, 1400));
      if (!active) return;
      setStep(7); // AI confirms with Order card
      await new Promise((r) => setTimeout(r, 6500));
      if (!active) return;
      setStep(1);
      runSequence(); // Loop
    };
    runSequence();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const frame = requestAnimationFrame(() => {
      conversation.scrollTo({
        top: step === 1 ? 0 : conversation.scrollHeight,
        behavior: step <= 2 ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  return (
    <div
      ref={conversationRef}
      className="phone-conversation flex-1 p-2.5 sm:p-3 flex flex-col gap-2 overflow-y-auto overflow-x-hidden relative z-10"
    >
      <AnimatePresence mode="popLayout">
        {/* Step 1: Customer Question */}
        {step >= 1 && (
          <motion.div
            key="customer-question"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="self-end flex items-start gap-1 max-w-[88%]"
          >
            <div className="flex flex-col items-end">
              <div className="bg-[#EBF0F7] text-slate-900 px-2.5 py-1 rounded-2xl rounded-tr-xs text-[11px] font-medium shadow-2xs">
                Hi! Do you have this in size 42?
              </div>
              <span className="text-[8px] text-slate-400 mt-0.5 mr-1">
                10:30 AM
              </span>
            </div>
            <div className="w-4.5 h-4.5 rounded-full bg-slate-300 overflow-hidden shrink-0 mt-0.5 border border-slate-200 flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-slate-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M12 14c-4.42 0-8 2-8 5v1h16v-1c0-3-3.58-5-8-5z" />
              </svg>
            </div>
          </motion.div>
        )}

        {/* Step 2: AI Typing Indicator */}
        {step === 2 && (
          <motion.div
            key="ai-typing"
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="self-start flex items-center gap-1 mt-0.5"
          >
            <div className="w-4.5 h-4.5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[8px] shrink-0 shadow-2xs">
              <ShoppingBag className="w-2.5 h-2.5" />
            </div>
            <div className="bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-2xl rounded-tl-xs text-[10px] shadow-2xs flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" />
              <span
                className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: AI Product Recommendation */}
        {step >= 3 && (
          <motion.div
            key="ai-product-response"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="self-start flex flex-col gap-1 max-w-[92%] mt-0.5 ml-0"
          >
            <div className="bg-gradient-to-r from-[#6C3BFF] to-[#8B5CF6] text-white px-2.5 py-1.5 rounded-2xl rounded-tl-xs text-[11px] shadow-xs leading-snug">
              <div className="font-semibold flex items-center justify-between">
                <span>Yes! Size 42 is available ✓</span>
              </div>
              <div className="flex justify-between items-center text-white/90 text-[10px] mt-0.5">
                <span>
                  Price:{" "}
                  <strong className="text-white font-bold">৳1,490</strong>
                </span>
                <span className="text-[8px] text-white/70">10:30 AM ✓✓</span>
              </div>
            </div>

            {/* Attached Sneaker Product Card */}
            <div className="bg-white rounded-xl overflow-hidden border border-slate-200/90 shadow-2xs">
              <div className="h-16 bg-slate-50 flex items-center justify-center p-1 relative">
                <Image
                  src="/images/sellpilot-performance-sneaker.png"
                  alt="Black, white and violet performance sneaker"
                  width={1536}
                  height={1024}
                  className="w-[72%] h-auto object-contain drop-shadow-sm"
                />
              </div>
              <div className="p-1 text-center bg-white border-t border-slate-100">
                <button
                  type="button"
                  className="w-full text-[9.5px] font-bold text-violet-700 bg-violet-50/90 hover:bg-violet-100 py-0.5 rounded-md border border-violet-200/60 transition-colors"
                >
                  View Product
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4: Customer Accept */}
        {step >= 4 && (
          <motion.div
            key="customer-accept"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="self-end flex items-start gap-1 max-w-[88%] mt-0.5"
          >
            <div className="flex flex-col items-end">
              <div className="bg-[#EBF0F7] text-slate-900 px-2.5 py-1 rounded-2xl rounded-tr-xs text-[11px] font-medium shadow-2xs">
                Great! I&apos;ll take it.
              </div>
              <span className="text-[8px] text-slate-400 mt-0.5 mr-1">
                10:31 AM
              </span>
            </div>
            <div className="w-4.5 h-4.5 rounded-full bg-slate-300 overflow-hidden shrink-0 mt-0.5 border border-slate-200 flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-slate-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M12 14c-4.42 0-8 2-8 5v1h16v-1c0-3-3.58-5-8-5z" />
              </svg>
            </div>
          </motion.div>
        )}

        {/* Step 5: AI Address Request */}
        {step >= 5 && (
          <motion.div
            key="ai-address-request"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="self-start flex items-start gap-1 max-w-[88%] mt-0.5"
          >
            <div className="w-4.5 h-4.5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[8px] shrink-0 mt-0.5 shadow-2xs">
              <ShoppingBag className="w-2.5 h-2.5" />
            </div>
            <div className="flex flex-col">
              <div className="bg-slate-100 border border-slate-200/80 text-slate-900 px-2.5 py-1 rounded-2xl rounded-tl-xs text-[11px] shadow-2xs">
                Sure! Please share your delivery address.
              </div>
              <span className="text-[8px] text-slate-400 mt-0.5 ml-1">
                10:31 AM
              </span>
            </div>
          </motion.div>
        )}

        {/* Step 6: customer shares the requested delivery detail. */}
        {step >= 6 && (
          <motion.div
            key="customer-address"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="self-end flex items-start gap-1 max-w-[90%] mt-0.5"
          >
            <div className="flex flex-col items-end">
              <div className="bg-[#EBF0F7] text-slate-900 px-2.5 py-1 rounded-2xl rounded-tr-xs text-[10.5px] font-medium shadow-2xs">
                House 12, Road 4, Dhanmondi, Dhaka.
              </div>
              <span className="text-[8px] text-slate-400 mt-0.5 mr-1">
                10:32 AM
              </span>
            </div>
            <div className="w-4.5 h-4.5 rounded-full bg-slate-300 overflow-hidden shrink-0 mt-0.5 border border-slate-200 flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-slate-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M12 14c-4.42 0-8 2-8 5v1h16v-1c0-3-3.58-5-8-5z" />
              </svg>
            </div>
          </motion.div>
        )}

        {/* Step 7: complete notification-style order confirmation. */}
        {step >= 7 && (
          <motion.div
            key="order-confirmation"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="self-start flex flex-col gap-0.5 w-full mt-0.5"
          >
            <div className="bg-white rounded-xl overflow-hidden border border-emerald-500/40 w-full shadow-2xs">
              <div className="px-2.5 py-1 border-b border-slate-100 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">🎉</span>
                  <span className="text-[10px] font-bold text-slate-900">
                    Order Confirmed
                  </span>
                </div>
                <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                  #SP7856
                </span>
              </div>
              <div className="px-2 py-1 text-[9px] text-slate-600 flex flex-col gap-0.5">
                <div>
                  <strong className="text-slate-800">৳1,490</strong> · Cash on
                  delivery
                </div>
                <div>Delivering to Dhanmondi, Dhaka</div>
                <div className="text-emerald-600 font-semibold text-[8px]">
                  ● Processing Delivery
                </div>
              </div>
              <div className="py-0.5 text-center text-[8.5px] font-bold text-violet-700 bg-violet-50/60 border-t border-slate-100 hover:bg-violet-100/60 transition-colors">
                Track Order →
              </div>
            </div>
            <span className="text-[7.5px] text-slate-400 ml-1">10:32 AM</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
