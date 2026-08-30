import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectMongo } from '../db/mongodb';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { buildKnowledgeSearchProfile, buildProductSearchProfile } from '../services/knowledge-intelligence.service';

dotenv.config();

async function backfill(model: typeof Product | typeof Knowledge, build: (record: Record<string, any>) => Record<string, any>) {
    let scanned = 0;
    let updated = 0;
    const cursor = model.collection.find({});
    for await (const record of cursor) {
        scanned += 1;
        const intelligence = build(record);
        if (record.intelligence?.sourceHash === intelligence.sourceHash) continue;
        await model.collection.updateOne({ _id: record._id }, { $set: { intelligence } });
        updated += 1;
    }
    console.log(`${model.modelName}: scanned ${scanned}, updated ${updated}`);
}

async function main() {
    await connectMongo();
    // An early development version briefly declared colors[] + sizes[] in one
    // compound index. MongoDB can create it while fields are absent, then reject
    // the first profiled document as parallel arrays. Remove only that exact shape.
    const indexes = await Product.collection.indexes();
    for (const index of indexes) {
        const keys = Object.keys(index.key || {});
        if (keys.includes('intelligence.colors') && keys.includes('intelligence.sizes')) {
            await Product.collection.dropIndex(index.name!);
            console.log(`Product: removed incompatible legacy index ${index.name}`);
        }
    }
    await backfill(Product, buildProductSearchProfile);
    await backfill(Knowledge, buildKnowledgeSearchProfile);
    await Promise.all([Product.createIndexes(), Knowledge.createIndexes()]);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(`Intelligence profile migration failed: ${error instanceof Error ? error.message : String(error)}`);
    await mongoose.disconnect();
    process.exitCode = 1;
});
