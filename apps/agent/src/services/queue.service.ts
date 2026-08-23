import { Queue, Worker } from 'bullmq';
import dotenv from 'dotenv';
import { processWebhookEvent } from './webhookWatcher';

dotenv.config();

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
};

export const webhookQueue = new Queue('webhook-events', { connection: redisConfig });

// We'll export the worker setup function to run it separately or in the same process
export const setupWorker = () => {
    const worker = new Worker(
        'webhook-events',
        async (job) => {
            console.log(`Processing job ${job.id}:`, job.name);
            await processWebhookEvent(job.data);
        },
        { connection: redisConfig }
    );

    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed!`);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed with ${err.message}`);
    });

    console.log('BullMQ Worker starting');

    worker.on('error', (err) => {
        if (err.message.includes('ECONNREFUSED')) {
            console.error('\n[TIP] Redis is not running. Please start Redis (e.g., "brew services start redis") for background jobs to work.\n');
        } else {
            console.error('Worker Error:', err.message);
        }
    });

    return worker;
};
