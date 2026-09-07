import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  trialDays: number;
  limits: { messages: number; tokens: number; teamMembers: number; channels: number };
  features: string[];
  enabled: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]+$/ },
  description: { type: String, default: '', trim: true, maxlength: 240 },
  monthlyPrice: { type: Number, required: true, min: 0 },
  annualPrice: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'BDT', trim: true, maxlength: 8 },
  trialDays: { type: Number, default: 0, min: 0, max: 90 },
  limits: {
    messages: { type: Number, required: true, min: -1 },
    tokens: { type: Number, required: true, min: -1 },
    teamMembers: { type: Number, required: true, min: -1 },
    channels: { type: Number, required: true, min: -1 },
  },
  features: { type: [String], default: [] },
  enabled: { type: Boolean, default: true, index: true },
  featured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

SubscriptionPlanSchema.index({ enabled: 1, sortOrder: 1 });
export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);

export const DEFAULT_SUBSCRIPTION_PLANS = [
  { name: 'Free trial', slug: 'free-trial', description: 'Explore SellPilot with a focused starter allowance.', monthlyPrice: 0, annualPrice: 0, trialDays: 14, limits: { messages: 250, tokens: 250000, teamMembers: 1, channels: 1 }, features: ['AI sales agent', 'Website channel', 'Basic analytics'], enabled: true, featured: false, sortOrder: 0 },
  { name: 'Starter', slug: 'starter', description: 'For small teams beginning to automate customer conversations.', monthlyPrice: 2490, annualPrice: 24900, trialDays: 0, limits: { messages: 3000, tokens: 3000000, teamMembers: 3, channels: 2 }, features: ['Messenger and website', 'Order capture', 'Email support'], enabled: true, featured: false, sortOrder: 1 },
  { name: 'Growth', slug: 'growth', description: 'Higher limits and deeper automation for growing commerce brands.', monthlyPrice: 5990, annualPrice: 59900, trialDays: 0, limits: { messages: 10000, tokens: 10000000, teamMembers: 8, channels: 4 }, features: ['All channels', 'Advanced analytics', 'Priority support'], enabled: true, featured: true, sortOrder: 2 },
  { name: 'Business', slug: 'business', description: 'Operational controls and scale for established teams.', monthlyPrice: 12990, annualPrice: 129900, trialDays: 0, limits: { messages: 30000, tokens: 30000000, teamMembers: 20, channels: 10 }, features: ['Usage controls', 'Team permissions', 'Priority processing'], enabled: true, featured: false, sortOrder: 3 },
  { name: 'Enterprise', slug: 'enterprise', description: 'Custom volume, onboarding, and commercial terms.', monthlyPrice: 0, annualPrice: 0, trialDays: 0, limits: { messages: -1, tokens: -1, teamMembers: -1, channels: -1 }, features: ['Custom limits', 'Dedicated onboarding', 'Commercial SLA'], enabled: true, featured: false, sortOrder: 4 },
] as const;
