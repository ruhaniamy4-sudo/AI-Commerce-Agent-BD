import crypto from 'node:crypto';
import { CustomerVisit } from '../models/CustomerVisit';
import { CustomerEvent } from '../models/CustomerEvent';
import { BROWSER_EVENTS, CustomerEventType } from './events';
import { recordCustomerEvent } from './event-store';
export const hashVisit=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
export function browserPayload(body:any) {
  if (!BROWSER_EVENTS.includes(body?.type) || typeof body?.eventId!=='string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.eventId)) throw new Error('Invalid browser event');
  const data:Record<string,string>={};
  for(const key of ['path','productId','query']) if(typeof body.data?.[key]==='string') data[key]=body.data[key].split('?')[0].slice(0,200);
  return {type:body.type as CustomerEventType,externalId:body.eventId,data};
}
export async function findVisit(token:unknown) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
  return CustomerVisit.findOne({tokenHash:hashVisit(token),expiresAt:{$gt:new Date()}});
}
export async function linkVisit(token:unknown,customerId:string,orderId:string){
  const visit=await findVisit(token);if(!visit)return;
  // A checkout proves association with this visit, not verified phone ownership.
  if(visit.customerId&&String(visit.customerId)!==customerId)return;
  visit.customerId=customerId as any;visit.purchasedAt=new Date();await visit.save();
  await CustomerEvent.updateMany({visitorId:visit.visitorId,customerId:{$exists:false}},{$set:{customerId},$unset:{expiresAt:1}});
  await recordCustomerEvent({type:'order_created',source:'checkout',externalId:orderId,customerId,orderId,visitorId:visit.visitorId,sessionId:visit.sessionId,verified:true});
}
export async function reconcileAbandonedCheckouts(){
  const visits=await CustomerVisit.find({checkoutAt:{$lt:new Date(Date.now()-30*60000)},purchasedAt:{$exists:false}}).limit(500);
  for(const visit of visits)await recordCustomerEvent({type:'checkout_abandoned',source:'website',externalId:`abandoned:${visit.sessionId}`,visitorId:visit.visitorId,sessionId:visit.sessionId,customerId:visit.customerId?.toString(),occurredAt:visit.checkoutAt!});
  return visits.length;
}
