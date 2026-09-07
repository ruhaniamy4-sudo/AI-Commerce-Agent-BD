import {EventInput} from './events';
export function orderEvents(order:any):EventInput[]{
 if(!order.customerId)return [];
 const base={source:'orders',externalId:String(order._id),customerId:String(order.customerId),orderId:String(order._id),data:{orderNumber:order.orderNumber,amount:order.total,currency:'BDT',paymentMethod:order.paymentMethod},verified:false};
 const events:EventInput[]=[{...base,type:'order_created',occurredAt:new Date(order.createdAt)}];
 const state=order.courier?.creationStatus==='created'?order.courier.status:null;
 const type=state==='delivered'?'delivery_completed':state==='returned'?'delivery_returned':state==='cancelled'?'delivery_cancelled':null;
 if(type)events.push({...base,type,source:order.courier.provider,externalId:String(order._id),occurredAt:new Date(order.courier.lastSyncedAt||order.updatedAt),verified:true});
 return events;
}
export function deliveryEvidence(events:any[]){
 const outcomes=new Map<string,any>();
 for(const event of events){if(!event.verified||!event.orderId||!['delivery_completed','delivery_returned'].includes(event.type))continue;const key=String(event.orderId);const prior=outcomes.get(key);if(!prior||new Date(event.occurredAt)>=new Date(prior.occurredAt))outcomes.set(key,event);}
 const delivered=[...outcomes.values()].filter(e=>e.type==='delivery_completed').length;
 return {delivered,returned:outcomes.size-delivered,sampleSize:outcomes.size,rate:outcomes.size?Math.round(delivered/outcomes.size*100):null,confidence:outcomes.size>=20?'high':outcomes.size>=5?'medium':'low',label:'Observed delivery success rate'};
}
