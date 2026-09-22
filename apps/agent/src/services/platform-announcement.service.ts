/**
 * Which platform announcements a workspace should currently see.
 *
 * Targeting is evaluated against the workspace rather than stored per tenant, so an
 * operator can retarget a live announcement without a fan-out write, and a tenant
 * that changes plan stops seeing a plan-targeted notice on its next dashboard load.
 */
import mongoose from 'mongoose';
import { PlatformAnnouncement } from '../models/PlatformAnnouncement';
import { Subscription } from '../models/Subscription';

export async function announcementsForBusiness(businessId: string) {
    if (!mongoose.isValidObjectId(businessId)) return [];
    const id = new mongoose.Types.ObjectId(businessId);
    const now = new Date();
    const [subscription, live] = await Promise.all([
        Subscription.collection.findOne({ businessId: id }, { projection: { plan: 1, planSlug: 1, status: 1 } }),
        PlatformAnnouncement.collection.find({
            status: 'published',
            $and: [
                { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
                { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
            ],
        }, { projection: { title: 1, body: 1, severity: 1, audience: 1, planSlugs: 1, subscriptionStatuses: 1, businessIds: 1, dismissible: 1, publishedAt: 1 } }).sort({ publishedAt: -1 }).limit(20).toArray(),
    ]);
    const planSlug = String(subscription?.planSlug || subscription?.plan || '');
    const status = String(subscription?.status || '');
    return live.filter(row => {
        if (row.audience === 'plan') return (row.planSlugs || []).includes(planSlug);
        if (row.audience === 'status') return (row.subscriptionStatuses || []).includes(status);
        if (row.audience === 'business') return (row.businessIds || []).some((target: unknown) => String(target) === businessId);
        return true;
    }).map(({ audience, planSlugs, subscriptionStatuses, businessIds, ...visible }) => visible);
}

/** Moves anything past its window out of `published`, so the console list stays truthful. */
export async function expireLapsedAnnouncements() {
    const result = await PlatformAnnouncement.collection.updateMany({ status: 'published', endsAt: { $ne: null, $lt: new Date() } }, { $set: { status: 'expired', updatedAt: new Date() } });
    return result.modifiedCount;
}
