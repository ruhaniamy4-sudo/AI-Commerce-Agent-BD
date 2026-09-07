import {apiClient} from './api-client';
export interface CustomerInsight {
 customer?:{id:string;name?:string;phone?:string;email?:string};optedOut?:boolean;sandbox?:boolean;
 intelligence:null|{version:string;updatedAt:string;purchaseIntent:number|null;customerType:string;confidence:string;evidenceCount:number;recommendation:string;signals:Array<{label:string;source:string;weight:number}>;risk:{level:string;signals:string[];fakeProbability:number|null};delivery:{rate:number|null;sampleSize:number;delivered:number;returned:number};trust:{score:number|null;successfulPayments:number;failedPayments:number;refunds:number};value:{score:number|null;totalOrders:number;completedOrders:number;totalSpent:number};channels:string[];averageResponseMs:number|null;limitations:string[]};
}
export interface TimelineEvent{_id:string;type:string;source:string;occurredAt:string;verified:boolean;data?:{text?:string;orderNumber?:string;amount?:number;query?:string;productId?:string;path?:string;delivery?:string};}
export const customerIntelligenceApi={customer:(id:string)=>apiClient.get<CustomerInsight>(`/api/customers/${encodeURIComponent(id)}/intelligence`),conversation:(id:string)=>apiClient.get<CustomerInsight>(`/api/conversations/${encodeURIComponent(id)}/intelligence`),timeline:(id:string)=>apiClient.get<{data:TimelineEvent[]}>(`/api/customers/${encodeURIComponent(id)}/timeline`)};
