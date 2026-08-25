export const BRAND = {
  name: "SellPilot",
  shortDescription: "AI commerce infrastructure for businesses that sell through conversations.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://sellpilot.app",
} as const;

export const CHANNELS = {
  messenger: "available",
  website: "available",
  whatsapp: "coming-soon",
} as const;

export const PRICING_PLANS = [
  {
    name: "Starter",
    label: "For focused pilots",
    price: "Early access",
    description: "Start with one clear customer-conversation workflow.",
    featured: false,
    features: ["Messenger or website chat", "Product and knowledge grounding", "Human takeover", "Usage visibility"],
  },
  {
    name: "Growth",
    label: "For growing teams",
    price: "Talk to us",
    description: "Connect conversations, customers, and order operations.",
    features: ["Everything in Starter", "Customer history and context", "Order workflow", "Team conversation controls"],
    featured: true,
  },
  {
    name: "Scale",
    label: "For complex operations",
    price: "Custom",
    description: "Scope multi-brand and higher-volume commerce safely.",
    featured: false,
    features: ["Everything in Growth", "Multi-business isolation", "AI cost controls", "Integration planning"],
  },
] as const;
