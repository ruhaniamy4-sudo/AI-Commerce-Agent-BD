import 'dotenv/config';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {withTenantContext} from '../tenancy/context';
import {Customer} from '../models/Customer';
import {CustomerEvent} from '../models/CustomerEvent';
import {CustomerIntelligence} from '../models/CustomerIntelligence';
import {CustomerAction} from '../models/CustomerAction';
import {CustomerVisit} from '../models/CustomerVisit';
import {Conversation} from '../models/Conversation';
import {Message} from '../models/Message';
import {Order} from '../models/Order';
import {recordCustomerEvent} from '../intelligence/event-store';
import {refreshCustomerIntelligence} from '../intelligence/customer-intelligence';
import intelligenceRoutes from '../api/intelligence.routes';
import trackingRoutes from '../api/tracking.routes';
import {linkVisit} from '../intelligence/tracking';
import {MongoMemoryServer} from 'mongodb-memory-server';

async function main(){
 // Ephemeral local MongoDB; never touches the application's configured database.
 const database=await MongoMemoryServer.create();
 await mongoose.connect(database.getUri());
 const tenants=[new mongoose.Types.ObjectId().toString(),new mongoose.Types.ObjectId().toString()];
 const context=(businessId:string)=>({businessId,userId:'intelligence-validation',membershipId:'validation',role:'Owner' as const});
 const models=[Customer,CustomerEvent,CustomerIntelligence,CustomerAction,CustomerVisit,Conversation,Message,Order] as any[];
 try{
  await CustomerEvent.init();await CustomerAction.init();
  await withTenantContext(context(tenants[0]),async()=>{
   const customer=await Customer.create({psid:'validation-customer',name:'Isolated validation customer'});const customerId=String(customer._id);
   const app=express();app.use(express.json());app.use((_req,_res,next)=>withTenantContext(context(tenants[0]),next));app.use('/tracking',trackingRoutes);app.use('/api',intelligenceRoutes);
   const session=await request(app).post('/tracking/session').send({}).expect(201);const token=session.body.token;
   await request(app).post('/tracking/events').send({token,type:'product_viewed',eventId:'validation-view',data:{productId:'hoodie'}}).expect(202);
   await request(app).post('/tracking/events').send({token,type:'payment_completed',eventId:'validation-forged',data:{amount:10000}}).expect(400);
   await request(app).post('/tracking/events').send({token:'wrong',type:'page_viewed',eventId:'validation-wrong'}).expect(401);
   const order=await Order.create({orderNumber:'VALIDATION-ORDER',customerId,items:[{productId:new mongoose.Types.ObjectId(),productName:'Validation hoodie',sku:'V1',quantity:1,unitPriceSnapshot:1490,subtotal:1490}],subtotal:1490,deliveryFee:0,discount:0,total:1490,shippingAddress:{fullName:'Validation',phone:'01700000000',addressLine1:'Isolated test',city:'Dhaka',zone:'Dhaka',country:'Bangladesh'},paymentMethod:'Cash on Delivery',status:'pending',source:'web'});
   await linkVisit(token,customerId,String(order._id));
   const inquiry={type:'message_received' as const,source:'facebook',externalId:'validation-msg',customerId,verified:true,data:{text:'price koto stock ache delivery cod order confirm'}};
   await Promise.all(Array.from({length:5},()=>recordCustomerEvent(inquiry)));
   assert.equal(await CustomerEvent.countDocuments({type:'message_received'}),1);
   await recordCustomerEvent({type:'payment_completed',source:'stripe',externalId:'pi-validation',customerId,orderId:String(order._id),verified:true,data:{amount:1490,environment:'live'}});
   await recordCustomerEvent({type:'delivery_completed',source:'steadfast',externalId:'validation-delivery',customerId,orderId:String(order._id),verified:true});
   const result=await request(app).get(`/api/customers/${customerId}/intelligence`).expect(200);
   assert.ok(result.body.intelligence.purchaseIntent>=65);assert.equal(result.body.intelligence.delivery.rate,100);assert.equal(result.body.intelligence.delivery.sampleSize,1);assert.equal(result.body.intelligence.trust.successfulPayments,1);
   assert.equal(await CustomerAction.countDocuments({type:'high_intent'}),1);
   await refreshCustomerIntelligence(customerId);assert.equal(await CustomerAction.countDocuments({type:'high_intent'}),1);
   const timeline=await request(app).get(`/api/customers/${customerId}/timeline`).expect(200);assert.ok(timeline.body.data.some((e:any)=>e.type==='product_viewed'));
   await withTenantContext(context(tenants[1]),async()=>{assert.equal(await CustomerEvent.countDocuments({}),0);assert.equal(await refreshCustomerIntelligence(customerId),null);await assert.rejects(()=>recordCustomerEvent(inquiry));});
   await Customer.updateOne({_id:customerId},{$set:{optedOut:true}});const before=await CustomerEvent.countDocuments({});await recordCustomerEvent({...inquiry,externalId:'opted-out'});assert.equal(await CustomerEvent.countDocuments({}),before);assert.equal((await refreshCustomerIntelligence(customerId))?.intelligence,null);
  });
  console.log('PASS: real MongoDB journey, API tracking, forged-event rejection, checkout linking, deduplication, scoring, actions, tenant isolation and opt-out');
 }finally{
  for(const tenant of tenants)await withTenantContext(context(tenant),async()=>{for(const model of models)await model.deleteMany({});});
  await mongoose.disconnect();
  await database.stop();
 }
}
main().catch((error)=>{console.error('Customer intelligence integration validation failed:',String(error?.message||error).replace(/mongodb[^\s]+/g,'[database URI]'));process.exitCode=1;});
