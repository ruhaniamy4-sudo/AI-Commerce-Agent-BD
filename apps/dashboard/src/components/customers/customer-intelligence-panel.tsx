'use client';
import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {Sparkles,Activity,ShieldCheck,RefreshCw,Clock3,ChevronDown} from 'lucide-react';
import {customerIntelligenceApi} from '@/lib/customer-intelligence';
import './customer-intelligence.css';
export function CustomerIntelligencePanel({customerId,conversationId}:{customerId?:string;conversationId?:string}){
 const [timelineOpen,setTimelineOpen]=useState(false);
 const query=useQuery({queryKey:['customer-intelligence',customerId,conversationId],queryFn:()=>customerId?customerIntelligenceApi.customer(customerId):customerIntelligenceApi.conversation(conversationId!),enabled:!!(customerId||conversationId),refetchInterval:30000});
 const id=customerId||query.data?.customer?.id;
 const timeline=useQuery({queryKey:['customer-timeline',id],queryFn:()=>customerIntelligenceApi.timeline(id!),enabled:!!id&&timelineOpen});
 const value=query.data?.intelligence;
 return <section className="customer-intelligence" aria-label="Customer intelligence"><header><span className="ci-icon"><Sparkles size={18}/></span><div><small>CUSTOMER INTELLIGENCE</small><h3>{query.data?.customer?.name||'Customer insight'}</h3></div><button title="Refresh intelligence" aria-label="Refresh intelligence" onClick={()=>void query.refetch()} disabled={query.isFetching}><RefreshCw size={15} className={query.isFetching?'animate-spin':''}/></button></header>
 {query.isLoading?<p className="ci-empty" role="status">Reading customer activity…</p>:query.isError?<p className="ci-empty" role="alert">Intelligence could not be loaded. Refresh to retry.</p>:!value?<p className="ci-empty">{query.data?.optedOut?'This customer opted out of behavioral profiling.':query.data?.sandbox?'Private test sessions do not affect customer scores.':'Not enough linked customer data yet.'}</p>:<>
 <div className="ci-hero"><div><small>Purchase intent score</small><strong>{value.purchaseIntent===null?'—':value.purchaseIntent}<em>/ 100</em></strong></div><span>{value.customerType}</span></div>
 <div className="ci-meter"><i style={{width:`${value.purchaseIntent||0}%`}}/></div>
 <div className="ci-metrics"><Metric label="Review risk" value={value.risk.level}/><Metric label="Payment trust" value={value.trust.score===null?'No history':`${value.trust.score}/100`}/><Metric label="Delivery success" value={value.delivery.rate===null?'No history':`${value.delivery.rate}%`} detail={`${value.delivery.sampleSize} observed outcomes`}/><Metric label="Previous orders" value={String(value.value.totalOrders)} detail={`${value.value.completedOrders} completed`}/><Metric label="Customer value" value={value.value.score===null?'No history':`${value.value.score}/100`}/><Metric label="Completed sales" value={`৳${value.value.totalSpent.toLocaleString()}`}/></div>
 <div className="ci-recommendation"><Sparkles size={16}/><div><small>RECOMMENDED NEXT STEP</small><strong>{value.recommendation}</strong></div></div>
 <div className="ci-signals"><h4><Activity size={14}/>Signals behind the score</h4>{value.signals.length?value.signals.map(signal=><div key={signal.label}><span>{signal.label}</span><small>{signal.source}</small></div>):<p>No recent buying signals detected.</p>}{value.risk.signals.map(signal=><p key={signal} className="ci-risk">{signal}</p>)}</div>
 <details className="ci-evidence"><summary><ShieldCheck size={13}/>{value.confidence} confidence · {value.evidenceCount} events</summary><p>Fake-customer probability is unavailable: there is no validated fraud model.</p>{value.limitations.map(item=><p key={item}>{item}</p>)}<p>Updated {new Date(value.updatedAt).toLocaleTimeString()} · model {value.version}</p></details>
 </>}
 {id&&<><button className="ci-timeline-toggle" onClick={()=>setTimelineOpen(!timelineOpen)} aria-expanded={timelineOpen}><Clock3 size={15}/>Customer timeline<ChevronDown size={14}/></button>{timelineOpen&&<div className="ci-timeline">{timeline.isLoading?<p>Loading timeline…</p>:timeline.isError?<p>Timeline unavailable.</p>:timeline.data?.data.length?timeline.data.data.map(event=><article key={event._id}><i/><div><strong>{event.type.replaceAll('_',' ')}</strong><p>{event.data?.text||event.data?.orderNumber||event.data?.query||event.data?.productId||event.data?.path||event.source}</p><small>{new Date(event.occurredAt).toLocaleString()} · {event.source}{event.verified?' · verified':''}</small></div></article>):<p>No customer events yet.</p>}</div>}</>}
 </section>;
}
function Metric({label,value,detail}:{label:string;value:string;detail?:string}){return <div><small>{label}</small><strong>{value}</strong>{detail&&<em>{detail}</em>}</div>;}
