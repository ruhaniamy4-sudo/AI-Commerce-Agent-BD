"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
const links = [{ href: "/#product", label: "Product" }, { href: "/features", label: "Features" }, { href: "/solutions", label: "Solutions" }, { href: "/pricing", label: "Pricing" }, { href: "/demo", label: "Demo" }, { href: "/shop", label: "Shop" }];
export function MarketingNav() {
  const [open, setOpen] = useState(false); const pathname = usePathname();
  return <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl"><nav className="site-container flex h-18 items-center justify-between" aria-label="Main navigation">
    <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/25">D</span><span className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Digitross</span></Link>
    <div className="hidden items-center gap-7 lg:flex">{links.map((link) => <Link key={link.href} href={link.href} className={`text-sm font-medium transition-colors ${pathname === link.href ? "text-blue-600" : "text-slate-600 hover:text-slate-950"}`}>{link.label}</Link>)}</div>
    <div className="hidden items-center gap-3 lg:flex"><Link href="/demo" className="button-primary !min-h-10 !px-5 !py-2.5">Get started</Link></div>
    <button type="button" className="rounded-xl border border-slate-200 p-2.5 text-slate-700 lg:hidden" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
  </nav>{open && <div className="border-t border-slate-200 bg-white px-5 py-5 shadow-xl lg:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-1">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">{link.label}</Link>)}<div className="mt-3 border-t border-slate-100 pt-4"><Link href="/demo" onClick={() => setOpen(false)} className="button-primary w-full">Get started</Link></div></div></div>}</header>;
}
