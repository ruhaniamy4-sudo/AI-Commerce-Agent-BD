import {it,expect} from 'vitest';
import {customerActionRules} from './action-rules';
import {scoreCustomer} from './scoring';
it('does not generate follow-ups for anonymous or empty profiles',()=>{expect(customerActionRules(scoreCustomer([]))).toEqual([]);});
it('prioritizes human handoffs and high-intent customers',()=>{const score=scoreCustomer([]);score.purchaseIntent=85;expect(customerActionRules(score,true).map(a=>a.type)).toEqual(['human_attention','high_intent']);});
it('recommendations are merchant review actions, not automatic payment restrictions',()=>{const score=scoreCustomer([]);score.risk.level='High';expect(customerActionRules(score)[0]).toMatchObject({type:'risk_review',title:'Review order before fulfillment'});});
