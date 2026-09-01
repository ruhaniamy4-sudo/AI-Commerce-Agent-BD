import type { Connection } from 'mongoose';

export const SETUP_QUESTION_INDEX_NAME = 'businessId_1_setupQuestionKey_1';
export const SETUP_QUESTION_INDEX_KEYS = { businessId: 1, setupQuestionKey: 1 } as const;
export const SETUP_QUESTION_INDEX_FILTER = { setupQuestionKey: { $type: 'string' } } as const;

interface SetupQuestionRecord {
    _id: unknown;
    merchantConfirmed?: boolean;
    structuredValue?: unknown;
    factSource?: string;
    updatedAt?: Date;
    createdAt?: Date;
}

export interface SetupQuestionIndexMigrationResult {
    legacyMissingCount: number;
    legacyNullCount: number;
    duplicateGroupCount: number;
    reconciledRecordCount: number;
    replacedIndexes: string[];
    createdIndex: boolean;
}

function hasStructuredValue(value: unknown) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

function timestamp(value: Date | undefined) {
    return value instanceof Date ? value.getTime() : 0;
}

/** Highest-value setup answer wins; _id is the stable final tie-breaker. */
export function compareSetupQuestionRecords(a: SetupQuestionRecord, b: SetupQuestionRecord) {
    const signals = [
        Number(Boolean(b.merchantConfirmed)) - Number(Boolean(a.merchantConfirmed)),
        Number(hasStructuredValue(b.structuredValue)) - Number(hasStructuredValue(a.structuredValue)),
        Number(b.factSource === 'BUSINESS_SETUP') - Number(a.factSource === 'BUSINESS_SETUP'),
        timestamp(b.updatedAt) - timestamp(a.updatedAt),
        timestamp(b.createdAt) - timestamp(a.createdAt),
    ];
    return signals.find((signal) => signal !== 0) ?? String(b._id).localeCompare(String(a._id));
}

function sameKeys(index: any) {
    const entries = Object.entries(index?.key ?? {});
    return entries.length === 2
        && entries[0]?.[0] === 'businessId' && entries[0]?.[1] === 1
        && entries[1]?.[0] === 'setupQuestionKey' && entries[1]?.[1] === 1;
}

function isCompatible(index: any) {
    return sameKeys(index)
        && index.unique === true
        && index.partialFilterExpression?.setupQuestionKey?.$type === 'string'
        && index.sparse !== true;
}

export async function repairSetupQuestionUniqueIndex(connection: Connection): Promise<SetupQuestionIndexMigrationResult> {
    const collection = connection.collection('knowledges');
    const [legacyMissingCount, nullOrMissingCount] = await Promise.all([
        collection.countDocuments({ setupQuestionKey: { $exists: false } }),
        collection.countDocuments({ setupQuestionKey: null }),
    ]);
    const legacyNullCount = nullOrMissingCount - legacyMissingCount;

    const duplicateGroups = await collection.aggregate<{
        _id: { businessId: unknown; setupQuestionKey: string };
        ids: unknown[];
    }>([
        { $match: { setupQuestionKey: { $type: 'string' } } },
        {
            $group: {
                _id: { businessId: '$businessId', setupQuestionKey: '$setupQuestionKey' },
                ids: { $push: '$_id' },
                count: { $sum: 1 },
            },
        },
        { $match: { count: { $gt: 1 } } },
    ]).toArray();

    let reconciledRecordCount = 0;
    for (const group of duplicateGroups) {
        const records = await collection.find(
            { _id: { $in: group.ids as any[] } },
            { projection: { merchantConfirmed: 1, structuredValue: 1, factSource: 1, updatedAt: 1, createdAt: 1 } }
        ).toArray() as SetupQuestionRecord[];
        const [, ...superseded] = records.sort(compareSetupQuestionRecords);
        if (!superseded.length) continue;

        const supersededIds = superseded.map((record) => record._id);
        const result = await collection.updateMany(
            { _id: { $in: supersededIds as any[] } },
            {
                $unset: { setupQuestionKey: '' },
                $set: { status: 'inactive', updatedAt: new Date() },
            }
        );
        reconciledRecordCount += result.modifiedCount;
        console.log(
            `knowledges: preserved ${supersededIds.length} superseded duplicate record(s) as inactive legacy knowledge for `
            + `${String(group._id.businessId)} / ${group._id.setupQuestionKey}`
        );
    }

    let indexes: Awaited<ReturnType<typeof collection.indexes>> = [];
    try {
        indexes = await collection.indexes();
    } catch (error: any) {
        if (error?.code !== 26 && error?.codeName !== 'NamespaceNotFound') throw error;
    }

    const affectedIndexes = indexes.filter(sameKeys);
    const compatibleIndex = affectedIndexes.find(isCompatible);
    const replacedIndexes: string[] = [];
    for (const index of affectedIndexes) {
        if (index === compatibleIndex || !index.name) continue;
        await collection.dropIndex(index.name);
        replacedIndexes.push(index.name);
        console.log(`knowledges: dropped incompatible setup-question index ${index.name}`);
    }

    let createdIndex = false;
    if (!compatibleIndex) {
        await collection.createIndex(SETUP_QUESTION_INDEX_KEYS, {
            name: SETUP_QUESTION_INDEX_NAME,
            unique: true,
            partialFilterExpression: SETUP_QUESTION_INDEX_FILTER,
        });
        createdIndex = true;
        console.log('knowledges: created tenant-scoped partial unique setup-question index');
    } else {
        console.log('knowledges: setup-question index already compatible');
    }

    return {
        legacyMissingCount,
        legacyNullCount,
        duplicateGroupCount: duplicateGroups.length,
        reconciledRecordCount,
        replacedIndexes,
        createdIndex,
    };
}
