import {paymentTrust} from './trust';
import {deliveryEvidence} from './order-events';
export const INTELLIGENCE_VERSION='1.0.0';
export function scoreCustomer(events:any[],orders:any[]=[],now=new Date()){
 const unique=new Map<string,any>();for(const event of events)unique.set(`${event.source}:${event.externalId}:${event.type}`,event);
 const evidence=[...unique.values()];const recent=evidence.filter(e=>now.getTime()-new Date(e.occurredAt).getTime()<30*86400000);
 const messages=recent.filter(e=>e.type==='message_received');const text=messages.map(e=>e.data?.text||'').join(' ').toLowerCase();
 const signals:Array<{label:string;weight:number;source:string}>=[];
 const add=(condition:boolean,label:string,weight:number,source:string)=>{if(condition)signals.push({label,weight,source});};
 add(/\b(price|koto|dam)\b|দাম|মূল্য/.test(text),'Asked about price',15,'conversation');
 add(/\b(stock|available|ache|ase)\b|স্টক|আছে/.test(text),'Checked availability',12,'conversation');
 add(/\b(delivery|shipping|cod)\b|ডেলিভারি/.test(text),'Asked about delivery or payment',15,'conversation');
 add(/\b(order|buy|confirm)\b|অর্ডার/.test(text),'Requested an order',28,'conversation');
 add(recent.some(e=>e.type==='product_viewed'),'Viewed products',5,'website');
 add(recent.some(e=>e.type==='product_searched'),'Searched products',5,'website');
 add(recent.some(e=>e.type==='cart_added'),'Added a product to cart',12,'website');
 add(recent.some(e=>e.type==='checkout_started'),'Started checkout',15,'website');
 const trust=paymentTrust(evidence);const delivery=deliveryEvidence(evidence);
 const completed=orders.filter(o=>['delivered','completed'].includes(o.status));
 const spend=completed.reduce((sum,o)=>sum+Math.max(0,Number(o.total)||0),0);
 add(completed.length>0,'Previous completed order',8,'orders');
 const purchaseIntent=recent.length?Math.min(100,signals.reduce((sum,s)=>sum+s.weight,0)):null;
 const repetitions=new Map<string,number>();for(const message of messages){const value=String(message.data?.text||'').trim().toLowerCase();if(value.length>5)repetitions.set(value,(repetitions.get(value)||0)+1);}
 const riskSignals:string[]=[];if([...repetitions.values()].some(count=>count>=10))riskSignals.push('Repeated identical messages; review for spam');
 if(trust.codReturns>=2)riskSignals.push('Multiple confirmed COD returns');
 const risk=riskSignals.length>=2?'High':riskSignals.length?'Medium':messages.length||trust.sampleSize?'Low':'Unknown';
 const customerType=completed.length>=5?'Repeat customer':purchaseIntent!==null&&purchaseIntent>=65?'Potential buyer':messages.length?'Interested customer':'New customer';
 const lastInbound=messages.reduce((last,e)=>Math.max(last,new Date(e.occurredAt).getTime()),0);
 const recommendation=risk==='High'?'Review order and consider advance payment':completed.length>=5?'Prioritize this repeat customer':purchaseIntent!==null&&purchaseIntent>=65?'Follow up now':lastInbound&&now.getTime()-lastInbound>86400000?'Schedule a follow-up':'Continue the conversation';
 const replies=recent.filter(e=>e.type==='message_sent'&&typeof e.data?.responseMs==='number');
 return {version:INTELLIGENCE_VERSION,updatedAt:now.toISOString(),purchaseIntent,customerType,signals,risk:{level:risk,signals:riskSignals,fakeProbability:null,method:'Review indicators, not a validated fraud prediction'},delivery,trust,value:{score:completed.length?Math.min(100,completed.length*12+Math.round(Math.log10(1+spend)*8)):null,completedOrders:completed.length,totalOrders:orders.length,totalSpent:spend,currency:'BDT'},recommendation,evidenceCount:evidence.length,confidence:evidence.length>=20?'high':evidence.length>=5?'medium':'low',averageResponseMs:replies.length?Math.round(replies.reduce((n,e)=>n+e.data.responseMs,0)/replies.length):null,channels:[...new Set(messages.map(e=>e.source))],lastInboundAt:lastInbound?new Date(lastInbound).toISOString():null,limitations:['Purchase intent and value are rule-based scores, not calibrated probabilities.','Delivery reflects this merchant’s observed completed/returned shipments.','No cross-merchant identity matching or location-based risk inference.']};
}
