/**
 * Gives every business a subscription from the moment it exists.
 *
 * Before this, a Subscription row was only written at checkout, so a merchant
 * who never opened the billing page had no plan, no period and no trial end —
 * nothing for the AI access gate to read and nothing to convert.
 *
 * Deliberately tenant-context free: the signup path creates the business before
 * a merchant session exists, and the backfill runs across every business.
 */
import { Subscription, ISubscription } from '../models/Subscription';
import { SubscriptionEvent } from '../models/SubscriptionEvent';
import { DEFAULT_SUBSCRIPTION_PLANS, ISubscriptionPlan, SubscriptionPlan } from '../models/SubscriptionPlan';

const DAY_MS = 86_400_000;

/** Seeds the shipped catalog the first time it is needed, so a fresh install can provision. */
export async function ensureDefaultPlans() {
    if (await SubscriptionPlan.estimatedDocumentCount()) return;
    await SubscriptionPlan.insertMany(DEFAULT_SUBSCRIPTION_PLANS, { ordered: false }).catch((error: any) => {
        // A parallel request may have seeded first; only a real failure should surface.
        if (error?.code !== 11000) throw error;
    });
}

/**
 * The plan new merchants start on: the lowest-ordered enabled plan that actually
 * offers trial days. No fallback invents a trial length — if the catalog offers
 * no trial, that is a configuration decision the operator has to make.
 */
export async function findTrialPlan(): Promise<ISubscriptionPlan> {
    await ensureDefaultPlans();
    const plan = await SubscriptionPlan.findOne({ enabled: true, trialDays: { $gt: 0 } }).sort({ sortOrder: 1, monthlyPrice: 1 });
    if (!plan) throw new Error('No enabled subscription plan offers a trial. Configure one before businesses can be provisioned.');
    return plan;
}

export type ProvisionResult = { subscription: ISubscription; created: boolean; plan?: ISubscriptionPlan };

/**
 * Idempotent: a business that already has a subscription keeps it untouched, so
 * this is safe to call from signup, from the backfill, and from a retry.
 *
 * `startedAt` records when the business relationship began — the backfill passes
 * the business creation date — while the trial period itself starts now.
 */
export async function provisionTrialSubscription(
    businessId: string,
    options: { now?: Date; startedAt?: Date; reason?: string } = {},
): Promise<ProvisionResult> {
    const existing = await Subscription.findOne({ businessId });
    if (existing) return { subscription: existing, created: false };

    const plan = await findTrialPlan();
    const now = options.now || new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trialDays * DAY_MS);

    let subscription: ISubscription;
    try {
        subscription = await Subscription.create({
            businessId,
            plan: plan.name,
            planSlug: plan.slug,
            status: 'TRIAL',
            billingPeriod: 'monthly',
            price: plan.monthlyPrice,
            currency: plan.currency,
            startedAt: options.startedAt || now,
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt,
            trialEndsAt,
        });
    } catch (error: any) {
        // businessId is unique: a concurrent signup won the race, and its row is the truth.
        if (error?.code === 11000) {
            const winner = await Subscription.findOne({ businessId });
            if (winner) return { subscription: winner, created: false };
        }
        throw error;
    }

    await SubscriptionEvent.create({
        businessId,
        subscriptionId: subscription._id,
        type: 'START',
        source: 'system',
        previousValue: null,
        newValue: { plan: plan.name, status: 'TRIAL', trialEndsAt, trialDays: plan.trialDays },
        reason: options.reason || `Trial started automatically on the ${plan.name} plan`,
    });

    return { subscription, created: true, plan };
}
