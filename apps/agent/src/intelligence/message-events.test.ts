import {it,expect} from 'vitest';
import {messageEvents} from './message-events';
const conversation={customerId:'customer',platform:'facebook',conversationId:'fb_page_user'};
it('projects real channel identity, response time and human handling',()=>{
 const events=messageEvents(conversation,[{_id:'1',role:'user',content:'refund please',createdAt:'2026-01-01T10:00:00Z'},{_id:'2',role:'assistant',content:'Can help',createdAt:'2026-01-01T10:00:12Z',metadata:{source:'human'}}]);
 expect(events.map(e=>e.type)).toEqual(['message_received','support_request','message_sent']);
 expect(events[2].data).toMatchObject({responseMs:12000,handledBy:'human'});
 expect(events[0].source).toBe('facebook');
});
it('does not score sandbox or unlinked conversations',()=>{
 expect(messageEvents({...conversation,conversationId:'test_123'},[])).toEqual([]);
 expect(messageEvents({...conversation,customerId:null},[])).toEqual([]);
});
