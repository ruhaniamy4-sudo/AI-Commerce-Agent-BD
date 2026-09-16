import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIUsage } from '../models/AIUsage';
import { Business } from '../models/Business';
import { BusinessMember } from '../models/BusinessMember';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { User } from '../models/User';
import { withTenantContext } from '../tenancy/context';
import { clearPlanCacheForTests, consumedFraction, evaluateBusinessAIAccess, mergeLimits } from './business-ai-access.service';
import { customerFallbackMessage, notifyMerchantOfBlock } from './ai-access-messaging.service';
import * as notifications from './notification.service';

const businessId = new mongoose.Types.ObjectId().toString();
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Owner' }, work);

const business = (aiAccess: Record<string, unknown> = { status: 'ENABLED' }) =>
    vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ _id: businessId, status: 'active', aiAccess }) }) } as any);
const subscription = (value: unknown) => vi.spyOn(Subscription, 'findOne').mockReturnValue({ lean: () => Promise.resolve(value) } as any);
const plan = (value: unknown) => vi.spyOn(SubscriptionPlan, 'findOne').mockReturnValue({ lean: () => Promise.resolve(value) } as any);
const usage = (requests: number, tokens: number) => vi.spyOn(AIUsage, 'aggregate').mockResolvedValue([{ requests, tokens }] as any);

const growth = { name: 'Growth', slug: 'growth', limits: { messages: 100, tokens: 50_000, teamMembers: 8, channels: 4 } };

describe('plan entitlements at the AI access gate', () => {
    afterEach(() => { vi.restoreAllMocks(); clearPlanCacheForTests(); delete process.env.AI_SUBSCRIPTION_ENFORCEMENT; });

    it('enforces the allowance the plan sells, with no per-business override configured', async () => {
        business();
        subscription({ status: 'ACTIVE', planSlug: 'growth', plan: 'Growth' });
        plan(growth);
        usage(100, 10);

        expect(await tenant(() => evaluateBusinessAIAccess(businessId))).toMatchObject({
            allowed: false, reason: 'REQUEST_LIMIT_REACHED', limits: { requests: 100, tokens: 50_000, source: 'plan', plan: 'Growth' },
        });
    });

    it('counts customer replies, not every AI call, against the message allowance', async () => {
        business();
        subscription({ status: 'ACTIVE', planSlug: 'growth' });
        plan(growth);
        const aggregate = usage(40, 10);

        expect(await tenant(() => evaluateBusinessAIAccess(businessId))).toMatchObject({ allowed: true, usage: { requests: 40 } });
        // Summaries, vision and embedding rows must not burn the merchant's allowance.
        const [group] = aggregate.mock.calls[0][0].filter((stage: any) => stage.$group);
        expect(JSON.stringify(group.$group.requests)).toContain('rag-assisted-chat');
    });

    it('resolves the plan by name when a legacy subscription has no slug', async () => {
        business();
        subscription({ status: 'ACTIVE', plan: 'Growth' });
        const lookup = plan(growth);
        usage(0, 0);

        await tenant(() => evaluateBusinessAIAccess(businessId));
        expect(lookup).toHaveBeenCalledWith({ name: 'Growth' });
    });

    it('lets a platform-admin override replace the plan allowance', async () => {
        business({ status: 'ENABLED', monthlyRequestLimit: 5000 });
        subscription({ status: 'ACTIVE', planSlug: 'growth' });
        plan(growth);
        usage(120, 10);

        // 120 replies is over the plan's 100 but inside the negotiated 5000.
        expect(await tenant(() => evaluateBusinessAIAccess(businessId))).toMatchObject({ allowed: true, limits: { requests: 5000, tokens: 50_000, source: 'mixed' } });
    });

    it('treats an unlimited plan as unlimited and skips the usage query entirely', async () => {
        business();
        subscription({ status: 'ACTIVE', planSlug: 'enterprise' });
        plan({ name: 'Enterprise', slug: 'enterprise', limits: { messages: -1, tokens: -1, teamMembers: -1, channels: -1 } });
        const aggregate = usage(9_999_999, 9_999_999);

        expect(await tenant(() => evaluateBusinessAIAccess(businessId))).toMatchObject({ allowed: true, limits: { requests: null, tokens: null, source: 'none' } });
        expect(aggregate).not.toHaveBeenCalled();
    });

    it('still blocks a business with no plan match only when an override says so', async () => {
        business({ status: 'ENABLED', monthlyTokenLimit: 1000 });
        subscription({ status: 'ACTIVE', plan: 'Bespoke enterprise deal' });
        plan(null);
        usage(1, 1000);

        expect(await tenant(() => evaluateBusinessAIAccess(businessId))).toMatchObject({ allowed: false, reason: 'TOKEN_LIMIT_REACHED', limits: { requests: null, tokens: 1000, source: 'override' } });
    });

    it('reuses a cached plan across turns instead of re-reading the catalog each message', async () => {
        business();
        subscription({ status: 'ACTIVE', planSlug: 'growth' });
        const lookup = plan(growth);
        usage(1, 1);

        await tenant(() => evaluateBusinessAIAccess(businessId));
        await tenant(() => evaluateBusinessAIAccess(businessId));
        expect(lookup).toHaveBeenCalledTimes(1);
    });

    it('merges and reports consumption for warning thresholds', () => {
        expect(mergeLimits({ messages: 100, tokens: 0 }, undefined)).toMatchObject({ requests: 100, tokens: 0, source: 'plan' });
        expect(mergeLimits(undefined, undefined)).toMatchObject({ requests: null, tokens: null, source: 'none' });
        expect(consumedFraction({ requests: 80, tokens: 10 }, { requests: 100, tokens: 1000, source: 'plan' })).toBeCloseTo(0.8);
        expect(consumedFraction({ requests: 5, tokens: 5 }, { requests: null, tokens: null, source: 'none' })).toBeNull();
    });
});

describe('what a blocked turn says', () => {
    afterEach(() => vi.restoreAllMocks());

    it('answers in the language the conversation is already using', () => {
        expect(customerFallbackMessage('bn')).toMatch(/প্রতিনিধি/);
        expect(customerFallbackMessage('banglish')).toMatch(/প্রতিনিধি/);
        expect(customerFallbackMessage('en')).toMatch(/team will get back/);
        expect(customerFallbackMessage(undefined)).toMatch(/team will get back/);
    });

    it('prefers the merchant’s own wording over the default', () => {
        expect(customerFallbackMessage('en', '  We are closed for Eid, back Monday.  ')).toBe('We are closed for Eid, back Monday.');
        expect(customerFallbackMessage('en', '   ')).toMatch(/team will get back/);
    });

    it('emails the owners once per window and never twice for a burst of messages', async () => {
        const send = vi.spyOn(notifications, 'sendEmail').mockResolvedValue(true);
        // The atomic claim is what throttles: only the first writer proceeds.
        vi.spyOn(Business, 'updateOne')
            .mockResolvedValueOnce({ modifiedCount: 1 } as any)
            .mockResolvedValueOnce({ modifiedCount: 0 } as any);
        vi.spyOn(BusinessMember, 'find').mockReturnValue({ select: () => ({ lean: () => Promise.resolve([{ userId: 'u1' }]) }) } as any);
        vi.spyOn(User, 'find').mockReturnValue({ select: () => ({ lean: () => Promise.resolve([{ email: 'owner@example.com' }]) }) } as any);

        const decision = { allowed: false as const, reason: 'REQUEST_LIMIT_REACHED' as const, usage: { requests: 100, tokens: 10 }, limits: { requests: 100, tokens: null, source: 'plan' as const } };
        expect(await notifyMerchantOfBlock(businessId, 'REQUEST_LIMIT_REACHED', decision)).toBe(true);
        expect(await notifyMerchantOfBlock(businessId, 'REQUEST_LIMIT_REACHED', decision)).toBe(false);
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][1]).toMatch(/monthly message limit reached/i);
        expect(send.mock.calls[0][2]).toContain('100 replies of 100');
    });

    it('never throws when mail is unconfigured, so the customer still gets an answer', async () => {
        vi.spyOn(Business, 'updateOne').mockRejectedValue(new Error('mongo unavailable'));
        await expect(notifyMerchantOfBlock(businessId, 'SUBSCRIPTION_INACTIVE', { allowed: false })).resolves.toBe(false);
    });
});
