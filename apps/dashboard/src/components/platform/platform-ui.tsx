'use client';
import {useId} from 'react';
import {ArrowDownRight,ArrowUpRight} from 'lucide-react';
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
