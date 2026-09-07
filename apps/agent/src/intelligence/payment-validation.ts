export interface PaymentEvidence {reference:string;orderNumber:string;amount:number;currency:string;status:'pending'|'paid'|'failed'|'refunded';refundedAmount?:number;live:boolean;}
export function stripeEvidence(data:any):PaymentEvidence{
 if(!data?.id||!data.metadata?.sellpilot_order_number)throw new Error('Payment is not bound to a SellPilot order');
 const charge=data.latest_charge;const refundedAmount=typeof charge==='object'?Number(charge.amount_refunded||0)/100:0;
 return {reference:data.id,orderNumber:data.metadata.sellpilot_order_number,amount:Number(data.amount)/100,currency:String(data.currency).toUpperCase(),status:refundedAmount>=Number(data.amount)/100?'refunded':data.status==='succeeded'?'paid':data.status==='canceled'||data.last_payment_error?'failed':'pending',refundedAmount,live:data.livemode===true};
}
export function sslEvidence(data:any,live:boolean):PaymentEvidence{
 if(!['VALID','VALIDATED'].includes(data?.status)||!data.tran_id||!data.val_id)throw new Error('SSLCommerz validation did not confirm payment');
 return {reference:String(data.val_id),orderNumber:String(data.tran_id),amount:Number(data.amount),currency:String(data.currency).toUpperCase(),status:'paid',live};
}
export function assertPaymentMatches(evidence:PaymentEvidence,order:{orderNumber:string;total:number},live:boolean){
 if(evidence.orderNumber!==order.orderNumber||evidence.currency!=='BDT'||!Number.isFinite(evidence.amount)||Math.round(evidence.amount*100)!==Math.round(order.total*100)||evidence.live!==live)throw new Error('Payment order, amount, currency or environment mismatch');
}
