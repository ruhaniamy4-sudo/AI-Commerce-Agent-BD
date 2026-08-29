import { setupWorker } from './services/queue.service';
import { connectMongo } from './db/mongodb'; // Ensure DB connection works
import dotenv from 'dotenv';
import { requireRedisConfig } from './config/runtime';

dotenv.config();

const startWorker = async () => {
    try {
        requireRedisConfig();
        await connectMongo();
        console.log('Connected to MongoDB for Worker');

        setupWorker(); // Starts the BullMQ worker
        console.log('Worker listening for jobs...');
    } catch (error) {
        console.error(`Failed to start worker: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
};

startWorker();
