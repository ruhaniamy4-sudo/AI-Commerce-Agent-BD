import { hashPassword } from '../auth/password';
import { PlatformAdmin } from '../models/PlatformAdmin';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';

export async function ensurePlatformAdmin() {
    const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.PLATFORM_ADMIN_PASSWORD || '');
    if (!email && !password) return;
    if (!email || password.length < PASSWORD_MIN_LENGTH) throw new Error(`PLATFORM_ADMIN_EMAIL and a PLATFORM_ADMIN_PASSWORD of at least ${PASSWORD_MIN_LENGTH} characters are required together`);
    const existing = await PlatformAdmin.findOne({ email }).select('_id').lean();
    if (existing) return;
    await PlatformAdmin.create({ name: 'SellPilot Platform Admin', email, passwordHash: await hashPassword(password), status: 'active' });
    console.log('Platform administrator bootstrap account created');
}
