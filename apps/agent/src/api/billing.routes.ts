import { Router } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { AIUsage } from '../models/AIUsage';
import { BillingTransaction } from '../models/BillingTransaction';
import { Subscription } from '../models/Subscription';
import { DEFAULT_SUBSCRIPTION_PLANS, SubscriptionPlan } from '../models/SubscriptionPlan';

const router = Router();

router.get('/billing', async (req: AuthenticatedRequest, res) => {
  const businessId = req.auth!.businessId;
  if (!await SubscriptionPlan.collection.countDocuments({})) await SubscriptionPlan.insertMany(DEFAULT_SUBSCRIPTION_PLANS, { ordered: true });
  const month = new Date(); month.setDate(1); month.setHours(0,0,0,0);
  const [subscription, plans, transactions, usageRows] = await Promise.all([
    Subscription.collection.findOne({ businessId }),
    SubscriptionPlan.collection.find({ enabled: true }).sort({ sortOrder: 1 }).toArray(),
    BillingTransaction.collection.find({ businessId }, { projection: { createdBy: 0, reason: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
    AIUsage.collection.aggregate([{ $match: { businessId, createdAt: { $gte: month } } }, { $group: { _id: null, requests: { $sum: 1 }, tokens: { $sum: { $ifNull: ['$totalTokens', 0] } } } }]).toArray(),
  ]);
  res.json({ subscription, plans, transactions, usage: usageRows[0] || { requests: 0, tokens: 0 }, paymentProviderConfigured: false });
});

router.post('/billing/checkout', async (req: AuthenticatedRequest, res) => {
  const plan = await SubscriptionPlan.collection.findOne({ slug: String(req.body?.planSlug || ''), enabled: true });
  const billingPeriod = req.body?.billingPeriod === 'annual' ? 'annual' : 'monthly';
  if (!plan) return res.status(404).json({ error: 'Selected plan is unavailable' });
  const amount = billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  const transaction = await BillingTransaction.create({
    businessId: req.auth!.businessId,
    type: 'UPGRADE', amount, currency: plan.currency, status: amount === 0 ? 'PAID' : 'PENDING',
    paymentMethod: amount === 0 ? 'free' : 'awaiting-provider', provider: amount === 0 ? 'internal' : 'unconfigured',
    providerReference: `checkout_${Date.now()}`, invoiceNumber: `SP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
    isTest: false, ...(amount === 0 ? { paidAt: new Date() } : {}),
  });
  if (amount === 0) {
    const now = new Date(); const trialEndsAt = new Date(now.getTime() + Math.max(1, plan.trialDays) * 86400000);
    await Subscription.collection.findOneAndUpdate({ businessId: req.auth!.businessId }, { $set: { plan: plan.name, status: plan.trialDays ? 'TRIAL' : 'ACTIVE', billingPeriod, price: amount, currency: plan.currency, startedAt: now, currentPeriodStart: now, currentPeriodEnd: trialEndsAt, ...(plan.trialDays ? { trialEndsAt } : {}) } }, { upsert: true, returnDocument: 'after' });
    return res.status(201).json({ status: 'activated', transaction });
  }
  res.status(202).json({ status: 'payment_required', transaction, error: 'No online subscription payment provider is configured. The checkout is saved for platform-admin follow-up.' });
});

export default router;
