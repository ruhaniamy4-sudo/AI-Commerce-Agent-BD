import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { DashboardShell } from "@/components/layout/dashboard-shell"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <Providers>
          <DashboardShell>
            {children}
          </DashboardShell>
        </Providers>
      </body>
    </html>
  )
}
