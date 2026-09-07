import {it,expect} from 'vitest';
import {redxOutcome} from './redx';
it('binds RedX parcel to the exact merchant order and excludes in-progress returns',()=>{
 expect(redxOutcome({parcel:{tracking_id:'r1',merchant_invoice_id:'o1',status:'delivered'}},'r1','o1')).toBe('delivery_completed');
 expect(redxOutcome({parcel:{tracking_id:'r1',merchant_invoice_id:'o1',status:'agent-returning'}},'r1','o1')).toBeNull();
 expect(()=>redxOutcome({parcel:{tracking_id:'r1',merchant_invoice_id:'other',status:'delivered'}},'r1','o1')).toThrow();
});
