'use client';
import {useId} from 'react';
import {ArrowDownRight,ArrowUpRight,Download} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {cn} from '@/lib/utils';
export const money=(value?:number)=>`${Number(value||0).toLocaleString('en-US')} BDT`;
export function PageHeading({eyebrow,title,copy,actions}:{eyebrow?:string;title:string;copy:string;actions?:React.ReactNode}){return <header className="platform-page-heading"><div>{eyebrow&&<p>{eyebrow}</p>}<h1>{title}</h1><span>{copy}</span></div>{actions&&<aside>{actions}</aside>}</header>}
export function StatCard({label,value,change,detail,tone='violet'}:{label:string;value:string|number;change?:number|null;detail?:string;tone?:'violet'|'blue'|'green'|'amber'}){return <article className={cn('platform-stat',`tone-${tone}`)}><div><span>{label}</span></div><strong>{typeof value==='number'?value.toLocaleString():value}</strong><footer>{typeof change==='number'&&<em className={change>=0?'up':'down'}>{change>=0?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>} {Math.abs(change).toFixed(1)}%</em>}<small>{detail}</small></footer></article>}
export function Panel({title,copy,action,children,className}:{title:string;copy?:string;action?:React.ReactNode;children:React.ReactNode;className?:string}){return <section className={cn('platform-panel',className)}><header><div><h2>{title}</h2>{copy&&<p>{copy}</p>}</div>{action}</header><div className="platform-panel-body">{children}</div></section>}
export function Status({children,tone='neutral'}:{children:React.ReactNode;tone?:'success'|'warning'|'danger'|'info'|'neutral'}){return <span className={cn('platform-status',tone)}><i/>{children}</span>}
export function Empty({children}:{children:React.ReactNode}){return <div className="platform-empty">{children}</div>}
export function RevenueChart({rows,color='var(--pa-series)'}:{rows:Array<{_id:string;value:number}>;color?:string}){
 // Each chart needs its own gradient id, or two charts on a page share the
 // first one's colour — visible the moment the series colours differ.
 const fillId=`chartFill-${useId().replace(/:/g,'')}`;
 return <div className="platform-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={rows}><defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.34}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--pa-line-soft)"/><XAxis dataKey="_id" tickFormatter={v=>String(v).slice(5)} axisLine={false} tickLine={false} tick={{fill:'var(--pa-muted)',fontSize:10}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--pa-muted)',fontSize:10}} width={42}/><Tooltip contentStyle={{background:'var(--pa-panel)',border:'1px solid var(--pa-line-strong)',color:'var(--pa-text)',borderRadius:12,fontSize:11}} labelStyle={{color:'var(--pa-muted)'}} itemStyle={{color:'var(--pa-text)'}}/><Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${fillId})`}/></AreaChart></ResponsiveContainer></div>;
}

/** A row of filters and actions that sits in a panel header. */
export function Toolbar({children}:{children:React.ReactNode}){return <div className="platform-toolbar">{children}</div>}

/** A labelled control. `wide` spans the whole form grid, for text areas and JSON. */
export function Field({label,hint,wide,children}:{label:string;hint?:string;wide?:boolean;children:React.ReactNode}){
 return <div className="platform-form-field" style={wide?{gridColumn:'1 / -1'}:undefined}><label>{label}</label>{children}{hint&&<small className="platform-hint">{hint}</small>}</div>;
}

export function Toggle({checked,onChange,label,disabled}:{checked:boolean;onChange:(value:boolean)=>void;label:string;disabled?:boolean}){
 return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={cn('platform-toggle',checked&&'is-on')} onClick={()=>onChange(!checked)}><i/></button>;
}

/** Paging for the cross-tenant tables, which are the only lists long enough to need it. */
export function Pager({page,totalPages,total,onPage}:{page:number;totalPages:number;total:number;onPage:(page:number)=>void}){
 if (totalPages<=1) return <div className="platform-pager"><span>{total.toLocaleString()} records</span></div>;
 return <div className="platform-pager"><span>{total.toLocaleString()} records · page {page} of {totalPages}</span><div><button disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</button><button disabled={page>=totalPages} onClick={()=>onPage(page+1)}>Next</button></div></div>;
}

export function TabBar<T extends string>({tabs,active,onChange}:{tabs:Array<[T,string]>;active:T;onChange:(tab:T)=>void}){
 return <div className="platform-tabs" role="tablist">{tabs.map(([value,label])=><button key={value} role="tab" aria-selected={active===value} onClick={()=>onChange(value)}>{label}</button>)}</div>;
}

/** Exports are a streamed file download, so this is a link rather than a fetch. */
export function ExportLink({href,label='Export CSV'}:{href:string;label?:string}){
 return <a className="platform-control platform-export" href={href} download><Download size={13}/> {label}</a>;
}

export const percent=(value?:number|null)=>value==null?'—':`${Math.round(value)}%`;
export const dateTime=(value?:string|number|null)=>value?new Date(value).toLocaleString():'—';
export const dateOnly=(value?:string|null)=>value?new Date(value).toLocaleDateString():'—';
/** Relative age, for feeds where "3h" reads faster than a timestamp. */
export function since(value?:string|number|null){
 if(!value)return '—';
 const minutes=Math.floor((Date.now()-new Date(value).getTime())/60000);
 if(minutes<1)return 'Now';
 if(minutes<60)return `${minutes}m`;
 if(minutes<1440)return `${Math.floor(minutes/60)}h`;
 return `${Math.floor(minutes/1440)}d`;
}
