import { CustomerEvent } from '../models/CustomerEvent';
import {Customer} from '../models/Customer';
import { requireTenantContext } from '../tenancy/context';
import { EventInput, validateEvent, isSandboxConversation } from './events';
export async function recordCustomerEvent(input: EventInput) {
  validateEvent(input);
  const { businessId } = requireTenantContext();
  if(input.customerId){const customer=await Customer.findById(input.customerId).select('optedOut').lean();if(!customer)throw new Error('Event customer does not belong to this tenant');if(customer.optedOut)return null;}
  if (input.conversationId && isSandboxConversation(input.conversationId)) return null;
  const query = { source: input.source, externalId: input.externalId, type: input.type };
  try {
    return await CustomerEvent.findOneAndUpdate(query, { $setOnInsert: {
      ...input, businessId, occurredAt: input.occurredAt || new Date(),
      ...(!input.customerId ? { expiresAt: new Date(Date.now()+90*86400000) } : {}),
    } }, { upsert: true, new: true, runValidators: true });
  } catch (error: any) {
    if (error?.code === 11000) return CustomerEvent.findOne(query);
    throw error;
  }
}
export async function customerTimeline(customerId: string, before?: Date) {
  return CustomerEvent.find({ customerId, ...(before ? { occurredAt: { $lt: before } } : {}) }).sort({ occurredAt: -1, _id: -1 }).limit(100).lean();
}
