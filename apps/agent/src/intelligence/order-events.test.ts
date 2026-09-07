import {it,expect} from 'vitest';
import {deliveryEvidence,orderEvents} from './order-events';
it('uses completed courier outcomes once per order, not API failures',()=>{const events=[1,2,3,4].map(orderId=>({orderId,type:'delivery_completed',verified:true,occurredAt:new Date()}));events.push({orderId:5,type:'delivery_returned',verified:true,occurredAt:new Date()});expect(deliveryEvidence([...events,events[0]])).toMatchObject({rate:80,sampleSize:5,returned:1});expect(deliveryEvidence([]).rate).toBeNull();});
it('does not misclassify a failed shipment API call as a customer failure',()=>{expect(orderEvents({_id:'1',customerId:'c',createdAt:new Date(),courier:{creationStatus:'failed',status:'failed'}}).map(e=>e.type)).toEqual(['order_created']);});
