import axios from 'axios';
import mongoose from 'mongoose';
import {IntelligenceIntegration} from '../models/IntelligenceIntegration';
import {CourierObservation} from '../models/CourierObservation';
import {Order} from '../models/Order';
import {requireTenantContext} from '../tenancy/context';
import {decryptMetaAccessToken} from '../services/meta-credentials.service';
import {recordCustomerEvent} from './event-store';
export function redxOutcome(data:any,reference:string,orderNumber:string){
 const parcel=data?.parcel;if(parcel?.tracking_id!==reference||parcel?.merchant_invoice_id!==orderNumber)throw new Error('Parcel does not match this order');
 return parcel.status==='delivered'?'delivery_completed':parcel.status==='returned'?'delivery_returned':parcel.status==='cancelled'?'delivery_cancelled':null;
}
export async function syncRedx(orderId:string,reference:string){
 if(!/^[a-zA-Z0-9-]{5,100}$/.test(reference))throw new Error('Invalid tracking reference');
 const integration=await IntelligenceIntegration.findOne({businessId:requireTenantContext().businessId,provider:'redx',enabled:true}).select('+credentials');if(!integration)throw new Error('RedX is not configured');
 const order=await Order.findOne(mongoose.isValidObjectId(orderId)?{_id:orderId}:{orderNumber:orderId});if(!order)throw new Error('Order not found');orderId=String(order._id);
 const credentials=JSON.parse(decryptMetaAccessToken(integration.credentials));const live=credentials.environment==='live';const host=live?'openapi.redx.com.bd':'sandbox.redx.com.bd';
 const {data}=await axios.get(`https://${host}/v1.0.0-beta/parcel/info/${encodeURIComponent(reference)}`,{timeout:15000,headers:{'API-ACCESS-TOKEN':`Bearer ${credentials.accessToken}`}});
 const type=redxOutcome(data,reference,order.orderNumber);const existing=await CourierObservation.findOne({provider:'redx',reference});if(existing&&String(existing.orderId)!==orderId)throw new Error('Parcel already linked to another order');
 await CourierObservation.findOneAndUpdate({provider:'redx',reference},{$set:{businessId:requireTenantContext().businessId,orderId,status:data.parcel.status,lastSyncedAt:new Date()}},{upsert:true});
 if(type)await recordCustomerEvent({type,source:'redx',externalId:reference,orderId,customerId:String(order.customerId),verified:live,data:{reference,paymentMethod:order.paymentMethod,environment:live?'live':'sandbox'}});
 return {status:data.parcel.status,verified:live};
}
