import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTenantContext } from '../tenancy/context';
import { Knowledge } from './Knowledge';

describe('Knowledge language handling', () => {
    afterEach(() => vi.restoreAllMocks());

    it('inserts Bangla content without using language as a MongoDB text override', async () => {
        const businessId = new mongoose.Types.ObjectId().toString();
        const insertOne = vi.spyOn(Knowledge.collection, 'insertOne').mockImplementation(async (document: any) => ({
            acknowledged: true,
            insertedId: document._id,
        }) as any);

        const knowledge = await withTenantContext({
            businessId,
            userId: 'test-user',
            membershipId: 'test-membership',
            role: 'Owner',
        }, () => Knowledge.create({
            title: 'ডেলিভারি নীতি',
            content: 'ঢাকার ভিতরে ডেলিভারি করা হয়।',
            type: 'POLICY',
            language: 'bn',
            tags: ['ডেলিভারি'],
            status: 'active',
            sourcePriority: 'high',
            createdBy: 'test-user',
            updatedBy: 'test-user',
            isPinned: true,
        }));

        expect(knowledge.language).toBe('bn');
        expect(knowledge.businessId.toString()).toBe(businessId);
        expect(insertOne).toHaveBeenCalledOnce();

        const schemaIndexes = Knowledge.schema.indexes() as Array<[Record<string, string | number>, Record<string, any>]>;
        const [, options] = schemaIndexes.find(([keys]) => keys.title === 'text')!;
        expect(options).toMatchObject({ default_language: 'none', language_override: '_mongoTextLanguage' });
        expect(options.language_override).not.toBe('language');
    });
});
