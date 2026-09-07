import axios from 'axios';
import {IntelligenceIntegration} from '../models/IntelligenceIntegration';
import {Order} from '../models/Order';
import {decryptMetaAccessToken} from '../services/meta-credentials.service';
import {requireTenantContext} from '../tenancy/context';
import {recordCustomerEvent} from './event-store';
import {stripeEvidence,sslEvidence,assertPaymentMatches} from './payment-validation';
export async function verifyCustomerPayment(provider:string,reference:string){
 if(!reference||reference.length>150||!/^[a-zA-Z0-9_.-]+$/.test(reference))throw new Error('Invalid payment reference');
 const integration=await IntelligenceIntegration.findOne({businessId:requireTenantContext().businessId,provider,enabled:true}).select('+credentials');
 if(!integration)throw new Error('Payment provider is not configured');
 const credentials=JSON.parse(decryptMetaAccessToken(integration.credentials));const live=credentials.environment==='live';let evidence;
 if(provider==='stripe'){
  const {data}=await axios.get(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(reference)}`,{timeout:15000,headers:{Authorization:`Bearer ${credentials.secretKey}`},params:{'expand[]':'latest_charge'}});evidence=stripeEvidence(data);
 }else if(provider==='sslcommerz'){
  const host=live?'securepay.sslcommerz.com':'sandbox.sslcommerz.com';
  const {data}=await axios.get(`https://${host}/validator/api/validationserverAPI.php`,{timeout:15000,params:{val_id:reference,store_id:credentials.storeId,store_passwd:credentials.storePassword,format:'json'}});evidence=sslEvidence(data,live);
 }else throw new Error('Provider validation contract has not been enabled');
 const order=await Order.findOne({orderNumber:evidence.orderNumber});if(!order)throw new Error('Payment order not found');
 assertPaymentMatches(evidence,order,live);
 // Sandbox receipts are visible for testing but never counted as verified customer trust.
 const type=evidence.status==='paid'?'payment_completed':evidence.status==='failed'?'payment_failed':evidence.status==='refunded'?'payment_refunded':'payment_created';
 await recordCustomerEvent({type,source:provider,externalId:evidence.reference,customerId:String(order.customerId),orderId:String(order._id),verified:live,data:{amount:evidence.amount,currency:evidence.currency,paymentMethod:evidence.paymentMethod,environment:live?'live':'sandbox',refundedAmount:evidence.refundedAmount}});
 if(live&&evidence.status==='paid')await Order.updateOne({_id:order._id,paymentStatus:{$nin:['paid','refunded']}},{$set:{paymentStatus:'paid'}});
 if(live&&evidence.status==='refunded')await Order.updateOne({_id:order._id,paymentStatus:'paid'},{$set:{paymentStatus:'refunded'}});
 await (await import('./customer-intelligence')).refreshCustomerIntelligence(String(order.customerId));
 return {status:evidence.status,verified:live,orderNumber:order.orderNumber};
}
