import {it,expect} from 'vitest';
import {stripeEvidence,sslEvidence,assertPaymentMatches} from './payment-validation';
it('rejects forged SSL receipts and validates amount/order/currency/environment',()=>{
 expect(()=>sslEvidence({status:'FAILED'},true)).toThrow();
 const evidence=sslEvidence({status:'VALID',tran_id:'SP1',val_id:'r1',amount:'1490',currency:'BDT'},true);
 expect(()=>assertPaymentMatches(evidence,{orderNumber:'SP1',total:1490},true)).not.toThrow();
 for(const altered of [{...evidence,amount:1},{...evidence,currency:'USD'},{...evidence,orderNumber:'SP2'},{...evidence,live:false}])expect(()=>assertPaymentMatches(altered,{orderNumber:'SP1',total:1490},true)).toThrow();
});
it('does not treat pending Stripe payments as success and requires order binding',()=>{
 expect(()=>stripeEvidence({id:'pi_1',metadata:{}})).toThrow();
 expect(stripeEvidence({id:'pi_1',metadata:{sellpilot_order_number:'SP1'},amount:149000,currency:'bdt',status:'requires_action'})).toMatchObject({amount:1490,status:'pending',live:false});
});
it('preserves bKash and Nagad wallet identity from verified aggregator receipts',()=>{for(const wallet of ['bkash','nagad'])expect(sslEvidence({status:'VALID',tran_id:'o1',val_id:'v1',amount:10,currency:'BDT',card_type:wallet.toUpperCase()},true).paymentMethod).toBe(wallet);});
