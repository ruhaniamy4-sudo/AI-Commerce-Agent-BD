import { Queue, Worker } from 'bullmq';
import dotenv from 'dotenv';
import { processWebhookEvent } from './webhookWatcher';
import { withTenantContext } from '../tenancy/context';
import { CourierOperationError, syncCourierDelivery } from '../courier/courier.service';

dotenv.config();

const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
};

export const webhookQueue = new Queue('webhook-events', { connection: redisConfig });
export const courierQueue = new Queue('courier-events', { connection: redisConfig });

export async function enqueueCourierStatusSync(businessId: string, orderId: string) {
    return courierQueue.add(
        'sync-courier-status',
        { businessId, orderId },
        {
            jobId: `steadfast-sync-${businessId}-${orderId}-${Math.floor(Date.now() / 60_000)}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 100,
            removeOnFail: 100,
        }
    );
}

// We'll export the worker setup function to run it separately or in the same process
export const setupWorker = () => {
    const worker = new Worker(
        'webhook-events',
        async (job) => {
            console.log(`Processing job ${job.id}:`, job.name);
            if (!job.data.businessId) throw new Error('Webhook job is missing businessId');
            await withTenantContext({
                businessId: job.data.businessId,
                userId: 'facebook-system',
                membershipId: 'facebook-system',
                role: 'Staff',
            }, () => processWebhookEvent(job.data));
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

    const courierWorker = new Worker(
        'courier-events',
        async (job) => {
            if (job.name !== 'sync-courier-status') return;
            if (!job.data.businessId || !job.data.orderId) throw new Error('Courier job is missing tenant or order context');
            return withTenantContext({
                businessId: job.data.businessId,
                userId: 'courier-system',
                membershipId: 'courier-system',
                role: 'Staff',
            }, async () => {
                try {
                    return await syncCourierDelivery({
                        businessId: job.data.businessId,
                        orderId: job.data.orderId,
                    });
                } catch (error) {
                    if (error instanceof CourierOperationError && !error.retryable) {
                        return { synced: false, permanentFailure: true, code: error.code };
                    }
                    throw error;
                }
            });
        },
        { connection: redisConfig }
    );

    courierWorker.on('failed', (job, error) => {
        console.error(`Courier status job ${job?.id} failed: ${error.message}`);
    });
    courierWorker.on('error', (error) => {
        if (!error.message.includes('ECONNREFUSED')) console.error('Courier worker error:', error.message);
    });

    return { webhookWorker: worker, courierWorker };
};
