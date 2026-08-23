"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
  { href: "/shop", label: "Shop" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`premium-nav ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="site-container flex h-[72px] items-center justify-between" aria-label="Main navigation">
        <Link href="/" className="brand-lockup" onClick={() => setOpen(false)}><span className="brand-mark">D<span /></span><span>Digitross</span></Link>
        <div className="hidden items-center gap-1 lg:flex">{links.map(link => <Link key={link.href} href={link.href} className={`nav-link ${pathname === link.href || (link.href !== "/#product" && pathname.startsWith(link.href)) ? "is-active" : ""}`}>{link.label}</Link>)}</div>
        <div className="hidden items-center gap-2 lg:flex"><Link href="/signin" className="nav-signin">Sign in</Link><ThemeToggle compact /><Link href="/demo" className="button-primary !min-h-10 !rounded-xl !px-4 !py-2.5">Get started <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
        <div className="flex items-center gap-2 lg:hidden"><ThemeToggle compact /><button type="button" className="nav-icon-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
      </nav>
      <div className={`mobile-drawer lg:hidden ${open ? "is-open" : ""}`} aria-hidden={!open}><div className="site-container py-4">{links.map((link, index) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="mobile-nav-link" style={{ transitionDelay: open ? `${index * 35}ms` : "0ms" }}>{link.label}<ArrowUpRight className="h-4 w-4" /></Link>)}<div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10"><Link href="/signin" onClick={() => setOpen(false)} className="button-secondary">Sign in</Link><Link href="/demo" onClick={() => setOpen(false)} className="button-primary">Get started</Link></div></div></div>
    </header>
  );
}
