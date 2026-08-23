import { setupWorker } from './services/queue.service';
import { connectMongo } from './db/mongodb'; // Ensure DB connection works
import dotenv from 'dotenv';

dotenv.config();

const startWorker = async () => {
    try {
        await connectMongo();
        console.log('Connected to MongoDB for Worker');

        setupWorker(); // Starts the BullMQ worker
        console.log('Worker listening for jobs...');
    } catch (error) {
        console.error('Failed to start worker:', error);
        process.exit(1);
    }
};

startWorker();
