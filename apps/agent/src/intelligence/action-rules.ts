import {scoreCustomer} from './scoring';
export function customerActionRules(score:ReturnType<typeof scoreCustomer>,needsHuman=false){
 const actions:Array<{type:string;priority:'high'|'normal';title:string;reason:string}>=[];
 if(needsHuman)actions.push({type:'human_attention',priority:'high',title:'Review customer handoff',reason:'A conversation requested human attention.'});
 if(score.risk.level==='High')actions.push({type:'risk_review',priority:'high',title:'Review order before fulfillment',reason:'Review the evidence and consider advance payment; no terms have been changed.'});
 if(score.value.completedOrders>=5)actions.push({type:'vip',priority:'high',title:'Prioritize repeat customer',reason:`${score.value.completedOrders} completed orders with this merchant.`});
 if(score.purchaseIntent!==null&&score.purchaseIntent>=65)actions.push({type:'high_intent',priority:'high',title:'Follow up with interested buyer',reason:'Recent product, conversation or checkout signals show buying interest.'});
 else if(score.lastInboundAt)actions.push({type:'follow_up',priority:'normal',title:'Schedule customer follow-up',reason:'Continue the conversation and clarify what the customer needs.'});
 return actions;
}
