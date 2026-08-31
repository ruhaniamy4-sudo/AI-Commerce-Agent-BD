import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectMongo } from '../db/mongodb';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { TrainingCandidate } from '../models/TrainingCandidate';
import { Offering } from '../models/Offering';
import { TrainingRun } from '../models/TrainingRun';
import { TrainingSource } from '../models/TrainingSource';
import { Business } from '../models/Business';
import { normalizeBusinessType } from '../services/adaptive-training.service';

dotenv.config();

async function main() {
    await connectMongo();
    for (const model of [TrainingSource, TrainingRun, TrainingCandidate, Product, Offering, Knowledge]) {
        await model.createIndexes();
        console.log(`Ensured indexes for ${model.modelName}`);
    }
    const legacyBusinesses = await Business.collection.find({ businessType: { $exists: true, $ne: '' } }, { projection: { businessType: 1, businessTypeStatus: 1, businessSubType: 1 } }).toArray();
    let normalizedBusinesses = 0;
    for (const business of legacyBusinesses) {
        const normalized = normalizeBusinessType(business.businessType);
        if (!normalized || business.businessType === normalized) continue;
        await Business.collection.updateOne({ _id: business._id }, { $set: {
            businessType: normalized, businessSubType: business.businessSubType || String(business.businessType),
            businessTypeStatus: business.businessTypeStatus || 'confirmed',
        } });
        normalizedBusinesses += 1;
    }
    await Business.createIndexes();
    console.log(`Normalized ${normalizedBusinesses} legacy business type records and ensured Business indexes`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(`Training index migration failed: ${error instanceof Error ? error.message : String(error)}`);
    await mongoose.disconnect(); process.exitCode = 1;
});
