import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {withTenantContext} from '../tenancy/context';
import {Product} from '../models/Product';
import {Category} from '../models/Category';
import {Order} from '../models/Order';
import {recordCustomerEvent} from '../intelligence/event-store';
import {productConversion} from '../services/product-conversion.service';
import routes from '../api/products.routes';
async function main(){
 const db=await MongoMemoryServer.create();await mongoose.connect(db.getUri());
 const tenant=new mongoose.Types.ObjectId().toString();const other=new mongoose.Types.ObjectId().toString();
 const context=(businessId:string)=>({businessId,userId:'validation',membershipId:'validation',role:'Owner' as const});
 const app=express();app.use(express.json());app.use((req,res,next)=>{(req as any).auth={role:req.headers['x-test-role']||'Owner'};withTenantContext(context(req.headers['x-other-tenant']?other:tenant),next);});app.use('/api',routes);
 try{await withTenantContext(context(tenant),async()=>{
  const category=await Category.create({name:'Validation',slug:'validation'});
  const p=await Product.create({name:'Validation Hoodie',slug:'validation-hoodie',categoryId:category._id,basePrice:1490,stock:42,description:'Cotton hoodie'});
  const base={customerId:new mongoose.Types.ObjectId(),items:[{productId:p._id,productName:p.name,sku:p.slug,quantity:2,unitPriceSnapshot:1490,subtotal:2980}],subtotal:2980,total:2980,shippingAddress:{fullName:'Validation customer',phone:'01700000000',addressLine1:'Test',city:'Dhaka',zone:'Dhaka',country:'Bangladesh'},paymentMethod:'Cash on Delivery'};
  const delivered=await Order.create({...base,orderNumber:'VALIDATION-DELIVERED',status:'delivered'});
  await Order.create({...base,orderNumber:'VALIDATION-CANCELLED',status:'cancelled'});
  const list=await request(app).get('/api/products?includeInactive=true').expect(200);assert.equal(list.body.data[0].totalSold,2);
  const report=await request(app).get(`/api/products/${p._id}/sales?period=daily`).expect(200);assert.equal(report.body.totalRevenue,2980);assert.equal(report.body.totalOrders,1);assert.equal(report.body.recentOrders.length,2);assert.equal(report.body.conversionRate,null);assert.equal(report.body.series[0].units,2);
  const viewedAt=new Date(Date.now()-60000);
  for(const [externalId,visitorId,sessionId] of [['view-1','visitor1','session1'],['view-2','visitor1','session1'],['view-3','visitor2','session2']])await recordCustomerEvent({type:'product_viewed',source:'website',externalId,visitorId,sessionId,occurredAt:viewedAt,data:{productId:p.slug}});
  await recordCustomerEvent({type:'order_created',source:'checkout',externalId:'attributed-order',visitorId:'visitor1',sessionId:'session1',orderId:String(delivered._id),verified:true});
  assert.equal((await productConversion(String(p._id),p.slug)).conversionRate,50);
  await request(app).patch(`/api/products/${p._id}/ai-selling`).send({status:'disabled'}).expect(400);
  await request(app).patch(`/api/products/${p._id}/ai-selling`).set('x-test-role','Staff').send({status:'disabled',reason:'Out of Stock'}).expect(403);
  await request(app).patch(`/api/products/${p._id}/ai-selling`).send({status:'disabled',reason:'Out of Stock'}).expect(200);
  assert.equal((await Product.findById(p._id))?.aiSellingStatus,'disabled');
  const filtered=await request(app).get('/api/products?aiSellingStatus=disabled').expect(200);assert.equal(filtered.body.data.length,1);
  await request(app).patch(`/api/products/${p._id}/ai-selling`).send({status:'limited'}).expect(200);
  await request(app).patch(`/api/products/${p._id}`).send({aiKnowledge:[{question:'Material?',answer:'Cotton'}]}).expect(200);
  assert.equal((await Product.findById(p._id))?.aiKnowledge[0].answer,'Cotton');
  await request(app).get(`/api/products/${p._id}/sales`).set('x-other-tenant','yes').expect(404);
  await request(app).patch(`/api/products/${p._id}/ai-selling`).set('x-other-tenant','yes').send({status:'active'}).expect(404);
 });console.log('PASS: product sales totals, filtering, status validation, role enforcement, saved knowledge and tenant isolation');}
 finally{await mongoose.disconnect();await db.stop();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
