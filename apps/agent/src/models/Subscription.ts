import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
export interface ISubscription extends Document {
    businessId: mongoose.Types.ObjectId; plan: string; planSlug?: string; status: SubscriptionStatus; billingPeriod: 'monthly'|'annual'|'custom';
    price: number; currency: string; startedAt: Date; currentPeriodStart?: Date; currentPeriodEnd?: Date; trialEndsAt?: Date;
    cancelledAt?: Date; renewedAt?: Date; createdAt: Date; updatedAt: Date;
}
const SubscriptionSchema = new Schema<ISubscription>({
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, unique: true },
    plan: { type: String, required: true, trim: true },
    // The catalog link entitlements resolve through: a renamed plan must not
    // silently detach its subscribers from their limits. Legacy rows fall back
    // to matching on `plan`, and custom deals may have no slug at all.
    planSlug: { type: String, trim: true, lowercase: true, index: true },
    status: { type: String, enum: ['TRIAL','ACTIVE','PAST_DUE','EXPIRED','CANCELLED','SUSPENDED'], required: true, index: true },
    billingPeriod: { type: String, enum: ['monthly','annual','custom'], required: true },
    price: { type: Number, required: true, min: 0 }, currency: { type: String, default: 'BDT', trim: true },
    startedAt: { type: Date, required: true }, currentPeriodStart: Date, currentPeriodEnd: Date, trialEndsAt: Date, cancelledAt: Date, renewedAt: Date,
}, { timestamps: true });
SubscriptionSchema.index({ status: 1, createdAt: -1 });
SubscriptionSchema.index({ businessId: 1, status: 1 });
export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
