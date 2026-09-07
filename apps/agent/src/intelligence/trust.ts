export function paymentTrust(events:any[]){
 const payments=new Map<string,any>();const codReturns=new Set<string>();const completedOrders=new Set<string>();
 for(const event of events){
  if(!event.verified)continue;
  if(event.type==='delivery_completed'&&event.orderId)completedOrders.add(String(event.orderId));
  if(event.type==='delivery_returned'&&event.orderId&&/cod|cash on delivery/i.test(event.data?.paymentMethod||''))codReturns.add(String(event.orderId));
  if(!['payment_completed','payment_failed','payment_refunded'].includes(event.type)||event.data?.environment==='sandbox')continue;
  const key=`${event.source}:${event.externalId}`;const previous=payments.get(key);
  const priority:Record<string,number>={payment_failed:0,payment_completed:1,payment_refunded:2};
  if(!previous||priority[event.type]>priority[previous.type])payments.set(key,event);
 }
 const values=[...payments.values()];const successful=values.filter(e=>e.type==='payment_completed');
 const paidOrders=new Set(successful.map(e=>String(e.orderId)));const failed=values.filter(e=>e.type==='payment_failed').length;const refunds=values.filter(e=>e.type==='payment_refunded').length;
 const sampleSize=payments.size+codReturns.size+completedOrders.size;
 const score=sampleSize?Math.max(0,Math.min(100,50+paidOrders.size*10+completedOrders.size*5-Math.min(failed,5)*5-codReturns.size*10)):null;
 return {score,successfulPayments:successful.length,paidOrders:paidOrders.size,failedPayments:failed,refunds,codReturns:codReturns.size,sampleSize,confidence:sampleSize>=20?'high':sampleSize>=5?'medium':'low',method:'Behavioral trust score; not a fraud probability',notes:['Refunds are shown separately and are not treated as fraud.','Provider errors and unverified events do not affect trust.']};
}
