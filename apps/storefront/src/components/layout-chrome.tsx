"use client";

import { usePathname } from "next/navigation";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing";

export function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/signup" || pathname === "/signin" || pathname === "/login";

  return (
    <>
      {!isAuthPage && <MarketingNav key={pathname} />}
      {children}
      {!isAuthPage && <MarketingFooter />}
    </>
  );
}
