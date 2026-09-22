import mongoose, { Document, Schema } from 'mongoose';

export const COUPON_TYPES = ['PERCENT', 'FIXED', 'TRIAL_EXTENSION'] as const;
export type CouponType = typeof COUPON_TYPES[number];

export interface ICoupon extends Document {
    code: string;
    description: string;
    type: CouponType;
    /** Percent for PERCENT, currency amount for FIXED, days for TRIAL_EXTENSION. */
    value: number;
    currency: string;
    planSlugs: string[];
    /** 0 means no cap. */
    maxRedemptions: number;
    redemptions: number;
    /** Applies the discount for this many billing periods; 0 means once. */
    recurringPeriods: number;
    validFrom?: Date;
    validUntil?: Date;
    enabled: boolean;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,40}$/ },
    description: { type: String, default: '', maxlength: 240 },
    type: { type: String, enum: [...COUPON_TYPES], required: true },
    value: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'BDT', maxlength: 8 },
    planSlugs: { type: [String], default: [] },
    maxRedemptions: { type: Number, default: 0, min: 0 },
    redemptions: { type: Number, default: 0, min: 0 },
    recurringPeriods: { type: Number, default: 0, min: 0, max: 36 },
    validFrom: Date,
    validUntil: Date,
    enabled: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin', required: true },
}, { timestamps: true });

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);

/**
 * One place decides whether a code may be applied, so the console preview and any
 * checkout that redeems it can never disagree.
 */
export function couponRejection(coupon: Pick<ICoupon, 'enabled' | 'validFrom' | 'validUntil' | 'maxRedemptions' | 'redemptions' | 'planSlugs'>, planSlug?: string, now = new Date()) {
    if (!coupon.enabled) return 'This code is disabled';
    if (coupon.validFrom && coupon.validFrom > now) return 'This code is not active yet';
    if (coupon.validUntil && coupon.validUntil < now) return 'This code has expired';
    if (coupon.maxRedemptions && coupon.redemptions >= coupon.maxRedemptions) return 'This code has reached its redemption limit';
    if (coupon.planSlugs.length && planSlug && !coupon.planSlugs.includes(planSlug)) return 'This code does not apply to the selected plan';
    return null;
}
