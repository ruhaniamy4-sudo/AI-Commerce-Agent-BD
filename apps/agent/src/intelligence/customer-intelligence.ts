import {Customer} from '../models/Customer';
import {CustomerEvent} from '../models/CustomerEvent';
import {CustomerIntelligence} from '../models/CustomerIntelligence';
import {requireTenantContext} from '../tenancy/context';
import {reconcileCustomerMessages,reconcileCustomerOrders} from './reconcile';
import {scoreCustomer} from './scoring';
export async function refreshCustomerIntelligence(customerId:string){
 const customer=await Customer.findById(customerId).lean();if(!customer)return null;
 if(customer.optedOut)return {customer:{id:String(customer._id),name:customer.name},intelligence:null,optedOut:true};
 await reconcileCustomerMessages(customerId);const orders=await reconcileCustomerOrders(customerId);
 const events=await CustomerEvent.find({customerId}).sort({occurredAt:1}).lean();
 const intelligence=scoreCustomer(events,orders);
 await CustomerIntelligence.findOneAndUpdate({customerId},{$set:{businessId:requireTenantContext().businessId,customerId,version:intelligence.version,snapshot:intelligence,calculatedAt:new Date()}},{upsert:true});
 return {customer:{id:String(customer._id),name:customer.name,phone:customer.phone,email:customer.email},intelligence};
}
