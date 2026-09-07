import {it,expect} from 'vitest';
import {browserPayload,hashVisit} from './tracking';
it('drops customer, tenant, financial and arbitrary metadata from tracking',()=>{
 const event=browserPayload({type:'product_viewed',eventId:'12345678',customerId:'victim',data:{path:'/shop?email=secret',amount:999,productId:'sku'}});
 expect(event).toEqual({type:'product_viewed',externalId:'12345678',data:{path:'/shop',productId:'sku'}});
 expect(()=>browserPayload({type:'payment_completed',eventId:'12345678'})).toThrow();
});
it('stores a hash instead of the visit bearer token',()=>{expect(hashVisit('token')).toHaveLength(64);expect(hashVisit('token')).not.toBe('token');});
