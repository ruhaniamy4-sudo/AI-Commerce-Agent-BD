"use client";
import {BookOpen,Bot,LogOut,MessageSquare,Package,ShoppingCart,Users,X,PlugZap,LayoutDashboard,BarChart3,UserRoundCog,Settings,ShieldCheck,Sparkles,Store,Monitor,Moon,Sun,CreditCard} from "lucide-react";
import {signOut,useSession} from "next-auth/react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useTheme} from "next-themes";
const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard, group: "Workspace" },
  { name: "AI Assistant", href: "/assistant", icon: Bot, group: "Workspace" },
  {
    name: "Conversations",
    href: "/conversations",
    icon: MessageSquare,
    group: "Workspace",
  },
  { name: "Customers", href: "/customers", icon: Users, group: "Commerce" },
  { name: "Customer operations", href: "/intelligence", icon: Sparkles, group: "Commerce" },
  { name: "Intelligence connections", href: "/settings/intelligence", icon: PlugZap, group: "Settings" },
  { name: "Orders", href: "/orders", icon: Package, group: "Commerce" },
  {
    name: "Products & Inventory",
    href: "/products",
    icon: ShoppingCart,
    group: "Commerce",
  },
  {
    name: "Store Builder",
    href: "/store-builder",
    icon: Store,
    group: "Commerce",
  },
  {
    name: "Business Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    group: "Commerce",
  },
  {
    name: "AI Training",
    href: "/training",
    icon: Sparkles,
    group: "SellPilot AI",
  },
  {
    name: "Business Knowledge",
    href: "/knowledge",
    icon: BookOpen,
    group: "SellPilot AI",
  },
  {
    name: "AI Usage",
    href: "/ai-usage",
    icon: BarChart3,
    group: "SellPilot AI",
  },
  {
    name: "Integrations",
    href: "/settings/integrations",
    icon: PlugZap,
    group: "Settings",
  },
  {
    name: "Team",
    href: "/settings/team",
    icon: UserRoundCog,
    group: "Settings",
  },
  {
    name: "Business Settings",
    href: "/settings/business",
    icon: Settings,
    group: "Settings",
  },
  { name: "Billing & Plan", href: "/settings/billing", icon: CreditCard, group: "Settings" },
  {
    name: "Security",
    href: "/settings/security",
    icon: ShieldCheck,
    group: "Settings",
  },
];


export function Sidebar({onClose,className=""}:{onClose?:()=>void;className?:string}){
 const path=usePathname();const {data:session}=useSession();const {theme,setTheme}=useTheme();
 return <aside className={`merchant-sidebar ${className}`}><div className="merchant-brand"><Link href="/" onClick={onClose}><span><Bot size={20}/></span>SellPilot</Link><button onClick={onClose} aria-label="Close navigation"><X size={18}/></button></div><div className="merchant-workspace-label"><span className="merchant-workspace-icon">S</span><div><strong>Merchant workspace</strong><small>{session?.role||"Your business"}</small></div></div><nav aria-label="Workspace navigation">{["Workspace","Commerce","SellPilot AI","Settings"].map(group=>{const items=navigation.filter(item=>item.group===group&&(item.href==="/settings/security"||!item.href.startsWith("/settings/")||session?.role!=="Staff"));return <div key={group}><p>{group}</p>{items.map(item=><Link key={item.href} href={item.href} onClick={onClose} aria-current={path===item.href||path.startsWith(item.href+"/")?"page":undefined}><item.icon size={17}/><span>{item.name}</span></Link>)}</div>;})}</nav><div className="merchant-sidebar-bottom"><div className="merchant-theme" role="group" aria-label="Color theme">{[{value:"light",Icon:Sun},{value:"dark",Icon:Moon},{value:"system",Icon:Monitor}].map(({value,Icon})=><button key={value} onClick={()=>setTheme(value)} aria-label={value+" theme"} aria-pressed={theme===value}><Icon size={14}/><span>{value}</span></button>)}</div><button className="merchant-logout" onClick={()=>signOut({callbackUrl:"/login"})}><LogOut size={16}/>Sign out</button></div></aside>;
}
