import { Queue, Worker } from 'bullmq';
import { requireRedisConfig } from '../config/runtime';
import { processWebhookEvent } from './webhookWatcher';
import { withTenantContext } from '../tenancy/context';
import { CourierOperationError, syncCourierDelivery } from '../courier/courier.service';

let webhookQueueInstance: Queue | undefined;
let courierQueueInstance: Queue | undefined;

export { requireRedisConfig } from '../config/runtime';

function getWebhookQueue() {
    return webhookQueueInstance ||= new Queue('webhook-events', { connection: requireRedisConfig() });
}

function getCourierQueue() {
    return courierQueueInstance ||= new Queue('courier-events', { connection: requireRedisConfig() });
}

// Compatibility facade: importing routes does not create a Redis connection.
export const webhookQueue = {
    add: (...args: Parameters<Queue['add']>) => getWebhookQueue().add(...args),
};

export async function enqueueCourierStatusSync(businessId: string, orderId: string) {
    return getCourierQueue().add('sync-courier-status', { businessId, orderId }, {
        jobId: `steadfast-sync-${businessId}-${orderId}-${Math.floor(Date.now() / 60_000)}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
    });
}

export const setupWorker = () => {
    const connection = requireRedisConfig();
    const worker = new Worker('webhook-events', async (job) => {
        if (!job.data.businessId) throw new Error('Webhook job is missing businessId');
        await withTenantContext({ businessId: job.data.businessId, userId: 'facebook-system', membershipId: 'facebook-system', role: 'Staff' }, () => processWebhookEvent(job.data));
    }, { connection });
    worker.on('completed', (job) => console.log(`Webhook job ${job.id} completed`));
    worker.on('failed', (job, error) => console.error(`Webhook job ${job?.id} failed: ${error.message}`));
    worker.on('error', (error) => console.error(`Webhook worker connection error: ${error.message}`));

    const courierWorker = new Worker('courier-events', async (job) => {
        if (job.name !== 'sync-courier-status') return;
        if (!job.data.businessId || !job.data.orderId) throw new Error('Courier job is missing tenant or order context');
        return withTenantContext({ businessId: job.data.businessId, userId: 'courier-system', membershipId: 'courier-system', role: 'Staff' }, async () => {
            try {
                return await syncCourierDelivery({ businessId: job.data.businessId, orderId: job.data.orderId });
            } catch (error) {
                if (error instanceof CourierOperationError && !error.retryable) return { synced: false, permanentFailure: true, code: error.code };
                throw error;
            }
        });
    }, { connection });
    courierWorker.on('failed', (job, error) => console.error(`Courier status job ${job?.id} failed: ${error.message}`));
    courierWorker.on('error', (error) => console.error(`Courier worker connection error: ${error.message}`));
    console.log('BullMQ workers are listening');
    return { webhookWorker: worker, courierWorker };
};
