import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';
import { EVENT_TYPES } from '../intelligence/events';
const schema = new Schema({
  type: { type: String, enum: EVENT_TYPES, required: true }, source: { type: String, required: true },
  externalId: { type: String, required: true }, customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  visitorId: String, sessionId: String, conversationId: String, orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  occurredAt: { type: Date, required: true }, verified: { type: Boolean, default: false },
  data: { type: Schema.Types.Mixed, default: {} }, expiresAt: Date,
}, { timestamps: true });
schema.plugin(tenantPlugin);
schema.index({ businessId: 1, source: 1, externalId: 1, type: 1 }, { unique: true });
schema.index({ businessId: 1, customerId: 1, occurredAt: -1 });
schema.index({ businessId: 1, visitorId: 1, occurredAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const CustomerEvent = mongoose.model('CustomerEvent', schema);
