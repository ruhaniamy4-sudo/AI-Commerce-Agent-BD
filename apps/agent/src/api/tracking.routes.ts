import {Router} from 'express';
import crypto from 'node:crypto';
import {CustomerVisit} from '../models/CustomerVisit';
import {recordCustomerEvent} from '../intelligence/event-store';
import {browserPayload,findVisit,hashVisit} from '../intelligence/tracking';
import {authRateLimit} from '../auth/rate-limit';
const router=Router();
router.use(authRateLimit({limit:120,windowMs:60000}));
router.post('/session',async(req,res)=>{
  const existing=await findVisit(req.body?.token);
  if(existing){if(!existing.lastSeenAt||Date.now()-existing.lastSeenAt.getTime()>30*60000){existing.sessionId=crypto.randomUUID();existing.checkoutAt=undefined;existing.purchasedAt=undefined;await recordCustomerEvent({type:'session_started',source:'website',externalId:existing.sessionId,visitorId:existing.visitorId,sessionId:existing.sessionId,customerId:existing.customerId?.toString()});}existing.lastSeenAt=new Date();await existing.save();return res.json({token:req.body.token});}
  const token=crypto.randomBytes(32).toString('hex');const visitorId=crypto.randomUUID();const sessionId=crypto.randomUUID();
  await CustomerVisit.create({tokenHash:hashVisit(token),visitorId,sessionId,lastSeenAt:new Date(),expiresAt:new Date(Date.now()+90*86400000)});
  for(const type of ['visitor_started','session_started'] as const)await recordCustomerEvent({type,source:'website',externalId:sessionId,visitorId,sessionId});
  res.status(201).json({token});
});
router.post('/events',async(req,res)=>{
  let event;try{event=browserPayload(req.body);}catch{return res.status(400).json({error:'Invalid browser event'});}
  const visit=await findVisit(req.body?.token);if(!visit)return res.status(401).json({error:'Tracking session expired'});
  await recordCustomerEvent({...event,source:'website',visitorId:visit.visitorId,sessionId:visit.sessionId,customerId:visit.customerId?.toString(),verified:false});
  visit.lastSeenAt=new Date();if(event.type==='checkout_started')visit.checkoutAt=new Date();await visit.save();
  res.status(202).json({accepted:true});
});
export default router;
