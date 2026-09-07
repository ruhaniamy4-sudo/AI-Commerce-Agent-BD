import type { Metadata } from "next"
import { Manrope, DM_Sans, Noto_Sans_Bengali } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { DashboardShell } from "@/components/layout/dashboard-shell"
const displayFont = Manrope({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const bengaliFont = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bengali", display: "swap" });

export const metadata: Metadata = {
  title: "SellPilot Dashboard",
  description: "Manage your SellPilot commerce AI",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${bengaliFont.variable}`}>
        <Providers>
          <DashboardShell>
            {children}
          </DashboardShell>
        </Providers>
      </body>
    </html>
  )
}
