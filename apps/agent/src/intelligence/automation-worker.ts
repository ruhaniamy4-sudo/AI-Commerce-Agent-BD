import {Business} from '../models/Business';
import {Customer} from '../models/Customer';
import {withTenantContext} from '../tenancy/context';
import {refreshCustomerIntelligence} from './customer-intelligence';
import {reconcileAbandonedCheckouts} from './tracking';
export async function processIntelligenceSweep(){
 for await(const business of Business.find({status:'active'}).select('_id').cursor()){
  await withTenantContext({businessId:String(business._id),userId:'intelligence-worker',membershipId:'intelligence-worker',role:'Staff'},async()=>{
   await reconcileAbandonedCheckouts();
   for await(const customer of Customer.find({optedOut:{$ne:true}}).select('_id').cursor()){
    try{await refreshCustomerIntelligence(String(customer._id));}catch{console.warn('Customer intelligence refresh failed; next sweep will retry');}
   }
  });
 }
}
