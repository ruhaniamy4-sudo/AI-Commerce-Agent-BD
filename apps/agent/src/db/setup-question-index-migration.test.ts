import { describe, expect, it, vi } from 'vitest';
import { Knowledge } from '../models/Knowledge';
import {
    compareSetupQuestionRecords,
    repairSetupQuestionUniqueIndex,
    SETUP_QUESTION_INDEX_FILTER,
    SETUP_QUESTION_INDEX_KEYS,
    SETUP_QUESTION_INDEX_NAME,
} from './setup-question-index-migration';

function migrationHarness(options: {
    indexes?: any[];
    missing?: number;
    nullOrMissing?: number;
    duplicateGroups?: any[];
    records?: any[];
} = {}) {
    const indexes = [...(options.indexes ?? [])];
    const collection = {
        countDocuments: vi.fn(async (filter: any) => filter.setupQuestionKey?.$exists === false
            ? (options.missing ?? 0)
            : (options.nullOrMissing ?? 0)),
        aggregate: vi.fn(() => ({ toArray: vi.fn(async () => options.duplicateGroups ?? []) })),
        find: vi.fn(() => ({ toArray: vi.fn(async () => options.records ?? []) })),
        updateMany: vi.fn(async (_filter: any, update: any) => ({
            modifiedCount: update.$unset?.setupQuestionKey === '' ? (options.records?.length ?? 1) - 1 : 0,
        })),
        indexes: vi.fn(async () => indexes),
        dropIndex: vi.fn(async (name: string) => {
            const position = indexes.findIndex((index) => index.name === name);
            if (position >= 0) indexes.splice(position, 1);
        }),
        createIndex: vi.fn(async (keys: any, indexOptions: any) => {
            indexes.push({ key: keys, ...indexOptions });
            return indexOptions.name;
        }),
    };
    return {
        collection,
        connection: { collection: vi.fn(() => collection) } as any,
    };
}

describe('setup-question unique index migration', () => {
    it('defines tenant uniqueness only for string setup-question keys', () => {
        const schemaIndexes = Knowledge.schema.indexes() as Array<[Record<string, any>, Record<string, any>]>;
        const definition = schemaIndexes.find(([keys]) => keys.businessId === 1 && keys.setupQuestionKey === 1);

        expect(definition).toEqual([
            SETUP_QUESTION_INDEX_KEYS,
            expect.objectContaining({
                name: SETUP_QUESTION_INDEX_NAME,
                unique: true,
                partialFilterExpression: SETUP_QUESTION_INDEX_FILTER,
            }),
        ]);
        expect(definition?.[1].sparse).not.toBe(true);
    });

    it('replaces only the incompatible compound sparse index and is idempotent', async () => {
        const unrelatedIndex = { name: 'businessId_1_title_1', key: { businessId: 1, title: 1 } };
        const oldSparseIndex = {
            name: SETUP_QUESTION_INDEX_NAME,
            key: SETUP_QUESTION_INDEX_KEYS,
            unique: true,
            sparse: true,
        };
        const { collection, connection } = migrationHarness({
            indexes: [unrelatedIndex, oldSparseIndex],
            missing: 3,
            nullOrMissing: 5,
        });

        const first = await repairSetupQuestionUniqueIndex(connection);
        const second = await repairSetupQuestionUniqueIndex(connection);

        expect(first).toMatchObject({
            legacyMissingCount: 3,
            legacyNullCount: 2,
            duplicateGroupCount: 0,
            replacedIndexes: [SETUP_QUESTION_INDEX_NAME],
            createdIndex: true,
        });
        expect(second).toMatchObject({ replacedIndexes: [], createdIndex: false });
        expect(collection.dropIndex).toHaveBeenCalledOnce();
        expect(collection.createIndex).toHaveBeenCalledOnce();
        expect(collection.createIndex).toHaveBeenCalledWith(SETUP_QUESTION_INDEX_KEYS, {
            name: SETUP_QUESTION_INDEX_NAME,
            unique: true,
            partialFilterExpression: SETUP_QUESTION_INDEX_FILTER,
        });
        expect((await collection.indexes())).toContain(unrelatedIndex);
    });

    it('keeps the strongest real setup answer and preserves superseded records as inactive legacy knowledge', async () => {
        const businessId = 'business-a';
        const duplicateGroups = [{
            _id: { businessId, setupQuestionKey: 'delivery_charge' },
            ids: ['older', 'confirmed'],
        }];
        const records = [
            { _id: 'older', merchantConfirmed: false, updatedAt: new Date('2026-08-01') },
            { _id: 'confirmed', merchantConfirmed: true, structuredValue: 70, factSource: 'BUSINESS_SETUP', updatedAt: new Date('2026-07-01') },
        ];
        const { collection, connection } = migrationHarness({ duplicateGroups, records });

        const result = await repairSetupQuestionUniqueIndex(connection);

        expect([...records].sort(compareSetupQuestionRecords)[0]?._id).toBe('confirmed');
        expect(result).toMatchObject({ duplicateGroupCount: 1, reconciledRecordCount: 1 });
        expect(collection.updateMany).toHaveBeenCalledWith(
            { _id: { $in: ['older'] } },
            {
                $unset: { setupQuestionKey: '' },
                $set: { status: 'inactive', updatedAt: expect.any(Date) },
            }
        );
    });

    it('keeps the same setup-question key tenant-scoped rather than globally unique', () => {
        const indexedIdentity = (businessId: string, setupQuestionKey: string) => JSON.stringify({ businessId, setupQuestionKey });
        expect(indexedIdentity('business-a', 'delivery_charge')).not.toBe(indexedIdentity('business-b', 'delivery_charge'));
    });
});
