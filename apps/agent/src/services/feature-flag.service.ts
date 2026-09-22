/**
 * Feature flag resolution.
 *
 * A flag answers one question — may this workspace use this capability right now —
 * and the answer has to be stable: a merchant who saw a feature at 10:00 must not
 * lose it at 10:01 because a percentage roll was re-rolled. The bucket therefore
 * comes from hashing the tenant id, not from a random number.
 */
import crypto from 'node:crypto';
import { FeatureFlag, DEFAULT_FEATURE_FLAGS } from '../models/FeatureFlag';
import { resolvePlanForBusiness } from './entitlement.service';

const CACHE_MS = 30_000;
let cache: { flags: any[]; expires: number } | null = null;
export function clearFeatureFlagCache() { cache = null; }

async function allFlags() {
    if (cache && cache.expires > Date.now()) return cache.flags;
    const flags = await FeatureFlag.collection.find({}).toArray();
    cache = { flags, expires: Date.now() + CACHE_MS };
    return flags;
}

/** Stable 0–99 bucket for a tenant within one flag. */
function bucketOf(key: string, businessId: string) {
    const digest = crypto.createHash('sha1').update(`${key}:${businessId}`).digest();
    return digest.readUInt16BE(0) % 100;
}

type FlagRow = { key: string; enabled?: boolean; killSwitch?: boolean; rolloutPercent?: number; planSlugs?: string[]; businessIds?: unknown[] };

function decide(flag: FlagRow, businessId: string, planSlug?: string) {
    if (flag.killSwitch) return false;
    if (!flag.enabled) return false;
    // An explicit tenant allowlist is an operator decision and outranks the rollout split.
    if (flag.businessIds?.some(id => String(id) === businessId)) return true;
    if (flag.planSlugs?.length && (!planSlug || !flag.planSlugs.includes(planSlug))) return false;
    const percent = typeof flag.rolloutPercent === 'number' ? flag.rolloutPercent : 100;
    if (percent >= 100) return true;
    if (percent <= 0) return false;
    return bucketOf(flag.key, businessId) < percent;
}

/** Every flag with its decision for this workspace, for the merchant dashboard bootstrap. */
export async function resolveFeatureFlags(businessId: string) {
    const [flags, plan] = await Promise.all([allFlags(), resolvePlanForBusiness(businessId).catch(() => null)]);
    const planSlug = (plan as { slug?: string } | null)?.slug;
    return Object.fromEntries(flags.map(flag => [flag.key, decide(flag as FlagRow, businessId, planSlug)]));
}

export async function isFeatureEnabled(key: string, businessId: string) {
    const flags = await allFlags();
    const flag = flags.find(row => row.key === key);
    if (!flag) return false;
    const plan = await resolvePlanForBusiness(businessId).catch(() => null);
    return decide(flag as FlagRow, businessId, (plan as { slug?: string } | null)?.slug);
}

/** Called when the console opens the flags page, so the catalog is never empty. */
export async function ensureDefaultFeatureFlags() {
    if (await FeatureFlag.collection.countDocuments({})) return;
    await FeatureFlag.collection.insertMany(DEFAULT_FEATURE_FLAGS.map(flag => ({ ...flag, planSlugs: [], businessIds: [], killSwitch: false, createdAt: new Date(), updatedAt: new Date() })));
    clearFeatureFlagCache();
}
