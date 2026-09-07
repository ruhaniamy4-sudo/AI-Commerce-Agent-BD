import mongoose from 'mongoose';
import {CustomerEvent} from '../models/CustomerEvent';
import {Order} from '../models/Order';
export async function productConversion(productId:string,slug:string){
 const since=new Date(Date.now()-30*86400000);
 const visits=await CustomerEvent.aggregate([{$match:{type:'product_viewed',source:'website',occurredAt:{$gte:since},'data.productId':{$in:[productId,slug]},visitorId:{$type:'string'},sessionId:{$type:'string'}}},{$group:{_id:{visitorId:'$visitorId',sessionId:'$sessionId'},firstViewedAt:{$min:'$occurredAt'}}}]);
 const note='Last 30 days: tracked visitor sessions with this product viewed and a subsequent linked checkout containing it. Cancelled, returned and refunded orders are excluded.';
 if(!visits.length)return {conversionRate:null,conversionNote:'No attributed product visits yet. '+note};
 const checkouts=await CustomerEvent.find({source:'checkout',type:'order_created',verified:true,sessionId:{$in:visits.map(v=>v._id.sessionId)},occurredAt:{$gte:since}}).select('visitorId sessionId orderId occurredAt').lean();
 const orders=await Order.find({_id:{$in:checkouts.filter(c=>c.orderId).map(c=>String(c.orderId))},'items.productId':new mongoose.Types.ObjectId(productId),status:{$nin:['cancelled','returned']},paymentStatus:{$ne:'refunded'}}).select('_id').lean();
 const validOrders=new Set(orders.map(o=>String(o._id)));
 const converted=visits.filter(v=>checkouts.some(c=>c.visitorId===v._id.visitorId&&c.sessionId===v._id.sessionId&&c.occurredAt>=v.firstViewedAt&&validOrders.has(String(c.orderId)))).length;
 return {conversionRate:Math.round(converted/visits.length*1000)/10,conversionNote:`${converted} converted / ${visits.length} tracked sessions. ${note}`};
}
