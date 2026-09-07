import { describe, it, expect } from 'vitest';
import { validateEvent, BROWSER_EVENTS, isSandboxConversation } from './events';
describe('customer event contract', () => {
  it('requires identity and rejects unknown outcomes', () => {
    expect(()=>validateEvent({type:'order_created',source:'checkout',externalId:'1'})).toThrow();
    expect(()=>validateEvent({type:'invented' as any,source:'web',externalId:'1',visitorId:'v'})).toThrow();
  });
  it('cannot accept financial or delivery outcomes from the browser', () => {
    for (const type of ['payment_completed','delivery_completed','order_created']) expect(BROWSER_EVENTS).not.toContain(type);
  });
  it('rejects future timestamps and keeps sandbox out of production', () => {
    expect(()=>validateEvent({type:'message_received',source:'web',externalId:'1',customerId:'c',occurredAt:new Date(Date.now()+120000)})).toThrow();
    expect(isSandboxConversation('test_123')).toBe(true);
    expect(isSandboxConversation('fb_123')).toBe(false);
  });
});
