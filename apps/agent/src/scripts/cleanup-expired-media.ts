import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectMongo } from '../db/mongodb';
import { Business } from '../models/Business';
import { cleanupExpiredCustomerMedia } from '../services/media-storage.service';
import { withTenantContext } from '../tenancy/context';

dotenv.config();

async function main() {
    await connectMongo();
    const businesses = await Business.find({}).select('_id').lean();
    let deleted = 0; let skipped = 0;
    for (const business of businesses) {
        const businessId = String(business._id);
        const result = await withTenantContext({ businessId, userId: 'media-retention', membershipId: 'media-retention', role: 'Owner' }, () => cleanupExpiredCustomerMedia(businessId));
        deleted += result.deleted; skipped += result.skipped;
    }
    console.log(`Media retention cleanup complete: ${deleted} deleted, ${skipped} retained because they are still referenced.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Media cleanup failed'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
