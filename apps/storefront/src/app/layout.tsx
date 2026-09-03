import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing";
import { LanguageProvider, type Locale } from "@/context/language-context";
import { BRAND } from "@/lib/marketing-config";
import { headers } from "next/headers";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: "SellPilot — AI Sales Agent for Bangladesh Commerce", template: "%s | SellPilot" },
  description: "Turn Messenger and website conversations into organized sales workflows with SellPilot, an AI commerce agent built for Bangladesh.",
  openGraph: {
    title: "SellPilot — AI Sales Agent for Bangladesh Commerce",
    description: "AI sales conversations, products, customers, orders, and human control in one Bangladesh-first commerce workflow.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SellPilot — AI Sales Agent for Bangladesh Commerce",
    description: "Turn customer conversations into organized sales workflows.",
  },
};
const themeScript = `(function(){try{var saved=localStorage.getItem('sellpilot-theme')||localStorage.getItem('digitross-theme');var dark=saved?saved==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light'}catch(e){}})()`;
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const country = (requestHeaders.get("x-vercel-ip-country") || requestHeaders.get("cf-ipcountry") || "").toUpperCase();
  const detectedLocale: Locale = country === "BD" ? "bn" : "en";
  return <html lang={detectedLocale === "bn" ? "bn-BD" : "en"} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body className="antialiased"><LanguageProvider detectedLocale={detectedLocale}><CartProvider><MarketingNav />{children}<MarketingFooter /></CartProvider></LanguageProvider><SpeedInsights /></body></html>;
}
