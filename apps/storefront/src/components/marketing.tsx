"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import { LanguageSwitch, useLanguage } from "@/context/language-context";
import { BRAND } from "@/lib/marketing-config";

export function SectionHeading({ eyebrow, title, copy, center = false }: { eyebrow: string; title: string; copy?: string; center?: boolean }) {
  return <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className="section-kicker">{eyebrow}</p><h2 className="section-title mt-4">{title}</h2>{copy && <p className="section-copy mt-5">{copy}</p>}</div>;
}

export function PageHero({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  const { locale } = useLanguage();
  const localized: Record<string, [string,string,string]> = {
    "A commerce agent that understands when to talk—and when to act.": ["প্রোডাক্ট ফিচার","একটি commerce agent, যে জানে কখন কথা বলতে হবে—আর কখন action নিতে হবে।","SellPilot AI conversation, বাস্তব commerce context, team control ও cost visibility-কে একটি bounded workflow-তে যুক্ত করে।"],
    "A clearer path from customer question to commerce action.": ["বাস্তব operation-এর জন্য designed","Customer question থেকে commerce action পর্যন্ত আরও স্পষ্ট পথ।","SellPilot বাংলাদেশের ব্যবসা যেখানে ইতিমধ্যে বিক্রি করে সেখানেই কাজ শুরু করে—তারপর আনে দরকারি context, control ও isolation।"],
    "Start focused. Scale with proof.": ["Early-access plan","Focused ভাবে শুরু করুন। প্রমাণের সাথে scale করুন।","আজ আপনার rollout-এর উপযুক্ত ধরন বেছে নিন। Early access-এর পর চূড়ান্ত commercial pricing স্বচ্ছভাবে জানানো হবে।"],
    "Request an early-access walkthrough.": ["SellPilot-কে আপনার context-এ দেখুন","একটি early-access walkthrough request করুন।","কাস্টমার কীভাবে আপনার business-এর সাথে যোগাযোগ করে বলুন। আমরা আপনার বর্তমান sales ও support operation-এর ওপর demo focused রাখব।"],
    "Commerce AI should understand the business behind the conversation.": ["SellPilot সম্পর্কে","Commerce AI-কে কথোপকথনের পেছনের business বুঝতে হবে।","SellPilot তৈরি হচ্ছে বাংলাদেশের সেই টিমগুলোর জন্য, যারা message-এর মাধ্যমে বিক্রি করে এবং কথোপকথনের চারপাশে একটি dependable operating layer চায়।"],
  };
  const bn = localized[title];
  const shown = locale === "bn" && bn ? { eyebrow: bn[0], title: bn[1], copy: bn[2] } : { eyebrow, title, copy };
  return <section className="hero-grid relative overflow-hidden py-20 sm:py-28 lg:py-32"><div className="aurora aurora-blue left-[18%] top-[-12rem]" /><div className="aurora aurora-violet right-[12%] top-[-14rem]" /><div className="site-container relative mx-auto max-w-4xl text-center reveal-up"><div className="eyebrow mb-7"><Sparkles className="h-3.5 w-3.5" />{shown.eyebrow}</div><h1 className="page-title">{shown.title}</h1><p className="page-copy mx-auto mt-6 max-w-3xl">{shown.copy}</p></div></section>;
}

export function FinalCTA({ title = "Ready to turn conversations into revenue?", copy = "Bring AI and your team into one commerce workflow—built for the way Bangladesh businesses sell." }: { title?: string; copy?: string }) {
  const { text } = useLanguage();
  return <section className="site-container py-20 sm:py-28"><div className="cta-panel"><div className="cta-grid" /><div className="aurora aurora-blue -bottom-32 left-[10%]" /><div className="aurora aurora-violet -right-20 -top-32" /><div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]"><div><p className="section-kicker !text-cyan-300">{text({en:"Build the next conversation",bn:"পরের কথোপকথনটি তৈরি করুন"})}</p><h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">{title}</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{copy}</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="button-primary !bg-white !text-slate-950 !shadow-white/10 hover:!bg-blue-50">{text({en:"Start free",bn:"ফ্রি শুরু করুন"})} <ArrowRight className="h-4 w-4" /></Link><Link href="/demo" className="button-glass">{text({en:"Book a demo",bn:"Demo বুক করুন"})} <ArrowUpRight className="h-4 w-4" /></Link></div></div></div></section>;
}

export function MarketingFooter() {
  const { text } = useLanguage();
  const t = (en: string, bn: string) => text({ en, bn });
  const columns = [
    { title: t("Product","প্রোডাক্ট"), links: [["/features",t("Features","ফিচার")],["/#workflow",t("How it works","কীভাবে কাজ করে")],["/features#channels",t("Integrations","ইন্টিগ্রেশন")],["/pricing",t("Pricing","মূল্য")],["/demo",t("Demo","ডেমো")]] },
    { title: t("Solutions","সমাধান"), links: [["/solutions#facebook-sellers",t("Facebook sellers","Facebook seller")],["/solutions#ecommerce",t("Ecommerce","ইকমার্স")],["/solutions#support-teams",t("Support teams","Support team")],["/solutions#multi-brand",t("Multi-brand businesses","Multi-brand business")]] },
    { title: t("Company","কোম্পানি"), links: [["/about",t("About","আমাদের সম্পর্কে")],["/demo",t("Demo / Contact","Demo / Contact")],["/signin",t("Sign in","সাইন ইন")],["/signup",t("Get started","শুরু করুন")]] },
    { title: t("Resources","রিসোর্স"), links: [["/#faq",t("FAQ","সাধারণ প্রশ্ন")],["/shop",t("Shop demo","Shop demo")]] },
  ];
  return <footer className="premium-footer"><div className="footer-glow" /><div className="footer-grid" /><div className="site-container relative"><div className="footer-v2-main"><div><Link href="/" className="brand-lockup text-white"><span className="brand-mark">SP<span /></span><span>{BRAND.name}</span></Link><p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">{t(BRAND.shortDescription,"কথোপকথনের মাধ্যমে বিক্রি করা ব্যবসার জন্য AI commerce infrastructure।")}</p><div className="footer-capabilities"><span>{t("AI sales","AI sales")}</span><span>{t("Customer conversations","Customer conversations")}</span><span>{t("Orders","Orders")}</span></div><Link href="/signup" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-cyan-300">{t("Start free","ফ্রি শুরু করুন")} <ArrowRight className="h-4 w-4" /></Link></div>{columns.map(column => <div className="footer-column" key={column.title}><p className="footer-heading">{column.title}</p><div className="mt-5 space-y-3">{column.links.map(([href,label]) => <Link key={href+label} href={href} className="footer-link">{label}</Link>)}</div></div>)}</div><div className="footer-v2-bottom"><p>© {new Date().getFullYear()} {BRAND.name}</p><span><MapPin className="h-3.5 w-3.5" />{t("Bangladesh-first commerce","বাংলাদেশ-প্রথম কমার্স")}</span><span>{t("WhatsApp coming soon","WhatsApp শীঘ্রই আসছে")}</span><LanguageSwitch inverse /></div></div></footer>;
}
