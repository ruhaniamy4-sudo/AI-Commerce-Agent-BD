import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subscription } from '../models/Subscription';
import { SubscriptionEvent } from '../models/SubscriptionEvent';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { ensureDefaultPlans, findTrialPlan, provisionTrialSubscription } from './subscription-provisioning.service';

const businessId = new mongoose.Types.ObjectId().toString();
const subscriptionId = new mongoose.Types.ObjectId();
const trialPlan = { _id: new mongoose.Types.ObjectId(), name: 'Free trial', slug: 'free-trial', trialDays: 14, monthlyPrice: 0, currency: 'BDT' };

/** Mongoose query chain: findOne(...).sort(...) has to stay thenable. */
const plansReturning = (plan: unknown) => vi.spyOn(SubscriptionPlan, 'findOne').mockReturnValue({ sort: () => Promise.resolve(plan) } as any);
const noExistingSubscription = () => vi.spyOn(Subscription, 'findOne').mockResolvedValue(null as any);

describe('subscription provisioning', () => {
    afterEach(() => vi.restoreAllMocks());

    it('starts a trial on the trial plan with a period that ends after the configured days', async () => {
        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(1 as any);
        plansReturning(trialPlan);
        noExistingSubscription();
        const create = vi.spyOn(Subscription, 'create').mockImplementation(async (value: any) => ({ ...value, _id: subscriptionId }) as any);
        const event = vi.spyOn(SubscriptionEvent, 'create').mockResolvedValue({} as any);
        const now = new Date('2026-09-16T10:00:00Z');

        const result = await provisionTrialSubscription(businessId, { now });

        expect(result.created).toBe(true);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            businessId, plan: 'Free trial', status: 'TRIAL', billingPeriod: 'monthly', price: 0, currency: 'BDT',
            startedAt: now, currentPeriodStart: now,
            trialEndsAt: new Date('2026-09-30T10:00:00Z'), currentPeriodEnd: new Date('2026-09-30T10:00:00Z'),
        }));
        expect(event).toHaveBeenCalledWith(expect.objectContaining({ type: 'START', source: 'system', subscriptionId }));
    });

    it('keeps the business relationship date when a backfill supplies one', async () => {
        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(1 as any);
        plansReturning(trialPlan);
        noExistingSubscription();
        const create = vi.spyOn(Subscription, 'create').mockImplementation(async (value: any) => ({ ...value, _id: subscriptionId }) as any);
        vi.spyOn(SubscriptionEvent, 'create').mockResolvedValue({} as any);
        const now = new Date('2026-09-16T10:00:00Z');
        const joined = new Date('2026-04-02T08:30:00Z');

        await provisionTrialSubscription(businessId, { now, startedAt: joined });

        // Trial runs from today so a backfilled merchant is never instantly expired.
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ startedAt: joined, currentPeriodStart: now, trialEndsAt: new Date('2026-09-30T10:00:00Z') }));
    });

    it('leaves an existing subscription untouched so signup, backfill and retries are safe to repeat', async () => {
        const existing = { _id: subscriptionId, businessId, plan: 'Growth', status: 'ACTIVE' };
        vi.spyOn(Subscription, 'findOne').mockResolvedValue(existing as any);
        const create = vi.spyOn(Subscription, 'create');
        const event = vi.spyOn(SubscriptionEvent, 'create');

        const result = await provisionTrialSubscription(businessId);

        expect(result).toMatchObject({ created: false, subscription: existing });
        expect(create).not.toHaveBeenCalled();
        expect(event).not.toHaveBeenCalled();
    });

    it('yields to the winner when two signups race for the same business', async () => {
        const winner = { _id: subscriptionId, businessId, status: 'TRIAL' };
        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(1 as any);
        plansReturning(trialPlan);
        vi.spyOn(Subscription, 'findOne').mockResolvedValueOnce(null as any).mockResolvedValueOnce(winner as any);
        vi.spyOn(Subscription, 'create').mockRejectedValue(Object.assign(new Error('duplicate key'), { code: 11000 }));
        const event = vi.spyOn(SubscriptionEvent, 'create');

        expect(await provisionTrialSubscription(businessId)).toMatchObject({ created: false, subscription: winner });
        expect(event).not.toHaveBeenCalled();
    });

    it('refuses to invent a trial length when no enabled plan offers one', async () => {
        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(1 as any);
        plansReturning(null);
        noExistingSubscription();
        vi.spyOn(Subscription, 'create');

        await expect(provisionTrialSubscription(businessId)).rejects.toThrow(/no enabled subscription plan offers a trial/i);
        expect(Subscription.create).not.toHaveBeenCalled();
    });

    it('seeds the shipped catalog only when it is empty', async () => {
        const insert = vi.spyOn(SubscriptionPlan, 'insertMany').mockResolvedValue([] as any);
        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(5 as any);
        await ensureDefaultPlans();
        expect(insert).not.toHaveBeenCalled();

        vi.spyOn(SubscriptionPlan, 'estimatedDocumentCount').mockResolvedValue(0 as any);
        plansReturning(trialPlan);
        expect(await findTrialPlan()).toMatchObject({ slug: 'free-trial' });
        expect(insert).toHaveBeenCalledTimes(1);
    });
});
