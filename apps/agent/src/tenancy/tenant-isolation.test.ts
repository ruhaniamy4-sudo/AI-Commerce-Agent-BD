import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Category } from '../models/Category';
import { Conversation } from '../models/Conversation';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Message } from '../models/Message';
import { AIUsage } from '../models/AIUsage';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { CourierIntegration } from '../models/CourierIntegration';
import { tenantDocument, withTenantContext } from './context';

const businessA = new mongoose.Types.ObjectId();
const businessB = new mongoose.Types.ObjectId();

function asBusiness<T>(businessId: mongoose.Types.ObjectId, work: () => T) {
    return withTenantContext({
        businessId: businessId.toString(),
        userId: new mongoose.Types.ObjectId().toString(),
        membershipId: new mongoose.Types.ObjectId().toString(),
        role: 'Owner',
    }, work);
}

describe('tenant query isolation', () => {
    afterEach(() => vi.restoreAllMocks());

    const models: mongoose.Model<any>[] = [Product, Category, Customer, Order, Knowledge, Conversation, Message, AIUsage, CourierIntegration];

    it.each(models)('$modelName requires businessId and declares tenant-first indexes', (model) => {
        expect(model.schema.path('businessId').options.required).toBe(true);
        expect(model.schema.indexes().some((index: [Record<string, unknown>, Record<string, unknown>]) =>
            Object.keys(index[0])[0] === 'businessId'
        )).toBe(true);
    });

    it.each(models)('$modelName overwrites a client-supplied Business B filter with Business A', async (model) => {
        const collectionFindOne = vi.spyOn(model.collection, 'findOne').mockResolvedValue(null);

        await asBusiness(businessA, () => model.findOne({ businessId: businessB }).exec());

        const databaseFilter = collectionFindOne.mock.calls[0][0] as Record<string, mongoose.Types.ObjectId>;
        expect(databaseFilter.businessId.toString()).toBe(businessA.toString());
        expect(databaseFilter.businessId.toString()).not.toBe(businessB.toString());
    });

    it('keeps concurrent Business A and Business B requests isolated', async () => {
        const seen: string[] = [];
        vi.spyOn(Product.collection, 'findOne').mockImplementation(async (filter) => {
            seen.push((filter.businessId as mongoose.Types.ObjectId).toString());
            return null;
        });

        await Promise.all([
            asBusiness(businessA, () => Product.findOne({ slug: 'shared-slug' }).exec()),
            asBusiness(businessB, () => Product.findOne({ slug: 'shared-slug' }).exec()),
        ]);

        expect(seen.sort()).toEqual([businessA.toString(), businessB.toString()].sort());
    });

    it('fails closed when a tenant model is queried without authentication context', async () => {
        await expect(Product.findOne({}).exec()).rejects.toThrow('tenant context is required');
    });

    it('tenant-scopes AI usage aggregation so Business A cannot summarize Business B', async () => {
        const aggregate = vi.spyOn(AIUsage.collection, 'aggregate').mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
        } as never);
        await asBusiness(businessA, async () =>
            await AIUsage.aggregate([{ $group: { _id: null, requests: { $sum: 1 } } }])
        );
        const pipeline = aggregate.mock.calls[0][0] as any[];
        expect(pipeline[0].$match.businessId.toString()).toBe(businessA.toString());
    });

    it('rejects Business B identifiers supplied in a Business A write payload', () => {
        expect(() => asBusiness(businessA, () => tenantDocument({ businessId: businessB, name: 'Injected' })))
            .toThrow('another business');
    });

    it('forces Business A scope when updating a Business B courier integration selector', async () => {
        const update = vi.spyOn(CourierIntegration.collection, 'findOneAndUpdate').mockResolvedValue(null);
        await asBusiness(businessA, () => CourierIntegration.findOneAndUpdate(
            { businessId: businessB, provider: 'steadfast' },
            { status: 'disabled' }
        ).exec());
        const databaseFilter = update.mock.calls[0][0] as Record<string, mongoose.Types.ObjectId>;
        expect(databaseFilter.businessId.toString()).toBe(businessA.toString());
        expect(databaseFilter.businessId.toString()).not.toBe(businessB.toString());
    });
});
