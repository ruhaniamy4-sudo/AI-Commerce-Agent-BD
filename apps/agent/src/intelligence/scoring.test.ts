import {it,expect} from 'vitest';
import {scoreCustomer} from './scoring';
const now=new Date('2026-09-01T12:00:00Z');
const event=(type:string,id:string,data={})=>({type,source:'website',externalId:id,occurredAt:now,verified:false,data});
it('cold start never invents probabilities or value',()=>{expect(scoreCustomer([],[],now)).toMatchObject({purchaseIntent:null,risk:{fakeProbability:null,level:'Unknown'},delivery:{rate:null},value:{score:null}});});
it('intent responds to the full journey with bounded repeated browsing',()=>{const browse=[event('product_viewed','1')];const start=scoreCustomer(browse,[],now).purchaseIntent!;const journey=[...browse,event('message_received','2',{text:'price koto stock ache delivery cod order confirm'}),event('cart_added','3'),event('checkout_started','4')];expect(scoreCustomer(journey,[],now).purchaseIntent).toBeGreaterThan(start);expect(scoreCustomer(Array.from({length:100},(_,i)=>event('product_viewed',String(i))),[],now).purchaseIntent).toBe(5);});
it('stale intent fades and refunds alone never label a customer fake',()=>{expect(scoreCustomer([{...event('message_received','1',{text:'order'}),occurredAt:'2020-01-01'}],[],now).purchaseIntent).toBeNull();expect(scoreCustomer([{...event('payment_refunded','2'),verified:true,orderId:'o'}],[],now).risk.level).not.toBe('High');});
