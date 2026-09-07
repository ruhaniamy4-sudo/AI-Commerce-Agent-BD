import mongoose from 'mongoose';
import {Order} from '../models/Order';
import {Product} from '../models/Product';
import {productConversion} from './product-conversion.service';
export const completedSaleFilter={status:{$in:['delivered','completed']},paymentStatus:{$ne:'refunded'}};
export async function productSoldCounts(ids:mongoose.Types.ObjectId[]){
 return Order.aggregate([{$match:{...completedSaleFilter,'items.productId':{$in:ids}}},{$unwind:'$items'},{$match:{'items.productId':{$in:ids}}},{$group:{_id:'$items.productId',units:{$sum:'$items.quantity'}}}]);
}
export async function productSalesReport(id:string,period:'daily'|'weekly'|'monthly'){
 const productId=new mongoose.Types.ObjectId(id);const since=new Date();since.setUTCHours(0,0,0,0);since.setUTCDate(since.getUTCDate()-(period==='monthly'?365:period==='weekly'?84:29));
 const rows=await Order.aggregate([{$match:{'items.productId':productId}},{$facet:{
 summary:[{$match:completedSaleFilter},{$unwind:'$items'},{$match:{'items.productId':productId}},{$group:{_id:null,totalSold:{$sum:'$items.quantity'},totalRevenue:{$sum:'$items.subtotal'},orderIds:{$addToSet:'$_id'}}}],
 series:[{$match:{...completedSaleFilter,createdAt:{$gte:since}}},{$unwind:'$items'},{$match:{'items.productId':productId}},{$group:{_id:{$dateToString:{date:'$createdAt',format:period==='monthly'?'%Y-%m':period==='weekly'?'%G-W%V':'%Y-%m-%d',timezone:'Asia/Dhaka'}},units:{$sum:'$items.quantity'}}},{$sort:{_id:1}}],
 recentOrders:[{$sort:{createdAt:-1}},{$limit:10},{$project:{orderNumber:1,status:1,createdAt:1,customer:'$shippingAddress.fullName',items:{$filter:{input:'$items',as:'item',cond:{$eq:['$$item.productId',productId]}}}}}]
 }}]);
 const product=await Product.findById(productId).select('slug').lean();const conversion=await productConversion(id,product?.slug||id);
 const result=rows[0];const summary=result.summary[0];return {totalSold:summary?.totalSold||0,totalRevenue:summary?.totalRevenue||0,totalOrders:summary?.orderIds.length||0,...conversion,basis:'Delivered/completed orders, excluding refunded orders. Item revenue before order-level discounts, shipping and tax.',series:result.series.map((r:any)=>({date:r._id,units:r.units})),recentOrders:result.recentOrders.map((r:any)=>({...r,quantity:r.items.reduce((n:number,i:any)=>n+i.quantity,0),amount:r.items.reduce((n:number,i:any)=>n+i.subtotal,0)}))};
}
