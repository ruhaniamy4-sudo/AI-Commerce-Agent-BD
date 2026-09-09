import Link from "next/link";
import type {ReactNode} from "react";
import {Bot,MessageSquare,Package,ArrowRight,ShieldCheck} from "lucide-react";

export const PUBLIC_HOMEPAGE_URL=process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim()||"https://aicommerceagent.vercel.app";

export function AuthBrand(){return <Link href={PUBLIC_HOMEPAGE_URL} className="auth-reset-brand" aria-label="Go to the public SellPilot homepage"><span><Bot size={20}/></span>SellPilot</Link>;}

export function PublicAuthPage({children}:{children:ReactNode}){return <main className="auth-public-page flex min-h-screen items-center justify-center bg-slate-50 p-4"><div className="auth-public-brand"><AuthBrand/></div>{children}</main>;}

export function AuthVisual({mode}:{mode:"login"|"signup"}){return <aside className="auth-reset-visual sp-dark"><div className="sp-atmos" aria-hidden="true"><span className="sp-orbit"/></div><AuthBrand/><div className="relative"><p className="sp-eyebrow">Commerce, connected</p><h2>{mode==="login"?"A clear view.\nA fresh start.":"Your business.\nOne connected workspace."}</h2><p>Give every conversation the context it deserves. Keep your products, customers, and team moving together.</p><div className="auth-reset-flow"><span><MessageSquare size={18}/>Conversation</span><ArrowRight size={16}/><span><Bot size={18}/>SellPilot AI</span><ArrowRight size={16}/><span><Package size={18}/>Next step</span></div></div><p className="auth-reset-assurance"><ShieldCheck size={17}/>Human control, built into every workflow.</p></aside>;}
