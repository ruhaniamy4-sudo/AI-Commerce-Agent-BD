import type { Metadata } from "next"
import { Manrope, Noto_Sans_Bengali } from "next/font/google"
import "./globals.css"
import "./product-cleanup.css"
import { Providers } from "@/components/providers"
import { DashboardShell } from "@/components/layout/dashboard-shell"
const primaryFont = Manrope({ subsets: ["latin"], variable: "--font-primary", display: "swap" });
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
      <body className={`${primaryFont.variable} ${bengaliFont.variable}`}>
        <Providers>
          <DashboardShell>
            {children}
          </DashboardShell>
        </Providers>
      </body>
    </html>
  )
}
