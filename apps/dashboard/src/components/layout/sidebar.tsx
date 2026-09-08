"use client";

import {BarChart3,BookOpen,Bot,CreditCard,LayoutDashboard,LogOut,MessageSquare,Monitor,Moon,Package,PlugZap,Settings,ShieldCheck,ShoppingCart,Sparkles,Store,Sun,UserRoundCog,Users,X} from "lucide-react";
import {signOut,useSession} from "next-auth/react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useTheme} from "next-themes";

type Child={name:string;href:string;icon:typeof Bot;management?:boolean};
type NavigationItem={name:string;href:string;icon:typeof Bot;group:string;children?:Child[]};

const navigation:NavigationItem[]=[
 {name:"Dashboard",href:"/",icon:LayoutDashboard,group:"Workspace"},
 {name:"Conversations",href:"/conversations",icon:MessageSquare,group:"Workspace"},
 {name:"Customers",href:"/customers",icon:Users,group:"Workspace"},
 {name:"Products",href:"/products",icon:ShoppingCart,group:"Commerce",children:[{name:"Categories",href:"/categories",icon:ShoppingCart},{name:"Store Builder",href:"/store-builder",icon:Store}]},
 {name:"Orders",href:"/orders",icon:Package,group:"Commerce"},
 {name:"Train AI",href:"/training",icon:Sparkles,group:"AI & insights",children:[{name:"Business Knowledge",href:"/knowledge",icon:BookOpen},{name:"Test AI",href:"/assistant",icon:Bot}]},
 {name:"Analytics",href:"/admin/analytics",icon:BarChart3,group:"AI & insights"},
 {name:"Integrations",href:"/settings/integrations",icon:PlugZap,group:"Manage"},
 {name:"Settings",href:"/settings/business",icon:Settings,group:"Manage",children:[{name:"Team",href:"/settings/team",icon:UserRoundCog,management:true},{name:"Billing & Plan",href:"/settings/billing",icon:CreditCard,management:true},{name:"AI Usage",href:"/ai-usage",icon:BarChart3,management:true},{name:"Security",href:"/settings/security",icon:ShieldCheck}]},
];

function matches(path:string,href:string){return href==="/"?path==="/":path===href||path.startsWith(`${href}/`)}

export function Sidebar({onClose,className=""}:{onClose?:()=>void;className?:string}){
 const path=usePathname();const {data:session}=useSession();const {theme,setTheme}=useTheme();const canManage=session?.role!=="Staff";
 return <aside className={`merchant-sidebar ${className}`}><div className="merchant-brand"><Link href="/" onClick={onClose}><span><Bot size={20}/></span>SellPilot</Link><button onClick={onClose} aria-label="Close navigation"><X size={18}/></button></div><div className="merchant-workspace-label"><span className="merchant-workspace-icon">S</span><div><strong>Merchant workspace</strong><small>{session?.role||"Your business"}</small></div></div><nav aria-label="Workspace navigation">{["Workspace","Commerce","AI & insights","Manage"].map(group=><div key={group}><p>{group}</p>{navigation.filter(item=>item.group===group).map(item=>{const children=(item.children||[]).filter(child=>!child.management||canManage);const active=matches(path,item.href)||children.some(child=>matches(path,child.href));return <div key={item.href}><Link href={item.href} onClick={onClose} aria-current={active?"page":undefined}><item.icon size={17}/><span>{item.name}</span></Link>{active&&children.length>0&&<div className="merchant-nav-children">{children.map(child=><Link key={child.href} href={child.href} onClick={onClose} aria-current={matches(path,child.href)?"page":undefined}><child.icon size={14}/><span>{child.name}</span></Link>)}</div>}</div>})}</div>)}</nav><div className="merchant-sidebar-bottom"><div className="merchant-theme" role="group" aria-label="Color theme">{[{value:"light",Icon:Sun},{value:"dark",Icon:Moon},{value:"system",Icon:Monitor}].map(({value,Icon})=><button key={value} onClick={()=>setTheme(value)} aria-label={value+" theme"} aria-pressed={theme===value}><Icon size={14}/><span>{value}</span></button>)}</div><button className="merchant-logout" onClick={()=>signOut({callbackUrl:"/login"})}><LogOut size={16}/>Sign out</button></div></aside>;
}
