import {it,expect} from 'vitest';
import {paymentTrust} from './trust';
const receipt={type:'payment_completed',source:'stripe',externalId:'pi1',orderId:'o1',verified:true,data:{environment:'live'}};
it('ignores sandbox/unverified outcomes and has no invented cold-start score',()=>{expect(paymentTrust([]).score).toBeNull();expect(paymentTrust([{...receipt,verified:false}]).score).toBeNull();expect(paymentTrust([{...receipt,data:{environment:'sandbox'}}]).score).toBeNull();});
it('deduplicates repeated receipts and one order paid through multiple attempts',()=>{expect(paymentTrust([receipt,receipt]).successfulPayments).toBe(1);expect(paymentTrust([receipt,{...receipt,externalId:'pi2'}]).paidOrders).toBe(1);});
it('refunds supersede paid evidence without implying fraud',()=>{expect(paymentTrust([receipt,{...receipt,type:'payment_refunded'}])).toMatchObject({successfulPayments:0,refunds:1,score:50});});
