"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CHANNELS } from "@/lib/marketing-config";

export type Channel = keyof typeof CHANNELS;
export const CHANNEL_NAMES: Record<Channel, string> = {
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  website: "Website",
};
export const PRODUCT_IMAGE = "/images/sellpilot-performance-sneaker.png";
export const PREVIEW_EASE = [0.22, 1, 0.36, 1] as const;
export const PHONE_CYCLE = 10_800;
export const NOTIFICATION_CYCLE = 4_600;

export const PHONE_BEATS = {
  understand: 450,
  reply: 1_050,
  recommend: 1_650,
  intent: 2_500,
  details: 3_300,
  order: 4_200,
} as const;

export function getPhoneStage(time: number) {
  if (time >= PHONE_BEATS.order)
    return {
      key: "order",
      label: "Order started",
      detail: "The next sale is already in motion.",
    };
  if (time >= PHONE_BEATS.intent)
    return {
      key: "intent",
      label: "Guiding the order",
      detail: "From a question to a buying decision.",
    };
  if (time >= PHONE_BEATS.recommend)
    return {
      key: "recommend",
      label: "Product matched",
      detail: "The right item, price, and availability.",
    };
  if (time >= PHONE_BEATS.reply)
    return {
      key: "reply",
      label: "Reply sent",
      detail: "A helpful answer. In their language.",
    };
  if (time >= PHONE_BEATS.understand)
    return {
      key: "understand",
      label: "Checking your catalog",
      detail: "Understanding what the customer needs.",
    };
  return {
    key: "incoming",
    label: "New customer question",
    detail: "SellPilot is already on it.",
  };
}

export type CustomerInquiry = {
  name: string;
  channel: Channel;
  message: string;
  avatar: "sand" | "rose" | "sage" | "sky" | "lilac";
  image?: boolean;
};

// Each row is one pass across the six tracks. Every track changes platform
// on its next pass, and no two tracks reuse a customer's inquiry.
export const INQUIRIES: readonly CustomerInquiry[] = [
  {
    name: "Rafi",
    channel: "messenger",
    message: "Black t-shirt ta available?",
    avatar: "sand",
  },
  {
    name: "Nusrat",
    channel: "whatsapp",
    message: "Ei pant tar price koto?",
    avatar: "rose",
  },
  {
    name: "Website Visitor",
    channel: "website",
    message: "Ei product ta ache?",
    avatar: "sky",
    image: true,
  },
  { name: "Ayon", channel: "messenger", message: "Size L ase?", avatar: "sky" },
  {
    name: "Mahin",
    channel: "whatsapp",
    message: "COD available?",
    avatar: "sage",
  },
  {
    name: "Tasmia",
    channel: "website",
    message: "Delivery charge koto?",
    avatar: "lilac",
  },
  {
    name: "Mim",
    channel: "whatsapp",
    message: "Ei color ta ache?",
    avatar: "lilac",
  },
  {
    name: "Farhan",
    channel: "website",
    message: "Image er product ta ache?",
    avatar: "sand",
    image: true,
  },
  {
    name: "Sadia",
    channel: "messenger",
    message: "Order korte chai",
    avatar: "rose",
  },
  {
    name: "Sami",
    channel: "whatsapp",
    message: "Return policy ki?",
    avatar: "sky",
  },
  {
    name: "Riya",
    channel: "website",
    message: "Do you have this in red?",
    avatar: "rose",
  },
  {
    name: "Shuvo",
    channel: "messenger",
    message: "Navy blue ta ache?",
    avatar: "sage",
  },
  {
    name: "Imran",
    channel: "website",
    message: "Size 42 in stock?",
    avatar: "sky",
  },
  {
    name: "Fahim",
    channel: "messenger",
    message: "Order confirm korbo",
    avatar: "sage",
  },
  {
    name: "Arif",
    channel: "whatsapp",
    message: "Dhakar baire delivery?",
    avatar: "sand",
  },
  {
    name: "Sara",
    channel: "website",
    message: "Help me choose a size?",
    avatar: "rose",
  },
  {
    name: "Nabila",
    channel: "messenger",
    message: "Delivery kobe pabo?",
    avatar: "lilac",
  },
  {
    name: "Sumaiya",
    channel: "whatsapp",
    message: "Payment kivabe korbo?",
    avatar: "rose",
  },
];

export const NOTIFICATION_TRACKS = [
  { delay: 0, from: [-30, -14], to: [28, 12] },
  { delay: 0, from: [26, -20], to: [-24, 12] },
  { delay: 650, from: [-34, 12], to: [26, -10] },
  { delay: 1_250, from: [32, 8], to: [-26, -10] },
  { delay: 1_850, from: [-20, 24], to: [24, -18] },
  { delay: 2_450, from: [24, 24], to: [-24, -20] },
] as const;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

// One clock drives the phone, notifications, and status. Pausing or leaving
// the viewport freezes the story instead of jumping ahead when it resumes.
export function usePreviewClock(active: boolean) {
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  );
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || !visible) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(now - previous, 250);
      previous = now;
      setElapsed((value) => value + delta);
    }, 100);
    return () => window.clearInterval(timer);
  }, [active, visible]);

  return { elapsed, running: active && visible };
}
