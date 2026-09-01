import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { DashboardShell } from "@/components/layout/dashboard-shell"

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
      <body>
        <Providers>
          <DashboardShell>
            {children}
          </DashboardShell>
        </Providers>
      </body>
    </html>
  )
}
