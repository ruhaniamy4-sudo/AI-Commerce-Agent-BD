import { MerchantActivity } from '../models/MerchantActivity';
import { User } from '../models/User';

const touched = new Map<string, number>();
const THROTTLE_MS = 2 * 60 * 1000;

export async function touchMerchantActivity(userId: string, businessId: string, now = new Date()) {
    const key = `${businessId}:${userId}`;
    if (now.getTime() - (touched.get(key) || 0) < THROTTLE_MS) return false;
    touched.set(key, now.getTime());
    await Promise.all([
        MerchantActivity.updateOne({ businessId, userId }, { $set: { lastSeenAt: now }, $setOnInsert: { sessionStartedAt: now } }, { upsert: true }),
        User.updateOne({ _id: userId }, { $set: { lastSeenAt: now } }),
    ]);
    return true;
}

export function clearActivityThrottleForTests() { touched.clear(); }
