"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  Globe2,
  Headphones,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Upload,
  Plus,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HomeSalesAgent, HomeReveal, HomeScrollStory } from "./home-sales-agent";

const capabilities = [
  { icon: MessageCircle, title: "Conversation intelligence", copy: "Respond from approved catalog and business knowledge, with the customer’s intent kept in view." },
  { icon: Search, title: "Product discovery", copy: "Help customers narrow real products by need, price, availability, and specifications." },
  { icon: ShoppingBag, title: "Commerce follow-through", copy: "Keep the handoff from recommendation to customer and order workflows connected." },
];

const journey = [
  { number: "01", title: "Connect what you know", copy: "Bring in your website, files, product catalog, and the answers your team already trusts." },
  { number: "02", title: "Review before it learns", copy: "Resolve duplicates and conflicts, then approve only the details you want customers to receive." },
  { number: "03", title: "Sell with shared context", copy: "Use the same knowledge across chat, products, customer records, orders, and analytics." },
];

export function ChatAiHome() {
  return (
    <main className="fig-home">
      <HomeSalesAgent />
      <HomeScrollStory />

      <HomeReveal className="fig-light fig-capabilities">
        <div className="sp-wrap">
          <header className="fig-section-heading">
            <p className="fig-kicker">WHAT SELLPILOT CONNECTS</p>
            <h2>A better answer is built on better context.</h2>
            <p>Product knowledge, customer context, and the next step — connected in every conversation.</p>
          </header>
          <div className="fig-capability-grid">
            {capabilities.map(({ icon: Icon, title, copy }, index) => (
              <article key={title}>
                <span className="fig-card-number">0{index + 1}</span>
                <span className="fig-icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </HomeReveal>

      <HomeReveal id="workflow" className="fig-dark fig-demo-section">
        <div className="fig-demo-glow" aria-hidden="true" />
        <div className="sp-wrap">
          <header className="fig-section-heading inverse">
            <p className="fig-kicker">INTERACTIVE PRODUCT TOUR</p>
            <h2>See one customer question move through the system.</h2>
            <p>A question. A recommendation. A clear next step. Explore a sample conversation, then try a question of your own.</p>
          </header>
          <InteractiveCommerce />
        </div>
      </HomeReveal>

      <HomeReveal className="fig-light fig-journey">
        <div className="sp-wrap">
          <div className="fig-story-intro">
            <div><p className="fig-kicker">FROM SOURCE TO SALE</p><h2>Teach it once. Keep improving what it knows.</h2></div>
            <p>SellPilot turns disconnected business information into reviewed, reusable context—then keeps your team close to every important decision.</p>
          </div>
          <div className="fig-journey-list">
            {journey.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.copy}</p></div>
                <ArrowUpRight />
              </article>
            ))}
          </div>
          <TrainingCanvas />
        </div>
      </HomeReveal>

      <HomeReveal className="fig-workspace-section">
        <div className="sp-wrap fig-workspace-layout">
          <div className="fig-workspace-copy">
            <p className="fig-kicker">THE MERCHANT WORKSPACE</p>
            <h2>The conversation is visible. So is everything around it.</h2>
            <p>Products, orders, customers, training, and business analytics use one consistent workspace—without hiding the human controls your team needs.</p>
            <ul>
              <li><CheckCircle2 /> Product and inventory visibility</li>
              <li><CheckCircle2 /> Conversation history and takeover</li>
              <li><CheckCircle2 /> Recorded orders and business analytics</li>
            </ul>
            <Link href="/features" className="fig-text-link">Explore the platform <ArrowRight /></Link>
          </div>
          <WorkspaceCanvas />
        </div>
      </HomeReveal>

      <HomeReveal className="fig-light fig-products">
        <div className="sp-wrap">
          <header className="fig-section-heading">
            <p className="fig-kicker">ONE SELLPILOT ECOSYSTEM</p>
            <h2>Start with conversation. Add the place to buy.</h2>
          </header>
          <div className="fig-product-pair">
            <Link href="/products/ai-chatbot" className="fig-product-panel dark">
              <span className="fig-icon"><MessageCircle /></span>
              <p className="fig-kicker">AI CHATBOT</p>
              <h3>Business-aware help in every customer conversation.</h3>
              <p>Grounded responses, product recommendations, persistent history, and human takeover.</p>
              <span className="fig-panel-link">Explore AI Chatbot <ArrowUpRight /></span>
              <div className="fig-panel-chat"><i>What would fit my needs?</i><b><Sparkles /> Let’s narrow your real catalog.</b></div>
            </Link>
            <Link href="/products/store-builder" className="fig-product-panel purple">
              <span className="fig-icon"><Globe2 /></span>
              <p className="fig-kicker">STORE BUILDER</p>
              <h3>A connected storefront for the products you already manage.</h3>
              <p>Brand controls, real catalog data, cart, checkout, and orders tied to your workspace.</p>
              <span className="fig-panel-link">Explore Store Builder <ArrowUpRight /></span>
              <div className="fig-panel-store"><i /><i /><i /></div>
            </Link>
          </div>
        </div>
      </HomeReveal>

      <HomeReveal className="fig-trust">
        <div className="sp-wrap fig-trust-layout">
          <div><p className="fig-kicker">CONTROL BY DESIGN</p><h2>Useful automation, with clear boundaries.</h2></div>
          <div className="fig-trust-points">
            <article><ShieldCheck /><div><h3>Approved knowledge</h3><p>Imported information stays staged until your team reviews it.</p></div></article>
            <article><BarChart3 /><div><h3>Recorded insights</h3><p>Analytics reflect customer, order, and assistant activity already in SellPilot.</p></div></article>
            <article><Headphones /><div><h3>Human ownership</h3><p>Your team can take over a customer conversation when judgment matters.</p></div></article>
          </div>
        </div>
      </HomeReveal>

      <HomeReveal className="fig-light fig-faq">
        <div className="sp-wrap reset-faq">
          <div><p className="fig-kicker">A FEW GOOD QUESTIONS</p><h2>Before you say hello.</h2><p>Get to know the agent that gets to know your business.</p></div>
          <div>
            {[
              ["Does SellPilot understand Bangla and Banglish?", "Yes. SellPilot can work with Bangla, Banglish, and English conversations, using your approved business and product knowledge to answer customer questions."],
              ["Which channels can I connect?", "Messenger and website chat are available. WhatsApp is coming soon; its messages in the homepage animation illustrate the planned experience."],
              ["Where does the AI get its product information?", "From the catalog, website content, business files, and answers you provide. Your team reviews imported knowledge before it becomes approved context."],
              ["Can my team take over a conversation?", "Yes. Your team can see the conversation history and take over when a customer needs a person. The context stays with the conversation."],
              ["Can I try it before setting up my business?", "Yes. Open Test AI to explore the demo, ask a question, and see how SellPilot responds. Demo conversations and orders are illustrative."],
            ].map(([question, answer]) => <details key={question}><summary>{question}<Plus size={16} /></summary><p>{answer}</p></details>)}
          </div>
        </div>
      </HomeReveal>

      <HomeReveal className="fig-final">
        <div className="fig-final-glow" aria-hidden="true" />
        <div className="sp-wrap">
          <p className="fig-pill"><Bot size={12} /> Your AI commerce workspace</p>
          <h2>Make every conversation easier to act on.</h2>
          <p>Bring your product knowledge, customer conversations, and commerce operations into one focused SellPilot workspace.</p>
          <div className="fig-actions"><Link href="/signup" className="fig-primary">Get started <ArrowRight /></Link><Link href="/test-ai" className="fig-secondary">Try the AI <ArrowRight /></Link></div>
        </div>
      </HomeReveal>
    </main>
  );
}

function InteractiveCommerce() {
  const [active, setActive] = useState<"ask" | "match" | "act">("ask");
  const reduceMotion = useReducedMotion();
  const states = {
    ask: { number: "01", title: "Understand the request", customer: "I need something lightweight for everyday use.", response: "I’ll use the request and your approved catalog context to narrow the right options.", signal: "Intent understood" },
    match: { number: "02", title: "Check the catalog", customer: "Which products would work best?", response: "I can compare relevant products using their current price, availability, images, and specifications.", signal: "Catalog checked" },
    act: { number: "03", title: "Keep the next step clear", customer: "I want someone to confirm before I order.", response: "I’ll keep this conversation ready so your team can take over with the full context.", signal: "Team handoff ready" },
  }[active];
  return (
    <div className="fig-interactive">
      <nav aria-label="Commerce conversation stages">
        {([["ask", "Understand"], ["match", "Recommend"], ["act", "Take action"]] as const).map(([key, label], index) => (
          <button key={key} type="button" aria-pressed={active === key} onClick={() => setActive(key)}><span>0{index + 1}</span>{label}</button>
        ))}
      </nav>
      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={active} className="fig-interactive-body" initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }} transition={{ duration: reduceMotion ? 0 : 0.25 }}>
        <div className="fig-live-chat">
          <header><span className="fig-avatar">C</span><div><b>Customer conversation</b><small>Illustrative product tour</small></div><i /></header>
          <p className="customer">{states.customer}</p>
          <p className="agent"><span><Sparkles /> SELLPILOT AI</span>{states.response}</p>
          <div className="fig-live-product"><Package /><div><small>YOUR PRODUCT DATA</small><b>Relevant catalog details</b><p>Images · price · currency · availability</p></div><CheckCircle2 /></div>
        </div>
        <aside>
          <span className="fig-stage-number">{states.number}</span>
          <p className="fig-kicker">WHAT SELLPILOT DID</p>
          <h3>{states.title}</h3>
          <div className="fig-signal"><i /><span><small>CURRENT SIGNAL</small><b>{states.signal}</b></span></div>
          <ul><li><Check /> Customer language preserved</li><li><Check /> Approved business context used</li><li><Check /> Next action remains visible</li></ul>
          <Link href="/test-ai" className="fig-secondary">Test your own question <ArrowRight /></Link>
        </aside>
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TrainingCanvas() {
  return (
    <div className="fig-training-canvas" aria-label="Illustration of the SellPilot training workflow">
      <aside><Sparkles /><span /><span /><span /></aside>
      <div className="fig-training-main">
        <header><div><small>AI TRAINING</small><h3>Build trusted business context</h3></div><span>Review ready</span></header>
        <div className="fig-training-columns">
          <section><p>SOURCES</p><article><Globe2 /><div><b>Website</b><small>Products and policies</small></div><Check /></article><article><Upload /><div><b>Business file</b><small>Structured for review</small></div><Check /></article></section>
          <section><p>REVIEW QUEUE</p><article><Package /><div><b>Product details</b><small>Images · price · availability</small></div><span>Review</span></article><article><ShieldCheck /><div><b>Business answers</b><small>Policy and service context</small></div><span>Review</span></article></section>
        </div>
        <footer><i /><div><b>Your team approves the source of truth</b><small>Nothing becomes trusted context until it is reviewed.</small></div></footer>
      </div>
    </div>
  );
}

function WorkspaceCanvas() {
  return (
    <div className="fig-workspace-canvas" aria-label="Illustration of the SellPilot merchant workspace">
      <aside><Bot /><span /><span /><span /><span /></aside>
      <div>
        <header><span><small>MERCHANT WORKSPACE</small><b>One view of the work</b></span><i>Illustrative preview</i></header>
        <div className="fig-workspace-cards"><article><MessageCircle /><span><small>CONVERSATIONS</small><b>Visible</b></span></article><article><ShoppingBag /><span><small>ORDERS</small><b>Organized</b></span></article><article><Package /><span><small>PRODUCTS</small><b>Connected</b></span></article></div>
        <div className="fig-workspace-chart"><header><b>Recorded activity</b><small>No projected data</small></header><div>{[38,57,44,73,60,88,70,92].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
        <div className="fig-workspace-event"><Workflow /><span><b>Conversation context kept</b><small>The customer’s next step stays visible to your team.</small></span><CheckCircle2 /></div>
      </div>
    </div>
  );
}
