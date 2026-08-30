import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectMongo } from '../db/mongodb';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { TrainingCandidate } from '../models/TrainingCandidate';
import { TrainingRun } from '../models/TrainingRun';
import { TrainingSource } from '../models/TrainingSource';

dotenv.config();

async function main() {
    await connectMongo();
    for (const model of [TrainingSource, TrainingRun, TrainingCandidate, Product, Knowledge]) {
        await model.createIndexes();
        console.log(`Ensured indexes for ${model.modelName}`);
    }
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(`Training index migration failed: ${error instanceof Error ? error.message : String(error)}`);
    await mongoose.disconnect(); process.exitCode = 1;
});
