import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ eyebrow, title, copy, center = false }: { eyebrow: string; title: string; copy?: string; center?: boolean }) {
  return <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className="section-kicker">{eyebrow}</p><h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">{title}</h2>{copy && <p className="mt-5 text-lg leading-8 text-slate-600">{copy}</p>}</div>;
}

export function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="hero-grid relative overflow-hidden py-20 sm:py-28"><div className="glow-orb left-1/2 top-0 h-72 w-72 bg-blue-300/20" /><div className="site-container relative mx-auto max-w-4xl text-center reveal-up"><div className="eyebrow mb-6">{eyebrow}</div><h1 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.045em] text-slate-950 sm:text-6xl">{title}</h1><p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">{copy}</p></div></section>;
}

export function FinalCTA({ title = "Ready to turn conversations into growth?", copy = "See how Digitross can fit your commerce operation." }: { title?: string; copy?: string }) {
  return <section className="site-container py-20 sm:py-28"><div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-center shadow-2xl shadow-blue-950/20 sm:px-12 sm:py-20"><div className="glow-orb left-1/2 top-0 h-64 w-64 -translate-x-1/2 bg-blue-500/30" /><div className="relative"><p className="section-kicker !text-blue-300">Early access</p><h2 className="mx-auto mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{title}</h2><p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">{copy}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/demo" className="button-primary">Request a demo <ArrowRight className="h-4 w-4" /></Link><Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10">View plans</Link></div></div></div></section>;
}

export function MarketingFooter() {
  const links = [{ href: "/features", label: "Features" }, { href: "/solutions", label: "Solutions" }, { href: "/pricing", label: "Pricing" }, { href: "/demo", label: "Demo" }, { href: "/shop", label: "Shop" }];
  return <footer className="border-t border-slate-200 bg-slate-50"><div className="site-container grid gap-10 py-12 md:grid-cols-[1fr_auto]"><div><Link href="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-sm font-bold text-white">D</span><span className="text-lg font-semibold text-slate-950">Digitross</span></Link><p className="mt-4 max-w-md text-sm leading-6 text-slate-500">AI commerce infrastructure for Bangladesh businesses—built around the conversations that drive sales.</p></div><div className="flex flex-wrap items-start gap-x-7 gap-y-3">{links.map(link => <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-blue-600">{link.label}</Link>)}</div></div><div className="border-t border-slate-200"><div className="site-container flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Digitross. Bangladesh.</p><p>WhatsApp and courier integrations are coming soon.</p></div></div></footer>;
}
