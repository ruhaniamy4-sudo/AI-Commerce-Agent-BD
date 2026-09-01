"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { SessionProvider, signOut, useSession } from "next-auth/react"
import { useEffect } from "react"

import { ThemeProvider } from "next-themes"
import { AUTHENTICATION_REQUIRED_EVENT, setApiSession, shouldRetryQuery } from "@/lib/api-client"

function AuthSessionBridge() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status !== "loading") setApiSession(session)
    if (status === "authenticated" && session?.authError) void signOut({ callbackUrl: "/login" })
  }, [session, status])

  useEffect(() => {
    const handleAuthenticationRequired = () => {
      void signOut({ callbackUrl: "/login" })
    }
    window.addEventListener(AUTHENTICATION_REQUIRED_EVENT, handleAuthenticationRequired)
    return () => window.removeEventListener(AUTHENTICATION_REQUIRED_EVENT, handleAuthenticationRequired)
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
          },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      <SessionProvider refetchOnWindowFocus={false}>
        <AuthSessionBridge />
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
