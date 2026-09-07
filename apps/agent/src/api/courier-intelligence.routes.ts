import {Router} from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {IntelligenceIntegration} from '../models/IntelligenceIntegration';
import {Order} from '../models/Order';
import {decryptMetaAccessToken} from '../services/meta-credentials.service';
import {withTenantContext} from '../tenancy/context';
import {recordCustomerEvent} from '../intelligence/event-store';
const router=Router();
router.post('/pathao/:integrationId',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.integrationId))return res.sendStatus(404);
 const integration=await IntelligenceIntegration.findOne({_id:req.params.integrationId,provider:'pathao',enabled:true}).select('+credentials');if(!integration)return res.sendStatus(404);
 const credentials=JSON.parse(decryptMetaAccessToken(integration.credentials));const supplied=String(req.headers['x-pathao-signature']||'');const secret=String(credentials.webhookSecret||'');
 if(!secret||Buffer.byteLength(secret)!==Buffer.byteLength(supplied)||!crypto.timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))return res.sendStatus(403);
 if(req.body?.event==='webhook_integration')return res.status(202).json({accepted:true});
 return withTenantContext({businessId:String(integration.businessId),userId:'pathao',membershipId:'pathao',role:'Staff'},async()=>{
  const order=await Order.findOne({orderNumber:String(req.body?.merchant_order_id||'')});if(!order)return res.sendStatus(404);
  const state=String(req.body?.order_status||'').toLowerCase();const type=state==='delivered'?'delivery_completed':state==='returned'?'delivery_returned':state==='cancelled'?'delivery_cancelled':null;
  if(type)await recordCustomerEvent({type,source:'pathao',externalId:String(order._id),customerId:String(order.customerId),orderId:String(order._id),verified:true,data:{consignmentId:String(req.body?.consignment_id||'').slice(0,100)}});
  res.status(202).json({accepted:true});
 });
});
export default router;
