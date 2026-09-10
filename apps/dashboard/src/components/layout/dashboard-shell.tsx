"use client";
import {useState} from "react";
import {usePathname} from "next/navigation";
import {useSession} from "next-auth/react";
import Link from "next/link";
import {Menu,ChevronRight,MessageSquare} from "lucide-react";
import {Sidebar} from "./sidebar";
export function DashboardShell({children}:{children:React.ReactNode}){
 const [open,setOpen]=useState(false);const path=usePathname();const {data:session}=useSession();
 const auth=["/login","/signup","/onboarding","/forgot-password","/reset-password","/verify-email","/resend-verification","/admin/login"];
 if(auth.includes(path)||path.startsWith("/platform-admin"))return <>{children}</>;
 const isTestAi = path === "/assistant" || path === "/test-ai";
 const section = path === "/" ? "Overview" : isTestAi ? "Test AI" : path.split("/").filter(Boolean).pop()!.replaceAll("-"," ");
 return <div className="merchant-frame"><a href="#workspace-content" className="sr-only focus:not-sr-only">Skip to workspace</a><div className={`merchant-navigation ${open?"is-open":""}`}><Sidebar onClose={()=>setOpen(false)}/></div>{open&&<button className="merchant-scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}<div className="merchant-workspace"><header className="merchant-topbar"><button className="merchant-menu" onClick={()=>setOpen(!open)} aria-label="Open navigation" aria-expanded={open}><Menu size={19}/></button><div className="merchant-breadcrumb"><span>Workspace</span><ChevronRight size={12}/><strong>{section}</strong></div><div className="merchant-utilities"><Link href="/conversations" title="Open conversations"><MessageSquare size={17}/><span>Inbox</span></Link><Link href="/settings/security" className="merchant-account"><span>{(session?.user?.name||session?.user?.email||"S").slice(0,1).toUpperCase()}</span><span>{session?.user?.name||"My account"}</span></Link></div></header><main id="workspace-content" className={`merchant-content ${isTestAi ? "merchant-content-test-ai" : ""}`}>{children}</main></div></div>;
}
