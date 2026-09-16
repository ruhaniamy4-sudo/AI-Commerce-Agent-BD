import { Router } from 'express';
import { AuthenticatedRequest, authorize } from '../auth/middleware';
import { BillingTransaction } from '../models/BillingTransaction';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { evaluateBusinessAIAccess, readMonthlyUsage } from '../services/business-ai-access.service';
import { ensureDefaultPlans } from '../services/subscription-provisioning.service';

const router = Router();

// Billing is the Owner's alone: hiding the menu item never stopped a Staff
// account calling the API and changing the subscription.
router.get('/billing', authorize('Owner'), async (req: AuthenticatedRequest, res) => {
  const businessId = req.auth!.businessId;
  await ensureDefaultPlans();
  // Usage comes from the same reader the access gate uses, so the number a
  // merchant reads here is the number their allowance is measured against.
  const [subscription, plans, transactions, usage, access] = await Promise.all([
    Subscription.collection.findOne({ businessId }),
    SubscriptionPlan.collection.find({ enabled: true }).sort({ sortOrder: 1 }).toArray(),
    BillingTransaction.collection.find({ businessId }, { projection: { createdBy: 0, reason: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
    readMonthlyUsage(),
    evaluateBusinessAIAccess(businessId),
  ]);
  res.json({
    subscription,
    plans,
    transactions,
    usage,
    aiAccess: { allowed: access.allowed, reason: access.reason || null, limits: access.limits || null, consumed: access.consumed ?? null, warnAt: access.warnAt ?? 0.8 },
    paymentProviderConfigured: false,
  });
});

router.post('/billing/checkout', authorize('Owner'), async (req: AuthenticatedRequest, res) => {
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
    // planSlug keeps the entitlement link intact if the plan is later renamed.
    await Subscription.collection.findOneAndUpdate({ businessId: req.auth!.businessId }, { $set: { plan: plan.name, planSlug: plan.slug, status: plan.trialDays ? 'TRIAL' : 'ACTIVE', billingPeriod, price: amount, currency: plan.currency, startedAt: now, currentPeriodStart: now, currentPeriodEnd: trialEndsAt, ...(plan.trialDays ? { trialEndsAt } : {}) } }, { upsert: true, returnDocument: 'after' });
    return res.status(201).json({ status: 'activated', transaction });
  }
  res.status(202).json({ status: 'payment_required', transaction, error: 'No online subscription payment provider is configured. The checkout is saved for platform-admin follow-up.' });
});

export default router;
