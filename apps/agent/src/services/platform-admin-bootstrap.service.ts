import { hashPassword } from '../auth/password';
import { PlatformAdmin } from '../models/PlatformAdmin';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';

/**
 * Administrators created before roles existed carry no `role`, and a schema default
 * only applies to new documents — so without this they would resolve to the
 * read-only role and nobody could restore their own access. Runs on every boot and
 * is a no-op once there is nothing left to backfill.
 */
export async function backfillPlatformAdminRoles() {
    const result = await PlatformAdmin.collection.updateMany(
        { $or: [{ role: { $exists: false } }, { role: null }] },
        { $set: { role: 'OWNER', permissions: [] } },
    );
    if (result.modifiedCount) console.log(`Assigned the owner role to ${result.modifiedCount} pre-existing platform administrator(s)`);
}

export async function ensurePlatformAdmin() {
    const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.PLATFORM_ADMIN_PASSWORD || '');
    if (!email && !password) return;
    if (!email || password.length < PASSWORD_MIN_LENGTH) throw new Error(`PLATFORM_ADMIN_EMAIL and a PLATFORM_ADMIN_PASSWORD of at least ${PASSWORD_MIN_LENGTH} characters are required together`);
    const existing = await PlatformAdmin.findOne({ email }).select('_id').lean();
    if (existing) return;
    await PlatformAdmin.create({ name: 'SellPilot Platform Admin', email, passwordHash: await hashPassword(password), status: 'active', role: 'OWNER' });
    console.log('Platform administrator bootstrap account created');
}
