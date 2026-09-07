import {CustomerAction} from '../models/CustomerAction';
import {Conversation} from '../models/Conversation';
import {requireTenantContext} from '../tenancy/context';
import {customerActionRules} from './action-rules';
import {scoreCustomer} from './scoring';
export async function updateCustomerActions(customerId:string,score:ReturnType<typeof scoreCustomer>){
 const needsHuman=!!await Conversation.exists({customerId,needsHumanHandoff:true,status:'active'});
 for(const action of customerActionRules(score,needsHuman)){
  // One durable action per customer/type. Closed actions stay closed until a merchant explicitly reopens them.
  await CustomerAction.findOneAndUpdate({customerId,type:action.type},{$setOnInsert:{...action,customerId,businessId:requireTenantContext().businessId,status:'open',dueAt:new Date(Date.now()+(action.priority==='high'?0:86400000))}},{upsert:true});
 }
}
