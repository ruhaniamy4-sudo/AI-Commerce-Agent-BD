import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { Business } from '../../models/Business';
import { TrainingRun } from '../../models/TrainingRun';
import { TrainingSource } from '../../models/TrainingSource';
import { DEFAULT_MAX_TRAINING_FILE_BYTES } from '../../services/ingestion/file-ingestion.service';
import { stageCandidates } from '../../services/ingestion/business-ingestion.service';
import trainingRoutes from '../training.routes';
import { User } from '../../models/User'; import { MerchantActivity } from '../../models/MerchantActivity';

vi.mock('../../services/ingestion/business-ingestion.service', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../services/ingestion/business-ingestion.service')>()),
    stageCandidates: vi.fn().mockResolvedValue({ pages: 0, discovered: 0, productUrls: 0, remaining: 0, failed: 0, fetches: 0, aiCalls: 0, pagesWithoutAI: 0, unchanged: 0, changed: 0, newPages: 0, durationMs: 0, products: 1, knowledge: 0, duplicates: 0, conflicts: 0, needsAttention: 0 }),
}));

const app = express().use('/api/training', authenticate, trainingRoutes);
const businessId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const membershipId = new mongoose.Types.ObjectId();
const sourceId = new mongoose.Types.ObjectId();
const runId = new mongoose.Types.ObjectId();
const token = () => signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });

describe('training file upload route', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
        vi.restoreAllMocks();
        vi.mocked(stageCandidates).mockResolvedValue({ pages: 0, discovered: 0, productUrls: 0, remaining: 0, failed: 0, fetches: 0, aiCalls: 0, pagesWithoutAI: 0, unchanged: 0, changed: 0, newPages: 0, durationMs: 0, products: 1, knowledge: 0, duplicates: 0, conflicts: 0, needsAttention: 0 });
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as any);
        vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as any);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as any);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({} as any);vi.spyOn(User,'updateOne').mockResolvedValue({} as any);
        vi.spyOn(TrainingSource, 'findOneAndUpdate').mockResolvedValue({ _id: sourceId, type: 'file', name: 'catalog.csv', status: 'learning' } as any);
        vi.spyOn(TrainingRun, 'create').mockResolvedValue({ _id: runId, sourceId, status: 'queued' } as any);
        vi.spyOn(TrainingRun, 'findByIdAndUpdate').mockResolvedValue({} as any);
        vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({} as any);
    });

    it('accepts browser multipart CSV and keeps repeat uploads tenant-local and idempotent', async () => {
        const catalog = Buffer.from('name,price,sku\nPremium Polo,1490,POLO-1');
        const upload = () => request(app).post('/api/training/sources/file').set('authorization', `Bearer ${token()}`).attach('file', catalog, { filename: 'catalog.csv', contentType: 'text/csv' });
        const first = await upload().expect(202);
        const second = await upload().expect(202);

        expect(first.body.summary).toMatchObject({ products: 1, knowledge: 0 });
        expect(second.body.summary).toEqual(first.body.summary);
        const calls = vi.mocked(TrainingSource.findOneAndUpdate).mock.calls;
        expect(calls[1][0]).toEqual(calls[0][0]);
        expect(calls[0][1]).toMatchObject({ $setOnInsert: { businessId: businessId.toString(), type: 'file' } });
        await vi.waitFor(() => expect(stageCandidates).toHaveBeenCalledWith(businessId.toString(), sourceId.toString(), runId.toString(), expect.objectContaining({ products: [expect.objectContaining({ sku: 'POLO-1' })] })));
    });

    it('rejects unsupported, MIME-mismatched, and oversized files before creating a source', async () => {
        await request(app).post('/api/training/sources/file').set('authorization', `Bearer ${token()}`).attach('file', Buffer.from('bad'), { filename: 'script.exe', contentType: 'application/octet-stream' }).expect(400);
        await request(app).post('/api/training/sources/file').set('authorization', `Bearer ${token()}`).attach('file', Buffer.from('name,price'), { filename: 'catalog.csv', contentType: 'image/png' }).expect(400);
        const oversized = await request(app).post('/api/training/sources/file').set('authorization', `Bearer ${token()}`).attach('file', Buffer.alloc(DEFAULT_MAX_TRAINING_FILE_BYTES + 1), { filename: 'large.txt', contentType: 'text/plain' }).expect(400);
        expect(oversized.body.error).toContain('maximum size is 10 MB');
        expect(TrainingSource.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
