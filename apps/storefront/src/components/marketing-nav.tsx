"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitch, useLanguage } from "@/context/language-context";
import { BRAND } from "@/lib/marketing-config";

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { text } = useLanguage();
  const t = (en: string, bn: string) => text({ en, bn });
  const links = [
    { href: "/#product", label: t("Product", "প্রোডাক্ট") },
    { href: "/features", label: t("Features", "ফিচার") },
    { href: "/solutions", label: t("Solutions", "সমাধান") },
    { href: "/pricing", label: t("Pricing", "মূল্য") },
    { href: "/demo", label: t("Demo", "ডেমো") },
    { href: "/shop", label: t("Shop", "শপ") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`premium-nav ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="site-container flex h-[72px] items-center justify-between" aria-label="Main navigation">
        <Link href="/" className="brand-lockup" onClick={() => setOpen(false)}><span className="brand-mark">SP<span /></span><span>{BRAND.name}</span></Link>
        <div className="hidden items-center gap-1 lg:flex">{links.map(link => <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href || (link.href !== "/#product" && pathname.startsWith(link.href)) ? "is-active" : ""}`}>{link.label}</Link>)}</div>
        <div className="hidden items-center gap-2 lg:flex"><LanguageSwitch /><Link href="/signin" className="nav-signin">{t("Sign in", "সাইন ইন")}</Link><ThemeToggle compact /><Link href="/signup" className="button-primary !min-h-10 !rounded-xl !px-4 !py-2.5">{t("Get started", "শুরু করুন")} <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
        <div className="flex items-center gap-2 lg:hidden"><LanguageSwitch /><ThemeToggle compact /><button type="button" className="nav-icon-button" aria-label={open ? t("Close navigation", "Navigation বন্ধ করুন") : t("Open navigation", "Navigation খুলুন")} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
      </nav>
      <div className={`mobile-drawer lg:hidden ${open ? "is-open" : ""}`} aria-hidden={!open}><div className="site-container py-4">{links.map((link, index) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="mobile-nav-link" style={{ transitionDelay: open ? `${index * 35}ms` : "0ms" }}>{link.label}<ArrowUpRight className="h-4 w-4" /></Link>)}<div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10"><Link href="/signin" onClick={() => setOpen(false)} className="button-secondary">{t("Sign in", "সাইন ইন")}</Link><Link href="/signup" onClick={() => setOpen(false)} className="button-primary">{t("Get started", "শুরু করুন")}</Link></div></div></div>
    </header>
  );
}
