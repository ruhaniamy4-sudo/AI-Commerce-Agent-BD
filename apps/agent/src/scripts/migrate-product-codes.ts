/**
 * Backfills the customer-facing product code on products created before the
 * field existed, so every product a shopper sees in chat can be ordered by code.
 *
 * Uses the raw collection (no tenant context) on purpose: this runs across every
 * business, and the code is derived per document from data already on it.
 *
 * Run: npm run migrate:product-codes
 */
import dotenv from 'dotenv';
import { connectMongo } from '../db/mongodb';
import { deriveProductCode, Product } from '../models/Product';

dotenv.config();

async function main() {
    await connectMongo();
    const taken = new Map<string, Set<string>>();
    const cursor = Product.collection.find({}, { projection: { name: 1, businessId: 1, publicCode: 1 } });

    let scanned = 0;
    let updated = 0;
    for await (const record of cursor) {
        scanned += 1;
        const business = String(record.businessId);
        if (!taken.has(business)) taken.set(business, new Set());
        const used = taken.get(business)!;
        if (record.publicCode) { used.add(String(record.publicCode).toUpperCase()); continue; }

        let code = deriveProductCode(record.name, record._id);
        // The id suffix makes collisions practically impossible, but a legacy code
        // typed in by hand could already hold it — never hand two products one code.
        for (let attempt = 1; used.has(code); attempt += 1) {
            code = deriveProductCode(record.name, `${record._id}${attempt}`);
        }
        used.add(code);
        await Product.collection.updateOne({ _id: record._id }, { $set: { publicCode: code } });
        updated += 1;
    }

    console.log(`Product codes: scanned ${scanned}, backfilled ${updated}`);
    process.exit(0);
}

main().catch((error) => {
    console.error('Product code migration failed:', error);
    process.exit(1);
});
