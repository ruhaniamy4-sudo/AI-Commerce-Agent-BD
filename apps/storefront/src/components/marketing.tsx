import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Sparkles } from "lucide-react";

export function SectionHeading({ eyebrow, title, copy, center = false }: { eyebrow: string; title: string; copy?: string; center?: boolean }) {
  return <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className="section-kicker">{eyebrow}</p><h2 className="section-title mt-4">{title}</h2>{copy && <p className="section-copy mt-5">{copy}</p>}</div>;
}

export function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="hero-grid relative overflow-hidden py-20 sm:py-28 lg:py-32"><div className="aurora aurora-blue left-[18%] top-[-12rem]" /><div className="aurora aurora-violet right-[12%] top-[-14rem]" /><div className="site-container relative mx-auto max-w-4xl text-center reveal-up"><div className="eyebrow mb-7"><Sparkles className="h-3.5 w-3.5" />{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-copy mx-auto mt-6 max-w-3xl">{copy}</p></div></section>;
}

export function FinalCTA({ title = "Ready to turn conversations into revenue?", copy = "Bring AI and your team into one commerce workflow—built for the way Bangladesh businesses sell." }: { title?: string; copy?: string }) {
  return <section className="site-container py-20 sm:py-28"><div className="cta-panel"><div className="cta-grid" /><div className="aurora aurora-blue -bottom-32 left-[10%]" /><div className="aurora aurora-violet -right-20 -top-32" /><div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]"><div><p className="section-kicker !text-cyan-300">Build the next conversation</p><h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">{title}</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{copy}</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/demo" className="button-primary !bg-white !text-slate-950 !shadow-white/10 hover:!bg-blue-50">Get started <ArrowRight className="h-4 w-4" /></Link><Link href="/demo" className="button-glass">Book a demo <ArrowUpRight className="h-4 w-4" /></Link></div></div></div></section>;
}

const footerColumns = [
  { title: "Product", links: [{ href: "/features", label: "Features" }, { href: "/#workflow", label: "How it works" }, { href: "/features#channels", label: "Integrations" }, { href: "/pricing", label: "Pricing" }, { href: "/features#coming-soon", label: "Roadmap" }] },
  { title: "Solutions", links: [{ href: "/solutions#facebook-sellers", label: "Facebook sellers" }, { href: "/solutions#ecommerce", label: "Ecommerce" }, { href: "/solutions#support-teams", label: "Support teams" }, { href: "/solutions#multi-brand", label: "Multi-brand" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/demo", label: "Contact" }, { href: "/demo", label: "Demo" }] },
];

export function MarketingFooter() {
  return <footer className="premium-footer"><div className="footer-glow" /><div className="footer-grid" /><div className="site-container relative"><div className="grid gap-12 py-16 lg:grid-cols-[1.35fr_repeat(4,.65fr)] lg:py-20"><div><Link href="/" className="brand-lockup text-white"><span className="brand-mark">D<span /></span><span>Digitross</span></Link><p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">AI commerce infrastructure for businesses that sell through conversations.</p><Link href="/demo" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-cyan-300">Join early access <ArrowRight className="h-4 w-4" /></Link></div>{footerColumns.map(column => <div key={column.title}><p className="footer-heading">{column.title}</p><div className="mt-5 space-y-3">{column.links.map(link => <Link key={link.href + link.label} href={link.href} className="footer-link">{link.label}</Link>)}</div></div>)}<div><p className="footer-heading">Resources</p><div className="mt-5 space-y-3"><span className="footer-muted">Documentation <small>Soon</small></span><span className="footer-muted">Help center <small>Soon</small></span><span className="footer-muted">API <small>Soon</small></span></div></div></div><div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Digitross. All rights reserved.</p><div className="flex flex-wrap items-center gap-4"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Built for Bangladesh</span><span>WhatsApp + courier integrations coming soon</span></div></div></div></footer>;
}
