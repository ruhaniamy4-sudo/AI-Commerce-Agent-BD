import Link from "next/link";
import { ArrowRight, Bot, Boxes, Check, CircleDollarSign, Headphones, MessageCircle, PackageCheck, Search, ShieldCheck, Sparkles, Store, UserRoundCheck, UsersRound, Workflow } from "lucide-react";
import { FinalCTA, SectionHeading } from "@/components/marketing";

export default function Home() {
  return (
    <main>
      <section className="hero-grid relative overflow-hidden pb-24 pt-20 sm:pt-28 lg:pb-32 lg:pt-36">
        <div className="glow-orb -left-32 top-28 h-80 w-80 bg-blue-400/25" />
        <div className="glow-orb -right-28 top-8 h-96 w-96 bg-cyan-300/25" />
        <div className="site-container relative grid items-center gap-16 lg:grid-cols-[1.03fr_.97fr]">
          <div className="reveal-up max-w-3xl">
            <div className="eyebrow mb-6"><span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_5px_rgba(59,130,246,.12)]" />Built for Bangladesh commerce</div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.03] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-7xl">Turn every customer conversation into revenue.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Digitross is an AI commerce agent that helps Bangladesh businesses sell, support, create orders, and manage customers across the channels they already use.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="button-primary">Get early access <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/features" className="button-secondary">See how it works</Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" />Facebook Messenger</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-blue-600" />Web chat</span>
              <span className="inline-flex items-center gap-2 text-slate-400">WhatsApp · Coming soon</span>
            </div>
          </div>
          <div className="reveal-up relative mx-auto w-full max-w-[590px] [animation-delay:120ms]">
            <div className="dashboard-shell">
              <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Bot className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-950">Sales conversation</p><p className="text-xs text-slate-500">Facebook Messenger</p></div></div>
                <span className="status-pill"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />AI active</span>
              </div>
              <div className="space-y-4 bg-slate-50/80 p-5 sm:p-7">
                <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-lg shadow-blue-600/15">Black color ta available?</div>
                <div className="max-w-[84%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">Yes, Black is available. Would you like me to place an order?</div>
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <MiniCard icon={<PackageCheck className="h-4 w-4" />} title="Order ready" detail="1 item · Cash on delivery" />
                  <MiniCard icon={<UserRoundCheck className="h-4 w-4" />} title="Customer identified" detail="Returning customer" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/80 bg-white px-5 py-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><ShieldCheck className="h-4 w-4 text-blue-600" />Tenant-safe workspace</div><span className="text-xs font-semibold text-blue-600">Take over</span></div>
            </div>
            <div className="floating-chip -left-5 top-24 hidden sm:flex"><MessageCircle className="h-4 w-4 text-blue-600" />Banglish understood</div>
            <div className="floating-chip -right-5 bottom-24 hidden sm:flex"><PackageCheck className="h-4 w-4 text-emerald-600" />Order created</div>
          </div>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-white py-6"><div className="site-container flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center text-sm font-semibold text-slate-600"><span>Bangla + Banglish</span><span>Multi-business ready</span><span>Human takeover</span><span>Low-cost AI controls</span><span>Messenger-first</span></div></section>

      <section className="site-container py-20 sm:py-28">
        <SectionHeading eyebrow="How it works" title="From first message to daily operations." copy="Digitross connects the customer conversation to the business data and team behind it." center />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Connect", "Bring Facebook Messenger and web conversations into one flow."],
            ["02", "Train", "Add products, policies, FAQs, and the knowledge your business relies on."],
            ["03", "Sell", "Let AI answer questions, recommend products, and prepare real orders."],
            ["04", "Operate", "Manage conversations, customers, orders, and human handoffs together."],
          ].map(([step, title, copy]) => <div key={step} className="surface-card p-6"><span className="text-xs font-extrabold text-blue-600">{step}</span><h3 className="mt-8 text-xl font-semibold text-slate-950">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p></div>)}
        </div>
      </section>

      <section id="product" className="scroll-mt-24 bg-slate-50 py-20 sm:py-28"><div className="site-container">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><SectionHeading eyebrow="One commerce workspace" title="AI where it matters. Control where you need it." copy="A focused operating layer for conversations that lead to customers, orders, and long-term relationships." /><Link href="/features" className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700">Explore every feature <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            [<Sparkles key="i" />, "AI sales agent", "Concise, useful conversations grounded in business context."],
            [<MessageCircle key="i" />, "Unified conversations", "Web and Messenger conversations in one operational view."],
            [<Search key="i" />, "Smart product search", "Relevant product candidates instead of entire catalog dumps."],
            [<PackageCheck key="i" />, "Order automation", "Backend-confirmed order creation with safer customer responses."],
            [<Headphones key="i" />, "Human takeover", "Take control instantly and return future messages to AI."],
            [<Boxes key="i" />, "Knowledge support", "Answers grounded in policies, products, and merchant knowledge."],
            [<CircleDollarSign key="i" />, "AI cost controls", "Bounded context, usage tracking, and configurable limits."],
            [<ShieldCheck key="i" />, "Business isolation", "Tenant-safe data access designed for multiple businesses."],
          ].map(([icon, title, copy]) => <div key={String(title)} className="surface-card p-6"><div className="icon-tile [&>svg]:h-5 [&>svg]:w-5">{icon}</div><h3 className="mt-5 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></div>)}
        </div>
      </div></section>

      <section className="site-container grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-2">
        <div><SectionHeading eyebrow="Built around local commerce" title="Bangladesh businesses sell through conversations." copy="Digitross is designed around Messenger-first discovery, Bangla and Banglish questions, cash-on-delivery operations, and the moment a growing team needs to step in." /><div className="mt-8 grid gap-4 sm:grid-cols-2">{[[<MessageCircle key="i" />, "Natural Banglish"], [<Store key="i" />, "Messenger commerce"], [<UsersRound key="i" />, "Human collaboration"], [<Workflow key="i" />, "Courier-ready direction"]].map(([icon, title]) => <div key={String(title)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-800"><span className="text-blue-600 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>{title}</div>)}</div><p className="mt-5 text-sm text-slate-500">Courier automation, including Steadfast integration, is coming soon and is not presented as live.</p></div>
        <div className="rounded-[2rem] bg-blue-600 p-6 text-white shadow-2xl shadow-blue-600/20 sm:p-9"><p className="text-sm font-bold text-blue-100">A typical customer moment</p><div className="mt-7 space-y-4"><div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white/15 p-4 text-sm">Bhai, eta Dhakar baire COD hobe?</div><div className="max-w-[90%] rounded-2xl rounded-bl-md bg-white p-4 text-sm leading-6 text-slate-700">Yes—cash on delivery can be arranged. Share your district and area, and I’ll collect the delivery details for confirmation.</div><div className="grid gap-3 pt-3 sm:grid-cols-2"><div className="rounded-xl bg-blue-700/70 p-4"><UserRoundCheck className="h-5 w-5" /><p className="mt-4 text-sm font-semibold">Lead captured</p></div><div className="rounded-xl bg-blue-700/70 p-4"><PackageCheck className="h-5 w-5" /><p className="mt-4 text-sm font-semibold">COD workflow ready</p></div></div></div></div>
      </section>
      <FinalCTA />
    </main>
  );
}

function MiniCard({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1"><div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
