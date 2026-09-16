/**
 * Gives every existing business a trial subscription.
 *
 * Businesses created before subscriptions were provisioned at signup have no
 * plan row at all. Enforcement must not be switched on until this has run, or
 * every existing merchant is refused at the AI access gate at once.
 *
 * The trial period starts now — nobody is backfilled into an already-expired
 * subscription — while `startedAt` keeps the real date the business joined.
 *
 * Previews by default and writes only with --apply: npm swallows some flags
 * (`--dry-run` is an npm option) before a script ever sees them, so the safe
 * mode is the one you get when a flag goes missing.
 *
 * Preview: npm run migrate:subscriptions
 * Apply:   npm run migrate:subscriptions -- --apply
 */
import { loadEnv } from '../config/env';
import { connectMongo } from '../db/mongodb';
import { Business } from '../models/Business';
import { Subscription } from '../models/Subscription';
import { findTrialPlan, provisionTrialSubscription } from '../services/subscription-provisioning.service';

loadEnv();

async function main() {
    const apply = process.argv.includes('--apply');
    await connectMongo();

    const plan = await findTrialPlan();
    const now = new Date();
    console.log(`Mode: ${apply ? 'APPLY — subscriptions will be written' : 'PREVIEW — nothing will be written (pass --apply to write)'}`);
    console.log(`Trial plan: ${plan.name} (${plan.trialDays} days)`);

    const cursor = Business.collection.find({}, { projection: { name: 1, status: 1, createdAt: 1 } });
    let scanned = 0;
    let provisioned = 0;
    let skipped = 0;
    const failures: Array<{ businessId: string; message: string }> = [];

    for await (const business of cursor) {
        scanned += 1;
        const businessId = business._id.toString();
        if (await Subscription.collection.countDocuments({ businessId: business._id }, { limit: 1 })) {
            skipped += 1;
            continue;
        }
        if (!apply) {
            provisioned += 1;
            console.log(`  would provision: ${business.name || businessId} (${business.status || 'unknown status'})`);
            continue;
        }
        try {
            const result = await provisionTrialSubscription(businessId, {
                now,
                startedAt: business.createdAt ? new Date(business.createdAt) : now,
                reason: 'Backfilled trial for a business created before subscriptions were provisioned at signup',
            });
            if (result.created) provisioned += 1;
            else skipped += 1;
        } catch (error) {
            failures.push({ businessId, message: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    console.log(`Subscriptions: scanned ${scanned}, ${apply ? 'provisioned' : 'would provision'} ${provisioned}, already had one ${skipped}, failed ${failures.length}`);
    for (const failure of failures) console.error(`  failed ${failure.businessId}: ${failure.message}`);
    process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
    console.error('Subscription backfill failed:', error);
    process.exit(1);
});
