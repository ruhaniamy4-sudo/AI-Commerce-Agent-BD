/**
 * What a business is entitled to, resolved in one place.
 *
 * Plan limits used to be decorative: the catalog declared messages, tokens,
 * team members and channels, and nothing read them. Every gate now resolves
 * through here so a limit is defined once and honoured everywhere.
 */
import { BusinessChannel, IBusinessChannel } from '../models/BusinessChannel';
import { BusinessMember } from '../models/BusinessMember';
import { ISubscriptionPlan, SubscriptionPlan } from '../models/SubscriptionPlan';
import { Subscription } from '../models/Subscription';

/**
 * The catalog is global and changes rarely, but this runs on every inbound
 * customer message — so plans are memoised briefly. Subscriptions deliberately
 * are not: a merchant who just upgraded must not stay blocked.
 */
const PLAN_CACHE_MS = 60_000;
const planCache = new Map<string, { plan: any; expires: number }>();
export function clearPlanCacheForTests() { planCache.clear(); }

async function findPlanCached(key: string, query: Record<string, unknown>) {
    const cached = planCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.plan;
    const plan = await SubscriptionPlan.findOne(query).lean();
    planCache.set(key, { plan, expires: Date.now() + PLAN_CACHE_MS });
    return plan;
}

/** The plan a subscription entitles, by slug where present and by name for legacy rows. */
export async function resolvePlanForSubscription(subscription: { planSlug?: string; plan?: string } | null | undefined) {
    if (!subscription) return null;
    if (subscription.planSlug) {
        const bySlug = await findPlanCached(`slug:${subscription.planSlug}`, { slug: subscription.planSlug });
        if (bySlug) return bySlug;
    }
    if (!subscription.plan) return null;
    return findPlanCached(`name:${subscription.plan}`, { name: subscription.plan });
}

export async function resolvePlanForBusiness(businessId: string): Promise<ISubscriptionPlan | null> {
    const subscription = await Subscription.findOne({ businessId }).select('plan planSlug').lean();
    return resolvePlanForSubscription(subscription);
}

/** Plans use -1 for unlimited; 0 is a real allowance of nothing. */
export const capOf = (value: unknown) => typeof value === 'number' && value >= 0 ? value : null;
/** Per-business overrides are stored only when set, so falsy means "not overridden". */
export const overrideOf = (value: unknown) => typeof value === 'number' && value > 0 ? value : null;

export type CountedResource = 'teamMembers' | 'channels';
export type CapacityDecision = {
    allowed: boolean;
    /** null means unlimited, or no plan to read a limit from. */
    limit: number | null;
    used: number;
    plan?: string;
    resource: CountedResource;
};

/**
 * A business with no resolvable plan is not blocked — an enterprise deal with a
 * custom plan name has no catalog row, and refusing it would be worse than
 * letting it through.
 */
async function capacityFor(businessId: string, resource: CountedResource, countUsed: () => Promise<number>): Promise<CapacityDecision> {
    const plan = await resolvePlanForBusiness(businessId);
    const limit = capOf(plan?.limits?.[resource]);
    if (limit === null) return { allowed: true, limit: null, used: 0, plan: plan?.name, resource };
    const used = await countUsed();
    return { allowed: used < limit, limit, used, plan: plan?.name, resource };
}

/**
 * Seats in use are active and invited members alike — an unaccepted invitation
 * still holds a seat, or a merchant could invite past the limit for free.
 * Re-adding somebody who is already a member changes their role, not the count.
 */
export function checkSeatCapacity(businessId: string, options: { existingMember?: boolean } = {}) {
    if (options.existingMember) return Promise.resolve<CapacityDecision>({ allowed: true, limit: null, used: 0, resource: 'teamMembers' });
    return capacityFor(businessId, 'teamMembers', () => BusinessMember.countDocuments({ businessId, status: { $in: ['active', 'invited'] } }));
}

/**
 * Only live channels count, so disconnecting one frees its slot. Reconnecting a
 * channel the business already has is not a new channel.
 */
export async function checkChannelCapacity(businessId: string, options: { platform?: IBusinessChannel['platform'] | string; externalId?: string } = {}) {
    if (options.platform && options.externalId) {
        // Platform arrives from request input; an unrecognised value simply matches nothing.
        const existing = await BusinessChannel.exists({ businessId, platform: options.platform as IBusinessChannel['platform'], externalId: options.externalId });
        if (existing) return { allowed: true, limit: null, used: 0, resource: 'channels' } as CapacityDecision;
    }
    return capacityFor(businessId, 'channels', () => BusinessChannel.countDocuments({ businessId, status: 'active' }));
}

const LABEL: Record<CountedResource, string> = { teamMembers: 'team members', channels: 'connected channels' };

/** One wording for every gate, so a merchant always learns the number and the way out. */
export function capacityError(decision: CapacityDecision) {
    return {
        error: `Your ${decision.plan || 'current'} plan includes ${decision.limit} ${LABEL[decision.resource]}, and ${decision.used} are in use. Upgrade your plan to add more.`,
        code: 'PLAN_LIMIT_REACHED',
        resource: decision.resource,
        limit: decision.limit,
        used: decision.used,
    };
}
