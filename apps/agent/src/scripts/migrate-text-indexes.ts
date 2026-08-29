import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { repairLanguageNeutralTextIndexes } from '../db/text-index-migration';

dotenv.config();

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required');
    await mongoose.connect(uri);
    await repairLanguageNeutralTextIndexes(mongoose.connection);
    console.log('Text index migration complete');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => mongoose.disconnect());
