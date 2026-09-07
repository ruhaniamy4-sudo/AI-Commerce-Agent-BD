export const EVENT_TYPES = ['message_received','message_sent','support_request','visitor_started','session_started','page_viewed','product_viewed','product_searched','cart_added','checkout_started','checkout_abandoned','order_created','payment_created','payment_completed','payment_failed','payment_refunded','delivery_completed','delivery_returned','delivery_cancelled'] as const;
export type CustomerEventType = typeof EVENT_TYPES[number];
export const BROWSER_EVENTS: readonly CustomerEventType[] = ['visitor_started','session_started','page_viewed','product_viewed','product_searched','cart_added','checkout_started'];
export interface EventInput {
  type: CustomerEventType; source: string; externalId: string; customerId?: string;
  visitorId?: string; sessionId?: string; conversationId?: string; orderId?: string;
  occurredAt?: Date; verified?: boolean; data?: Record<string, unknown>;
}
export function validateEvent(input: EventInput) {
  if (!EVENT_TYPES.includes(input.type)) throw new Error('Unsupported event type');
  if (!input.source || input.source.length > 64 || !input.externalId || input.externalId.length > 200) throw new Error('Invalid event identity');
  if (!input.customerId && !input.visitorId) throw new Error('An event needs a customer or visitor');
  if (input.occurredAt && (!Number.isFinite(input.occurredAt.getTime()) || input.occurredAt.getTime() > Date.now()+60000)) throw new Error('Invalid event timestamp');
  if (JSON.stringify(input.data || {}).length > 8000) throw new Error('Event metadata too large');
  return input;
}
export function isSandboxConversation(id: string) { return /^(test[_-]|sandbox[_-])/i.test(id); }
