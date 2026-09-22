'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {Activity,BadgeDollarSign,Bell,Bot,BookOpenCheck,Boxes,Building2,CircleAlert,CreditCard,FileText,Flag,Globe2,HeartPulse,LayoutDashboard,LifeBuoy,ListChecks,LogOut,Megaphone,Menu,MessageSquareCode,PlugZap,ReceiptText,Rocket,ScrollText,Settings,ShieldCheck,Tags,Timer,Users,UsersRound,X,type LucideIcon} from 'lucide-react';
import {useState} from 'react';
import {cn} from '@/lib/utils';
import {ThemeToggle} from './theme-toggle';
import {usePlatformIdentity} from '@/components/platform/platform-session';

type NavItem={name:string;href:string;icon:LucideIcon;permission:string};
/**
 * The console's information architecture. Each item declares the permission that
 * governs its page, and the sidebar hides what the signed-in role cannot open — so
 * the menu is never an invitation to a 403.
 */
const GROUPS:Array<{label:string;items:NavItem[]}>=[
 {label:'Command center',items:[
  {name:'Overview',href:'/platform-admin',icon:LayoutDashboard,permission:'dashboard.view'},
  {name:'Live operations',href:'/platform-admin/support',icon:Activity,permission:'dashboard.view'},
  {name:'Announcements',href:'/platform-admin/announcements',icon:Megaphone,permission:'dashboard.view'},
 ]},
 {label:'Merchants',items:[
  {name:'Businesses',href:'/platform-admin/businesses',icon:Building2,permission:'merchants.view'},
  {name:'Users',href:'/platform-admin/users',icon:Users,permission:'users.view'},
  {name:'Onboarding',href:'/platform-admin/onboarding',icon:Rocket,permission:'merchants.view'},
  {name:'Catalog oversight',href:'/platform-admin/catalog',icon:Boxes,permission:'catalog.view'},
 ]},
 {label:'Revenue',items:[
  {name:'Subscriptions',href:'/platform-admin/subscriptions',icon:CreditCard,permission:'billing.view'},
  {name:'Payments',href:'/platform-admin/payments',icon:ReceiptText,permission:'billing.view'},
  {name:'Coupons',href:'/platform-admin/coupons',icon:Tags,permission:'billing.view'},
  {name:'Revenue',href:'/platform-admin/revenue',icon:BadgeDollarSign,permission:'billing.view'},
  {name:'Tax & currency',href:'/platform-admin/localization',icon:Globe2,permission:'settings.view'},
 ]},
 {label:'AI & intelligence',items:[
  {name:'AI control',href:'/platform-admin/ai-control',icon:Bot,permission:'ai.view'},
  {name:'Model & routing',href:'/platform-admin/ai-config',icon:MessageSquareCode,permission:'ai.view'},
  {name:'Prompt library',href:'/platform-admin/prompts',icon:FileText,permission:'ai.view'},
  {name:'AI usage',href:'/platform-admin/usage',icon:Activity,permission:'ai.view'},
 ]},
 {label:'Channels',items:[
  {name:'Integration health',href:'/platform-admin/integrations',icon:ShieldCheck,permission:'integrations.view'},
  {name:'Providers',href:'/platform-admin/providers',icon:PlugZap,permission:'integrations.view'},
 ]},
 {label:'Operations',items:[
  {name:'Platform health',href:'/platform-admin/health',icon:HeartPulse,permission:'ops.view'},
  {name:'Background jobs',href:'/platform-admin/jobs',icon:Timer,permission:'ops.view'},
  {name:'Errors',href:'/platform-admin/errors',icon:CircleAlert,permission:'ops.view'},
 ]},
 {label:'Governance',items:[
  {name:'Audit log',href:'/platform-admin/audit',icon:BookOpenCheck,permission:'audit.view'},
  {name:'Data & privacy',href:'/platform-admin/compliance',icon:ScrollText,permission:'compliance.view'},
  {name:'Admin team',href:'/platform-admin/team',icon:UsersRound,permission:'team.view'},
  {name:'Security',href:'/platform-admin/security',icon:LifeBuoy,permission:'settings.view'},
 ]},
 {label:'Configuration',items:[
  {name:'Settings',href:'/platform-admin/settings',icon:Settings,permission:'settings.view'},
  {name:'Feature flags',href:'/platform-admin/flags',icon:Flag,permission:'settings.view'},
  {name:'Notifications',href:'/platform-admin/notifications',icon:Bell,permission:'settings.view'},
 ]},
];

const isCurrent=(pathname:string,href:string)=>pathname===href||(href!=='/platform-admin'&&pathname.startsWith(href));
const initials=(name?:string)=>(name||'SellPilot').split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'SP';

export function PlatformShell({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const {data:identity}=usePlatformIdentity();
 const held=identity?.permissions;
 // Before `me` resolves the whole menu is shown rather than flashing empty; the
 // API is the real gate, and the list settles as soon as the role is known.
 const allowed=(permission:string)=>!held||held.includes('*')||held.includes(permission);
 const groups=GROUPS.map(group=>({...group,items:group.items.filter(item=>allowed(item.permission))})).filter(group=>group.items.length);
 const current=groups.flatMap(group=>group.items).find(item=>isCurrent(pathname,item.href))?.name||'Overview';

 async function logout(){
  await fetch('/api/platform-auth/logout',{method:'POST'});
  router.push('/login?access=admin');
  router.refresh();
 }

 return <div className="platform-frame">
  <div className={cn('platform-nav-wrap',open&&'is-open')}>
   <aside className="platform-sidebar">
    <div className="platform-brand">
     <Link href="/platform-admin"><span><Bot size={20}/></span><div><strong>SellPilot</strong><small>Platform OS</small></div></Link>
     <button onClick={()=>setOpen(false)} aria-label="Close menu"><X size={17}/></button>
    </div>
    <div className="platform-environment"><i/><span><strong>{identity?.role?`${identity.role} access`:'Platform operations'}</strong><small>{identity?.email||'Live operational data'}</small></span><ListChecks size={14}/></div>
    <nav>{groups.map(group=><section key={group.label}>
     <p>{group.label}</p>
     {group.items.map(({name,href,icon:Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={isCurrent(pathname,href)?'page':undefined}><Icon size={16}/><span>{name}</span></Link>)}
    </section>)}</nav>
    <button className="platform-logout" onClick={logout}><LogOut size={16}/>Sign out</button>
   </aside>
  </div>
  {open&&<button className="platform-scrim" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
  <div className="platform-workspace">
   <header className="platform-topbar">
    <div><button className="platform-menu" onClick={()=>setOpen(true)} aria-label="Open navigation"><Menu size={19}/></button><span>Platform</span><b>/</b><strong>{current}</strong></div>
    <div className="platform-top-actions"><span>{identity?.name||'Internal operations'}</span><ThemeToggle/><span className="platform-admin-avatar">{initials(identity?.name)}</span></div>
   </header>
   <main>{children}</main>
  </div>
 </div>;
}
