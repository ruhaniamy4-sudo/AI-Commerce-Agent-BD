import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessChannel } from '../models/BusinessChannel';
import { BusinessMember } from '../models/BusinessMember';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { capacityError, checkChannelCapacity, checkSeatCapacity, clearPlanCacheForTests } from './entitlement.service';

const businessId = new mongoose.Types.ObjectId().toString();
const onPlan = (limits: Record<string, number> | null, name = 'Starter') => {
    vi.spyOn(Subscription, 'findOne').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ plan: name, planSlug: name.toLowerCase() }) }) } as never);
    vi.spyOn(SubscriptionPlan, 'findOne').mockReturnValue({ lean: () => Promise.resolve(limits ? { name, slug: name.toLowerCase(), limits } : null) } as never);
};

describe('plan capacity for seats and channels', () => {
    afterEach(() => { vi.restoreAllMocks(); clearPlanCacheForTests(); });

    it('refuses a seat once the plan allowance is in use', async () => {
        onPlan({ teamMembers: 3, channels: 2 });
        vi.spyOn(BusinessMember, 'countDocuments').mockResolvedValue(3 as never);

        const decision = await checkSeatCapacity(businessId);
        expect(decision).toMatchObject({ allowed: false, limit: 3, used: 3, plan: 'Starter', resource: 'teamMembers' });
        expect(capacityError(decision)).toMatchObject({ code: 'PLAN_LIMIT_REACHED', resource: 'teamMembers' });
        expect(capacityError(decision).error).toContain('3 team members');
    });

    it('counts invited members, so invitations cannot outrun the plan', async () => {
        onPlan({ teamMembers: 2, channels: 2 });
        const count = vi.spyOn(BusinessMember, 'countDocuments').mockResolvedValue(1 as never);

        await checkSeatCapacity(businessId);
        expect(count).toHaveBeenCalledWith({ businessId, status: { $in: ['active', 'invited'] } });
    });

    it('treats a role change for an existing member as no new seat', async () => {
        onPlan({ teamMembers: 1, channels: 1 });
        const count = vi.spyOn(BusinessMember, 'countDocuments');

        expect(await checkSeatCapacity(businessId, { existingMember: true })).toMatchObject({ allowed: true });
        expect(count).not.toHaveBeenCalled();
    });

    it('lets a business reconnect a channel it already has', async () => {
        onPlan({ teamMembers: 1, channels: 1 });
        vi.spyOn(BusinessChannel, 'exists').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);
        const count = vi.spyOn(BusinessChannel, 'countDocuments');

        expect(await checkChannelCapacity(businessId, { platform: 'whatsapp', externalId: '880' })).toMatchObject({ allowed: true });
        expect(count).not.toHaveBeenCalled();
    });

    it('counts only live channels, so disconnecting one frees its slot', async () => {
        onPlan({ teamMembers: 1, channels: 2 });
        vi.spyOn(BusinessChannel, 'exists').mockResolvedValue(null as never);
        const count = vi.spyOn(BusinessChannel, 'countDocuments').mockResolvedValue(1 as never);

        expect(await checkChannelCapacity(businessId, { platform: 'web', externalId: 'site' })).toMatchObject({ allowed: true, limit: 2, used: 1 });
        expect(count).toHaveBeenCalledWith({ businessId, status: 'active' });
    });

    it('treats an unlimited plan as unlimited without counting anything', async () => {
        onPlan({ teamMembers: -1, channels: -1 }, 'Enterprise');
        const seats = vi.spyOn(BusinessMember, 'countDocuments');
        const channels = vi.spyOn(BusinessChannel, 'countDocuments');
        vi.spyOn(BusinessChannel, 'exists').mockResolvedValue(null as never);

        expect(await checkSeatCapacity(businessId)).toMatchObject({ allowed: true, limit: null });
        expect(await checkChannelCapacity(businessId)).toMatchObject({ allowed: true, limit: null });
        expect(seats).not.toHaveBeenCalled();
        expect(channels).not.toHaveBeenCalled();
    });

    it('does not block a custom deal whose plan is not in the catalog', async () => {
        // Enterprise contracts carry a plan name with no catalog row; refusing
        // them would be worse than letting them through.
        onPlan(null, 'Bespoke 2026 contract');
        expect(await checkSeatCapacity(businessId)).toMatchObject({ allowed: true, limit: null });
    });

    it('enforces a zero allowance as a real zero', async () => {
        onPlan({ teamMembers: 0, channels: 1 });
        vi.spyOn(BusinessMember, 'countDocuments').mockResolvedValue(0 as never);
        expect(await checkSeatCapacity(businessId)).toMatchObject({ allowed: false, limit: 0, used: 0 });
    });
});
