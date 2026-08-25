"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, Bot, Box, Check, CheckCircle2, ChevronDown, CircleDollarSign,
  Database, Headphones, Languages, MessageCircle, PackageCheck, Play, RefreshCw,
  SearchCheck, Send, ShieldCheck, ShoppingBag, Sparkles, UsersRound, Workflow,
  X, Zap,
} from "lucide-react";
import { PRICING_PLANS } from "@/lib/marketing-config";
import { useLanguage } from "@/context/language-context";

type Channel = "messenger" | "whatsapp" | "website";
const rotation = {
  en: ["talk to customers.", "recommend the right product.", "collect order details.", "remember customer context.", "keep commerce moving."],
  bn: ["কাস্টমারের সাথে কথা বলে।", "ঠিক পণ্যটি খুঁজে দেয়।", "অর্ডারের তথ্য নেয়।", "কাস্টমারকে মনে রাখে।", "কমার্স চালু রাখে।"],
};

const demoData = {
  messenger: {
    customer: "Rahim", intent: "Purchase", product: "Black T-Shirt", accent: "#2563eb",
    messages: ["Black t-shirt ta available?", "হ্যাঁ—Black কালারে M, L আর XL আছে।", "XL er price koto?", "XL-এর দাম ৳1,490। একটি অর্ডার শুরু করব?"],
  },
  whatsapp: {
    customer: "Nadia", intent: "Future demo", product: "Canvas Tote", accent: "#16a34a",
    messages: ["Ei tote bag ta ache?", "এই সম্ভাব্য WhatsApp অভিজ্ঞতা এখনও সংযুক্ত নয়।", "Price koto?", "WhatsApp integration আসছে—এটি শুধু একটি product preview।"],
  },
  website: {
    customer: "Website visitor", intent: "Product enquiry", product: "Everyday Sneaker", accent: "#7c3aed",
    messages: ["Ei product er black ache?", "জি, Black কালারে 40–43 size আছে।", "Price?", "দাম ৳2,490। চাইলে delivery তথ্য নেওয়া শুরু করতে পারি।"],
  },
} as const;

export function HomeExperience() {
  const { locale, text } = useLanguage();
  const [phrase, setPhrase] = useState(0);
  const [channel, setChannel] = useState<Channel>("messenger");
  const [demoKey, setDemoKey] = useState(0);
  const [workStep, setWorkStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPhrase((value) => (value + 1) % rotation[locale].length), 2700);
    return () => window.clearInterval(timer);
  }, [locale]);

  const t = (en: string, bn: string) => text({ en, bn });
  const selected = demoData[channel];

  return <main>
    <section className="v2-hero hero-grid">
      <div className="aurora aurora-blue v2-hero-glow-one" /><div className="aurora aurora-violet v2-hero-glow-two" />
      <div className="site-container v2-hero-layout">
        <div className="v2-hero-copy reveal-up">
          <div className="eyebrow"><Sparkles className="h-3.5 w-3.5" />{t("AI sales agent for Bangladesh commerce", "বাংলাদেশি কমার্সের জন্য AI Sales Agent")}</div>
          <h1>{t("Your AI sales agent for every customer conversation.", "প্রতিটি কাস্টমার কথোপকথনের জন্য আপনার AI Sales Agent।")}</h1>
          <div className="rotating-line" aria-live="polite"><span>{t("SellPilot helps you", "SellPilot আপনার হয়ে")}</span><strong key={`${locale}-${phrase}`}>{rotation[locale][phrase]}</strong></div>
          <p>{t("SellPilot handles Messenger and website conversations, finds products, checks business data, remembers context, and helps your team move from question to order.", "SellPilot Messenger ও Website-এর কাস্টমার কথোপকথন সামলায়, পণ্য খুঁজে দেয়, ব্যবসার তথ্য যাচাই করে, প্রসঙ্গ মনে রাখে এবং প্রশ্ন থেকে অর্ডার পর্যন্ত টিমকে এগিয়ে নেয়।")}</p>
          <div className="v2-actions"><Link href="/signup" className="button-primary">{t("Start free", "ফ্রি শুরু করুন")} <ArrowRight className="h-4 w-4" /></Link><Link href="/demo" className="button-secondary"><Play className="h-4 w-4" />{t("See it in action", "কীভাবে কাজ করে দেখুন")}</Link></div>
          <div className="trust-row"><span><CheckCircle2 />{t("No card required", "কার্ড লাগবে না")}</span><span><ShieldCheck />{t("Human control built in", "Human control অন্তর্ভুক্ত")}</span></div>
        </div>
        <HeroCommerceVisual t={t} />
      </div>
    </section>

    <section className="channel-availability" aria-label="Channel availability"><div className="site-container channel-availability-inner">
      <p>{t("Meet customers where they already talk", "কাস্টমার যেখানে কথা বলে, সেখানেই থাকুন")}</p>
      <StatusPill label="Facebook Messenger" status={t("Available", "চালু আছে")} /><StatusPill label="Website Chat" status={t("Available", "চালু আছে")} /><StatusPill label="WhatsApp" status={t("Coming soon", "শীঘ্রই আসছে")} future />
    </div></section>

    <section id="demo" className="section-space"><div className="site-container">
      <SectionIntro eyebrow={t("Interactive product experience", "ইন্টার‌্যাক্টিভ প্রোডাক্ট অভিজ্ঞতা")} title={t("One AI agent. Every customer conversation.", "এক AI Agent। সব কাস্টমার কথোপকথন।")} copy={t("Switch channels to see how the same commerce brain keeps customer, product, and order context connected—without calling a live AI model.", "চ্যানেল বদলে দেখুন—একই commerce brain কীভাবে customer, product ও order context যুক্ত রাখে। এই demo কোনো live AI model call করে না।")} center />
      <div className="demo-shell">
        <div className="channel-tabs" role="tablist" aria-label="Demo channel">{(["messenger","whatsapp","website"] as Channel[]).map(item => <button key={item} role="tab" aria-selected={channel===item} className={channel===item?"is-active":""} onClick={()=>{setChannel(item);setDemoKey(v=>v+1)}}>{item === "messenger" ? "Messenger" : item === "whatsapp" ? "WhatsApp" : t("Website", "Website")}{item === "whatsapp" && <small>{t("Soon", "শীঘ্রই")}</small>}</button>)}</div>
        <div className="demo-layout" key={`${channel}-${demoKey}`}>
          <DemoConversation channel={channel} messages={selected.messages} t={t} />
          <LiveActivity channel={channel} data={selected} t={t} />
        </div>
        <button type="button" className="replay-button" onClick={()=>setDemoKey(v=>v+1)}><RefreshCw className="h-4 w-4" />{t("Replay demo", "Demo আবার দেখুন")}</button>
      </div>
      <div className="commerce-brain"><span>Messenger</span><span>Website</span><span className="is-future">WhatsApp · {t("soon", "শীঘ্রই")}</span><strong><Bot />SellPilot</strong><div><small>{t("Same commerce intelligence", "একই commerce intelligence")}</small><b>{t("Customer · Product · Order · Knowledge", "Customer · Product · Order · Knowledge")}</b></div></div>
    </div></section>

    <section className="section-space bg-soft"><div className="site-container">
      <SectionIntro eyebrow={t("From inbox pressure to clear operations", "Inbox-এর চাপ থেকে গোছানো operation")} title={t("Busy inboxes should not decide how much you sell.", "ব্যস্ত inbox যেন আপনার বিক্রি ঠিক করে না দেয়।")} copy={t("The customer expects one helpful conversation. Your team should not need five disconnected tools to deliver it.", "কাস্টমার চায় একটি সহায়ক কথোপকথন। সেটি দিতে আপনার টিমের পাঁচটি বিচ্ছিন্ন tool লাগা উচিত নয়।")} center />
      <div className="problem-solution-grid"><StoryCard problem title={t("Without SellPilot", "SellPilot ছাড়া")} items={[t("Late replies lose ready buyers", "দেরিতে reply দিলে আগ্রহী buyer হারায়"),t("Price and stock questions repeat all day", "সারাদিন একই price ও stock প্রশ্ন আসে"),t("Order details get copied by hand", "Order details হাতে copy করতে হয়"),t("Customer context disappears", "Customer context হারিয়ে যায়")]} /><StoryCard title={t("With SellPilot", "SellPilot-এর সাথে")} items={[t("Customers get an immediate, grounded reply", "কাস্টমার দ্রুত, তথ্যভিত্তিক reply পায়"),t("Products and knowledge stay connected", "Product ও knowledge যুক্ত থাকে"),t("Order information becomes an organized workflow", "Order information গোছানো workflow হয়"),t("A human can take over at any moment", "যেকোনো সময় মানুষ control নিতে পারে")]} /></div>
    </div></section>

    <section id="works-for-you" className="section-space"><div className="site-container works-grid">
      <div><SectionIntro eyebrow={t("SellPilot works for you", "SellPilot আপনার হয়ে কাজ করে")} title={t("From the first question to an order-ready conversation.", "প্রথম প্রশ্ন থেকে order-ready conversation পর্যন্ত।")} copy={t("Choose a moment in the sales journey. The product view changes with the work SellPilot is doing.", "Sales journey-এর একটি ধাপ বেছে নিন। SellPilot যে কাজ করছে, সেই অনুযায়ী product view বদলে যাবে।")} />
      <div className="work-step-list">{[
        [t("Talks", "কথা বলে"),t("Answers in the customer’s language", "কাস্টমারের ভাষায় উত্তর দেয়")],
        [t("Finds products", "পণ্য খুঁজে দেয়"),t("Matches catalog and knowledge", "Catalog ও knowledge match করে")],
        [t("Recommends", "বিক্রিতে সহায়তা করে"),t("Guides the next best choice", "পরের উপযুক্ত choice দেখায়")],
        [t("Collects orders", "অর্ডারের তথ্য নেয়"),t("Prepares details for confirmation", "Confirmation-এর জন্য details প্রস্তুত করে")],
        [t("Remembers", "মনে রাখে"),t("Keeps useful customer context", "দরকারি customer context ধরে রাখে")],
        [t("Supports delivery", "Delivery workflow সহায়তা করে"),t("Courier foundation, human-approved", "Courier foundation, human-approved")],
      ].map(([title,copy],index)=><button key={title} className={workStep===index?"is-active":""} onClick={()=>setWorkStep(index)}><span>{String(index+1).padStart(2,"0")}</span><div><b>{title}</b><small>{copy}</small></div><ArrowRight /></button>)}</div></div>
      <WorkVisual step={workStep} t={t} />
    </div></section>

    <section id="workflow" className="section-space dark-section"><div className="site-container">
      <SectionIntro eyebrow={t("A grounded commerce workflow", "তথ্যভিত্তিক commerce workflow")} title={t("AI handles the conversation. Your systems remain authoritative.", "AI কথোপকথন সামলায়। কর্তৃত্ব থাকে আপনার system-এর।")} copy={t("SellPilot understands intent and prepares work, while backend data and merchant approval protect price, stock, and order actions.", "SellPilot intent বুঝে কাজ প্রস্তুত করে; price, stock ও order action সুরক্ষিত রাখে backend data ও merchant approval।")} />
      <div className="workflow-track">{[
        [MessageCircle,t("Customer messages", "কাস্টমার message দেয়")], [Bot,t("Intent understood", "Intent বোঝে")], [SearchCheck,t("Knowledge searched", "Knowledge search করে")], [Database,t("Backend confirms", "Backend নিশ্চিত করে")], [Send,t("AI responds", "AI reply দেয়")], [PackageCheck,t("Order prepared", "Order প্রস্তুত হয়")], [ShieldCheck,t("Merchant approves", "Merchant approve করে")], [Headphones,t("Human anytime", "যেকোনো সময় human")]
      ].map(([Icon,label],index)=><div key={String(label)}><span>{index+1}</span><Icon className="h-5 w-5" /><b>{label as string}</b></div>)}</div>
    </div></section>

    <section id="product" className="section-space bg-soft"><div className="site-container">
      <SectionIntro eyebrow={t("Inside the operation", "Operation-এর ভিতরে")} title={t("A sales agent connected to the work behind the chat.", "Chat-এর পেছনের কাজের সাথে যুক্ত একটি Sales Agent।")} copy={t("Not ten identical feature cards. Real product surfaces for conversations, customers, orders, knowledge, usage, and team control.", "একই রকম দশটি feature card নয়। Conversations, customers, orders, knowledge, usage ও team control-এর বাস্তব product surface।")} />
      <div className="v2-bento"><BentoConversation t={t} /><BentoOrders t={t} /><BentoHuman t={t} /><BentoContext t={t} /><BentoUsage t={t} /><BentoKnowledge t={t} /></div>
    </div></section>

    <section className="section-space bd-section"><div className="site-container bd-layout"><div><p className="section-kicker">{t("Built for commerce in Bangladesh", "বাংলাদেশের কমার্সের জন্য তৈরি")}</p><h2>{t("Local selling is conversational. Your AI should be too.", "এখানকার বিক্রি কথোপকথননির্ভর। আপনার AI-ও তেমন হওয়া উচিত।")}</h2><p>{t("SellPilot is shaped around Bangla, English, Banglish, Messenger commerce, COD-oriented operations, and human-assisted selling.", "SellPilot তৈরি হচ্ছে বাংলা, English, Banglish, Messenger commerce, COD-oriented operation এবং human-assisted selling মাথায় রেখে।")}</p><small>{t("WhatsApp is coming soon. Courier connectivity remains a foundation for controlled workflows.", "WhatsApp শীঘ্রই আসছে। Courier connectivity controlled workflow-এর foundation হিসেবে থাকছে।")}</small></div><div className="bd-language-card"><div className="language-orbit"><span>বাংলা</span><span>English</span><span>Banglish</span><strong><Languages />SellPilot</strong></div><div className="local-tags"><span>Facebook sellers</span><span>COD workflow</span><span>Human-assisted</span><span>Courier foundation</span></div></div></div></section>

    <section className="section-space"><div className="site-container human-layout"><div className="human-console"><div><span className="status-dot" />AI active</div><p>“Delivery charge Dhakar baire koto?”</p><div className="handover-row"><Bot /><span>{t("Draft grounded in delivery policy", "Delivery policy থেকে grounded draft")}</span><button>{t("Take over", "Control নিন")}</button></div></div><div><SectionIntro eyebrow={t("Human + AI control", "Human + AI control")} title={t("Automation when it helps. A person when it matters.", "যেখানে automation দরকার, সেখানে AI। যেখানে বিচার দরকার, সেখানে মানুষ।")} copy={t("Your team can take over a conversation, reply directly, and return future messages to AI when ready.", "আপনার টিম conversation take over করে সরাসরি reply দিতে পারে, তারপর প্রস্তুত হলে ভবিষ্যৎ message আবার AI-কে দিতে পারে।")} /><ul className="check-list"><li><Check />{t("Visible controller state", "স্পষ্ট controller state")}</li><li><Check />{t("Immediate human takeover", "তাৎক্ষণিক human takeover")}</li><li><Check />{t("Reversible control", "Reversible control")}</li></ul></div></div></section>

    <section className="section-space bg-soft"><div className="site-container">
      <SectionIntro eyebrow={t("Early-access pricing", "Early-access pricing")} title={t("Start with the workflow that matters most.", "সবচেয়ে দরকারি workflow দিয়ে শুরু করুন।")} copy={t("Pricing stays configurable while early-access rollouts define real usage. No unsupported unlimited-AI promises.", "Early-access rollout থেকে বাস্তব usage বোঝার সময় pricing configurable থাকবে। Unsupported unlimited-AI claim নেই।")} center />
      <div className="pricing-preview">{PRICING_PLANS.map(plan=><article key={plan.name} className={plan.featured?"is-featured":""}><p>{plan.label}</p><h3>{plan.name}</h3><strong>{plan.price}</strong><span>{plan.description}</span><ul>{plan.features.slice(0,3).map(feature=><li key={feature}><Check />{feature}</li>)}</ul><Link href="/signup" className={plan.featured?"button-primary":"button-secondary"}>{t("Start free", "ফ্রি শুরু করুন")}</Link></article>)}</div>
      <div className="center-link"><Link href="/pricing">{t("See full pricing", "সম্পূর্ণ pricing দেখুন")} <ArrowRight /></Link></div>
    </div></section>

    <section id="faq" className="section-space"><div className="site-container faq-layout"><SectionIntro eyebrow={t("Questions before you start", "শুরু করার আগে প্রশ্ন")} title={t("Clear answers. No inflated promises.", "সোজা উত্তর। বাড়তি প্রতিশ্রুতি নয়।")} copy={t("What Bangladesh commerce teams usually want to know before a rollout.", "Rollout-এর আগে বাংলাদেশি commerce team সাধারণত যা জানতে চায়।")} /><div className="faq-list">{faq(locale).map(([q,a])=><details key={q}><summary>{q}<ChevronDown /></summary><p>{a}</p></details>)}</div></div></section>

    <section className="site-container about-strip"><div><p className="section-kicker">{t("About SellPilot", "SellPilot সম্পর্কে")}</p><h2>{t("We are building the operating layer behind conversation-led commerce.", "Conversation-led commerce-এর পেছনের operating layer তৈরি করছি আমরা।")}</h2></div><p>{t("Grounded AI, customer context, confirmed actions, and human authority—designed around how businesses in Bangladesh already sell.", "Grounded AI, customer context, confirmed action ও human authority—বাংলাদেশের ব্যবসা যেভাবে বিক্রি করে, সেভাবেই designed।")}</p><Link href="/about" className="button-secondary">{t("Our point of view", "আমাদের দৃষ্টিভঙ্গি")} <ArrowRight /></Link></section>

    <section className="site-container final-v2"><div className="cta-grid" /><div className="aurora aurora-blue" /><div><p>{t("Your next customer is already typing.", "আপনার পরের কাস্টমার ইতিমধ্যে লিখছেন।")}</p><h2>{t("Ready to turn conversations into sales?", "কথোপকথনকে বিক্রিতে বদলাতে প্রস্তুত?")}</h2><span>{t("Start with SellPilot or book a focused product walkthrough.", "SellPilot দিয়ে শুরু করুন অথবা একটি focused product walkthrough বুক করুন।")}</span><div className="v2-actions"><Link href="/signup" className="button-primary">{t("Start free", "ফ্রি শুরু করুন")} <ArrowRight /></Link><Link href="/demo" className="button-glass">{t("Book a demo", "Demo বুক করুন")}</Link></div></div></section>
    <FloatingSalesBot />
  </main>;
}

function SectionIntro({eyebrow,title,copy,center=false}:{eyebrow:string;title:string;copy:string;center?:boolean}){return <div className={`v2-section-intro ${center?"is-centered":""}`}><p className="section-kicker">{eyebrow}</p><h2>{title}</h2><span>{copy}</span></div>}
function StatusPill({label,status,future=false}:{label:string;status:string;future?:boolean}){return <div className={`status-pill ${future?"is-future":""}`}><span /><div><b>{label}</b><small>{status}</small></div></div>}
function HeroCommerceVisual({t}:{t:(en:string,bn:string)=>string}){return <div className="hero-commerce-visual reveal-up"><div className="hero-app-bar"><span className="brand-mini">SP</span><div><b>{t("Conversations", "Conversations")}</b><small>{t("Commerce workspace", "Commerce workspace")}</small></div><em><span className="status-dot" />{t("AI live", "AI চালু")}</em></div><div className="hero-chat-v2"><div className="person-row"><span>RA</span><div><b>Raisa Ahmed</b><small>Messenger · {t("Active now", "এখন active")}</small></div></div><div className="v2-message is-customer">Black color ta available?</div><div className="system-stack"><span><SearchCheck />{t("Product matched", "Product matched")}<Check /></span><span><Database />{t("Stock checked", "Stock checked")}<Check /></span></div><div className="v2-message is-agent">{t("Yes—Black is available in M, L and XL. XL is ৳1,490.", "জি—Black কালারে M, L আর XL আছে। XL-এর দাম ৳1,490।")}</div><div className="typing-dots"><i /><i /><i /></div></div><div className="hero-operation-row"><div><UsersRound /><small>{t("Customer", "Customer")}</small><b>Raisa · {t("Returning", "Returning")}</b></div><div><Box /><small>{t("Order", "Order")}</small><b>{t("Ready for review", "Review-এর জন্য ready")}</b></div><div><Headphones /><small>{t("Control", "Control")}</small><b>{t("Human available", "Human available")}</b></div></div><div className="hero-float-card"><Zap />{t("Commerce activity synchronized", "Commerce activity synchronized")}</div></div>}
function DemoConversation({channel,messages,t}:{channel:Channel;messages:readonly string[];t:(en:string,bn:string)=>string}){return <div className={`demo-phone is-${channel}`}><div className="demo-phone-head"><span className="brand-mini">SP</span><div><b>SellPilot Demo</b><small>{channel === "whatsapp" ? t("Preview · Not connected", "Preview · সংযুক্ত নয়") : t("Online · Deterministic demo", "Online · Deterministic demo")}</small></div></div>{channel === "website" && <div className="website-product"><div className="product-shoe">SP</div><div><b>Everyday Sneaker</b><span>৳2,490</span></div></div>}<div className="demo-messages">{messages.map((message,index)=><div key={message} className={`demo-message ${index%2===0?"is-customer":"is-agent"}`} style={{animationDelay:`${index*180}ms`}}>{message}{index===1&&<small><SearchCheck />{t("Product matched · Stock checked", "Product matched · Stock checked")}</small>}</div>)}<div className="order-ready"><PackageCheck />{channel === "whatsapp" ? t("Future experience preview", "Future experience preview") : t("Order information ready to collect", "Order information নেওয়ার জন্য ready")}</div></div></div>}
function LiveActivity({channel,data,t}:{channel:Channel;data:typeof demoData[Channel];t:(en:string,bn:string)=>string}){return <aside className="live-activity"><div className="live-title"><span className="status-dot" />{t("Live activity", "Live activity")}<small>{channel === "whatsapp" ? t("Preview", "Preview") : t("Synchronized", "Synchronized")}</small></div>{[[t("Customer", "Customer"),data.customer],[t("Channel", "Channel"),channel],[t("Intent", "Intent"),data.intent],[t("Product", "Product"),data.product],[t("Status", "Status"),channel === "whatsapp" ? t("Coming soon", "শীঘ্রই") : t("Order ready", "Order ready")]].map(([label,value],index)=><div className="activity-row" key={label} style={{animationDelay:`${index*80+180}ms`}}><span>{label}</span><b>{value}</b></div>)}<div className="activity-ai"><Bot /><div><span>SellPilot AI</span><b>{channel === "whatsapp" ? t("Not connected", "সংযুক্ত নয়") : t("Active", "Active")}</b></div></div></aside>}
function StoryCard({title,items,problem=false}:{title:string;items:string[];problem?:boolean}){return <article className={`story-v2 ${problem?"is-problem":"is-solution"}`}><p>{title}</p>{items.map(item=><div key={item}>{problem?<X />:<Check />}<span>{item}</span></div>)}</article>}
function WorkVisual({step,t}:{step:number;t:(en:string,bn:string)=>string}){const states=[[MessageCircle,t("Natural reply in Bangla, English, or Banglish", "বাংলা, English বা Banglish-এ স্বাভাবিক reply")],[SearchCheck,t("Catalog match with backend-authoritative data", "Backend-authoritative data দিয়ে catalog match")],[ShoppingBag,t("Product recommendation with useful context", "দরকারি context সহ product recommendation")],[PackageCheck,t("Customer details organized for merchant review", "Merchant review-এর জন্য customer details গোছানো")],[UsersRound,t("Conversation history keeps the next reply relevant", "Conversation history পরের reply relevant রাখে")],[Workflow,t("Courier status foundation with human approval", "Human approval সহ courier status foundation")]];const [Icon,label]=states[step] as [typeof MessageCircle,string];return <div className="work-visual" key={step}><div className="work-top"><span>SellPilot · {t("Workspace", "Workspace")}</span><em><span className="status-dot" />{t("Working", "কাজ করছে")}</em></div><div className="work-icon"><Icon /></div><h3>{label}</h3><div className="work-progress"><span style={{width:`${(step+1)/6*100}%`}} /></div><div className="work-data"><span><Database />{t("Business data", "Business data")}</span><span><ShieldCheck />{t("Controlled action", "Controlled action")}</span></div></div>}
function BentoConversation({t}:{t:(a:string,b:string)=>string}){return <article className="bento-v2 bento-conversation"><p>{t("AI sales conversations", "AI sales conversations")}</p><h3>{t("Replies grounded in your business—not generic guesses.", "Generic guess নয়—আপনার business-এ grounded reply।")}</h3><div className="mini-chat"><span>Blue ta available?</span><b>{t("Yes—Blue is available in L and XL.", "জি—Blue কালারে L এবং XL আছে।")}</b></div></article>}
function BentoOrders({t}:{t:(a:string,b:string)=>string}){return <article className="bento-v2"><PackageCheck /><p>{t("Orders", "Orders")}</p><h3>{t("Details ready for review", "Review-এর জন্য details ready")}</h3><div className="order-meter"><span /><span /><span /></div></article>}
function BentoHuman({t}:{t:(a:string,b:string)=>string}){return <article className="bento-v2"><Headphones /><p>{t("Human takeover", "Human takeover")}</p><h3>{t("One clear controller", "একটি স্পষ্ট controller")}</h3><button><span className="status-dot" />AI active <b>{t("Take over", "Control নিন")}</b></button></article>}
function BentoContext({t}:{t:(a:string,b:string)=>string}){return <article className="bento-v2 bento-context"><UsersRound /><p>{t("Unified customer context", "Unified customer context")}</p><h3>{t("The next message starts with useful history.", "পরের message শুরু হয় দরকারি history দিয়ে।")}</h3><div><span>Rahim</span><span>{t("Returning buyer", "Returning buyer")}</span><span>{t("Last intent: purchase", "Last intent: purchase")}</span></div></article>}
function BentoUsage({t}:{t:(a:string,b:string)=>string}){return <article className="bento-v2"><CircleDollarSign /><p>{t("AI cost control", "AI cost control")}</p><h3>{t("Usage stays visible", "Usage visible থাকে")}</h3><div className="usage-bars">{[45,72,52,84,63].map(v=><span key={v} style={{height:`${v}%`}} />)}</div></article>}
function BentoKnowledge({t}:{t:(a:string,b:string)=>string}){return <article className="bento-v2"><Database /><p>{t("Knowledge", "Knowledge")}</p><h3>{t("Products, policies, and context work together.", "Product, policy ও context একসাথে কাজ করে।")}</h3><div className="knowledge-chips"><span>Products</span><span>Delivery</span><span>Customer</span></div></article>}
function faq(locale:"bn"|"en") { return locale === "bn" ? [
  ["SellPilot কীভাবে কাজ করে?","SellPilot customer intent বুঝে আপনার products, knowledge ও conversation context থেকে দরকারি তথ্য খুঁজে reply তৈরি করে। Authoritative price, stock ও order action backend এবং merchant control-এর অধীনে থাকে।"],
  ["Facebook Messenger support করে?","হ্যাঁ। বর্তমান architecture-এ Facebook pipeline আছে এবং Messenger-কে available channel হিসেবে দেখানো হয়েছে।"],
  ["Website-এ integrate করা যাবে?","হ্যাঁ। Website chat বর্তমানে supported; marketing demo-তেও এই flow আলাদাভাবে দেখানো হয়েছে।"],
  ["WhatsApp আছে?","এখনও নয়। WhatsApp স্পষ্টভাবে Coming Soon হিসেবে দেখানো হয়েছে; কোনো live integration দাবি করা হচ্ছে না।"],
  ["AI ভুল করলে কী হবে?","Business knowledge ও backend data দিয়ে উত্তর grounded রাখা হয়। টিম যেকোনো সময় conversation take over করতে পারে।"],
  ["Bangla ও Banglish বুঝতে পারে?","Product direction বাংলা, English ও Banglish conversation-এর জন্য তৈরি। বাস্তব response quality আপনার configured business knowledge-এর ওপরও নির্ভর করবে।"],
  ["Order নিতে পারে?","SellPilot customer information collect করে order workflow প্রস্তুত করতে সাহায্য করতে পারে। Authoritative order action controlled backend flow ও merchant approval অনুসরণ করে।"],
  ["Setup করতে কত সময় লাগে?","Business ও integration scope অনুযায়ী setup ভিন্ন হবে। Demo call-এ আপনার প্রথম focused workflow নির্ধারণ করা হবে।"],
] : [
  ["How does SellPilot work?","SellPilot understands intent, searches relevant products, knowledge, and conversation context, then prepares a grounded reply. Authoritative price, stock, and order actions remain controlled by backend data and merchant workflows."],
  ["Does it support Facebook Messenger?","Yes. The current architecture includes the Facebook pipeline, and Messenger is presented as an available channel."],
  ["Can I add it to my website?","Yes. Website chat is currently supported and has its own product experience in this demo."],
  ["Is WhatsApp available?","Not yet. WhatsApp is clearly labeled Coming Soon; no live integration is being claimed."],
  ["What happens if the AI is wrong?","Replies are grounded in business knowledge and backend data, and your team can take over a conversation at any time."],
  ["Does it understand Bangla and Banglish?","The product direction supports Bangla, English, and Banglish conversations. Real response quality also depends on the business knowledge you configure."],
  ["Can it take orders?","SellPilot can collect customer information and prepare an order workflow. Authoritative order actions follow controlled backend and merchant-approval flows."],
  ["How long does setup take?","Setup depends on your business and integration scope. A demo call defines the first focused workflow for rollout."],
  ]; }

function FloatingSalesBot(){const {text}=useLanguage();const [open,setOpen]=useState(false);const [view,setView]=useState<"welcome"|"product"|"price"|"order"|"human">("welcome");const [typing,setTyping]=useState(false);const t=(en:string,bn:string)=>text({en,bn});useEffect(()=>{const frame=window.requestAnimationFrame(()=>{const saved=sessionStorage.getItem("sellpilot-demo-bot");if(saved==="open")setOpen(true)});return()=>window.cancelAnimationFrame(frame)},[]);function choose(next:typeof view){setTyping(true);window.setTimeout(()=>{setView(next);setTyping(false)},520)}function toggle(){setOpen(v=>{sessionStorage.setItem("sellpilot-demo-bot",!v?"open":"closed");return !v})}const responses={product:t("Here is a demo match from the catalog.","Catalog থেকে একটি demo match দেখুন।"),price:t("The demo product is ৳1,490. A real agent checks your authoritative catalog data.","Demo product-এর দাম ৳1,490। বাস্তব agent আপনার authoritative catalog data check করে।"),order:t("Demo status: Order #SP-1042 is with the courier. No production order was queried.","Demo status: Order #SP-1042 courier-এর কাছে আছে। কোনো production order query করা হয়নি।"),human:t("A human teammate can take over immediately. This demo has not contacted a real agent.","একজন human teammate সাথে সাথে take over করতে পারেন। এই demo কোনো real agent-কে contact করেনি।"),welcome:""};return <div className={`sales-bot ${open?"is-open":""}`}><button className="sales-bot-launcher" onClick={toggle} aria-label={open?t("Close SellPilot demo","SellPilot demo বন্ধ করুন"):t("Open SellPilot demo","SellPilot demo খুলুন")}><span className="status-dot" />{open?<X />:<Bot />}</button>{open&&<div className="sales-bot-panel"><div className="sales-bot-head"><div className="brand-mini">SP</div><div><b>SellPilot</b><small>{t("AI Sales Assistant demo", "AI Sales Assistant demo")}</small></div><button onClick={toggle} aria-label={t("Minimize chat","Chat minimize করুন")}><X /></button></div><div className="sales-bot-body"><div className="bot-bubble">{t("👋 Hi! I’m the SellPilot sales demo. Imagine I’m helping customers for your business—try an example below.","👋 হ্যালো! আমি SellPilot-এর AI Sales Assistant demo। ধরুন আমি আপনার business-এর customer handle করছি—নিচের একটি example try করুন।")}</div>{typing?<div className="typing-dots"><i/><i/><i/></div>:view!=="welcome"&&<><div className="bot-bubble">{responses[view]}</div>{view==="product"&&<div className="bot-product"><div>SP</div><span><b>Everyday Black Tee</b><small>৳1,490 · M / L / XL</small></span></div>}</>}<div className="quick-actions"><button onClick={()=>choose("product")}>🛍️ {t("Find a product","Product খুঁজছি")}</button><button onClick={()=>choose("price")}>💰 {t("Ask the price","Price জানতে চাই")}</button><button onClick={()=>choose("order")}>📦 {t("Track an order","Order কোথায়?")}</button><button onClick={()=>choose("human")}>🤝 {t("Human agent","Human Agent চাই")}</button></div><p className="demo-disclaimer">{t("Scripted website demo · no live AI or order lookup", "Scripted website demo · live AI বা order lookup নয়")}</p></div></div>}</div>}
