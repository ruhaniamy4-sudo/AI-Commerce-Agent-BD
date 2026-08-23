import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://digitross.com"),
  title: { default: "Digitross — AI Commerce Agent for Bangladesh", template: "%s | Digitross" },
  description: "Turn customer conversations into sales with an AI commerce agent built for businesses in Bangladesh.",
  openGraph: {
    title: "Digitross — AI Commerce Agent for Bangladesh",
    description: "Turn customer conversations into revenue with AI commerce infrastructure built for Bangladesh.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Digitross AI Commerce Agent for Bangladesh" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Digitross — AI Commerce Agent for Bangladesh",
    description: "Turn customer conversations into revenue.",
    images: ["/og.png"],
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${inter.variable} bg-white text-slate-950 antialiased`}><CartProvider><MarketingNav />{children}<MarketingFooter /></CartProvider></body></html>;
}
