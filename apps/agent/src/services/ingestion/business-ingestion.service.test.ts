import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Business } from '../../models/Business';
import { Category } from '../../models/Category';
import { Knowledge } from '../../models/Knowledge';
import { Product } from '../../models/Product';
import { TrainingCandidate } from '../../models/TrainingCandidate';
import { TrainingRun } from '../../models/TrainingRun';
import { TrainingSource } from '../../models/TrainingSource';
import { withTenantContext } from '../../tenancy/context';
import { approveCandidate, stageCandidates } from './business-ingestion.service';
import { mirrorExternalProductImages } from './external-image.service';

vi.mock('./external-image.service', () => ({
    mirrorExternalProductImages: vi.fn(async (urls: string[]) => ({ images: urls.map(() => 'https://res.cloudinary.com/sellpilot/image/upload/imported.jpg'), imports: urls.map((sourceUrl) => ({ sourceUrl, managedUrl: 'https://res.cloudinary.com/sellpilot/image/upload/imported.jpg', status: 'mirrored' })) })),
}));

const businessId = new mongoose.Types.ObjectId().toString();
const sourceId = new mongoose.Types.ObjectId();
const runId = new mongoose.Types.ObjectId();
function asTenant<T>(work: () => T) { return withTenantContext({ businessId, userId: 'merchant-user', membershipId: 'member', role: 'Owner' }, work); }

describe('business ingestion staging and approval', () => {
    beforeEach(() => {
        vi.mocked(mirrorExternalProductImages).mockClear();
        vi.spyOn(TrainingSource, 'findById').mockResolvedValue({ _id: sourceId, type: 'website', url: 'https://shop.example' } as any);
        vi.spyOn(TrainingRun, 'findById').mockResolvedValue({ _id: runId } as any);
        vi.spyOn(TrainingRun, 'findByIdAndUpdate').mockResolvedValue({} as any);
        vi.spyOn(TrainingSource, 'findByIdAndUpdate').mockResolvedValue({} as any);
        vi.spyOn(Business, 'findById').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: businessId }) } as any);
        vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({} as any);
    });
    afterEach(() => vi.restoreAllMocks());

    it('stages same-SKU changed price as a merchant-visible conflict', async () => {
        const existingId = new mongoose.Types.ObjectId();
        vi.spyOn(Product, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: existingId, name: 'Premium Polo', basePrice: 1490, stock: 10, variants: [{ sku: 'POLO-1' }], merchantConfirmed: true }) } as any);
        const upsert = vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue({} as any);
        const stats = await asTenant(() => stageCandidates(businessId, sourceId.toString(), runId.toString(), {
            products: [{ name: 'Premium Polo', description: 'Cotton', basePrice: 1290, sku: 'POLO-1', stock: 10, images: [], variants: [], specs: {} }],
        }));
        expect(stats.conflicts).toBe(1);
        expect(upsert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ status: 'conflict', matchedRecordId: existingId, conflictFields: [expect.objectContaining({ field: 'basePrice', currentValue: 1490, importedValue: 1290 })] }) }), expect.anything());
    });

    it('stages stock and availability changes as review conflicts instead of deleting canonical Products', async () => {
        const existingId = new mongoose.Types.ObjectId();
        vi.spyOn(Product, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: existingId, name: 'Restocked Kurti', basePrice: 2000, stock: 0, availability: 'out_of_stock', variants: [{ sku: 'RESTOCK-1' }] }) } as any);
        const upsert = vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue({} as any);
        await asTenant(() => stageCandidates(businessId, sourceId.toString(), runId.toString(), { products: [{ name: 'Restocked Kurti', description: 'Cotton', basePrice: 2000, sku: 'RESTOCK-1', stock: 5, availability: 'in_stock', images: [], variants: [], specs: {} }] }));
        const conflicts = (upsert.mock.calls[0][1] as any).$set.conflictFields;
        expect(conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'stock', currentValue: 0, importedValue: 5 }), expect.objectContaining({ field: 'availability', currentValue: 'out_of_stock', importedValue: 'in_stock' })]));
    });

    it('does not expose unapproved knowledge and writes approval to the active tenant', async () => {
        const candidate: any = {
            _id: new mongoose.Types.ObjectId(), kind: 'knowledge', status: 'ready', fingerprint: 'fact-hash', matchedRecordId: undefined,
            payload: { title: 'Delivery policy', content: 'Inside Dhaka delivery charge is Tk 70.', type: 'POLICY', language: 'bn', normalizedFact: 'dhaka inside delivery charge 70 bdt' },
            source: { type: 'website', url: 'https://shop.example/delivery', lastSeenAt: new Date() }, save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(TrainingCandidate, 'findById').mockResolvedValue(candidate);
        vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue(candidate);
        vi.spyOn(TrainingCandidate, 'updateOne').mockResolvedValue({ acknowledged: true } as any);
        vi.spyOn(Knowledge, 'findOne').mockResolvedValue(null);
        const create = vi.spyOn(Knowledge, 'create').mockImplementation(async (data: any) => ({ _id: new mongoose.Types.ObjectId(), ...data }) as any);
        vi.spyOn(TrainingCandidate, 'countDocuments').mockResolvedValue(0);
        await asTenant(() => approveCandidate(businessId, candidate._id.toString(), 'merchant-user'));
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ businessId, title: 'Delivery policy', status: 'active', fingerprint: 'fact-hash' }));
        expect(candidate.status).toBe('imported');
    });

    it('mirrors approved imported product images into the active tenant product', async () => {
        const candidate: any = {
            _id: new mongoose.Types.ObjectId(), kind: 'product', status: 'ready', fingerprint: 'product-hash', matchedRecordId: undefined,
            payload: { name: 'Imported Polo', description: 'Cotton polo', category: 'Shirts', basePrice: 1490, stock: 5, sku: 'POLO-DEFAULT', images: ['https://fabrilife.com/product.jpg'], variants: [], specs: {} },
            source: { type: 'website', url: 'https://fabrilife.com/product/imported-polo', lastSeenAt: new Date() }, save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(TrainingCandidate, 'findById').mockResolvedValue(candidate);
        vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue(candidate);
        vi.spyOn(TrainingCandidate, 'updateOne').mockResolvedValue({ acknowledged: true } as any);
        vi.spyOn(Product, 'findOne').mockResolvedValue(null);
        vi.spyOn(Category, 'findOne').mockResolvedValue(null);
        vi.spyOn(Category, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);
        const create = vi.spyOn(Product, 'create').mockImplementation(async (data: any) => ({ _id: new mongoose.Types.ObjectId(), ...data }) as any);
        vi.spyOn(TrainingCandidate, 'countDocuments').mockResolvedValue(0);

        await asTenant(() => approveCandidate(businessId, candidate._id.toString(), 'merchant-user'));

        expect(mirrorExternalProductImages).toHaveBeenCalledWith(['https://fabrilife.com/product.jpg'], businessId);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ businessId, images: ['https://res.cloudinary.com/sellpilot/image/upload/imported.jpg'], imageImports: [expect.objectContaining({ status: 'mirrored' })], variants: [expect.objectContaining({ sku: 'POLO-DEFAULT', stock: 5 })] }));
    });

    it('treats changed delivery charges as a policy conflict rather than overwriting', async () => {
        vi.spyOn(Knowledge, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);
        vi.spyOn(Knowledge, 'find').mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: new mongoose.Types.ObjectId(), title: 'Delivery charge', content: 'Inside Dhaka delivery charge is Tk 70.' }]) }) } as any);
        const upsert = vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue({} as any);
        const stats = await asTenant(() => stageCandidates(businessId, sourceId.toString(), runId.toString(), {
            knowledge: [{ title: 'Dhaka delivery charge', content: 'Inside Dhaka delivery charge is Tk 90.', type: 'POLICY', sourceUrl: 'https://shop.example/shipping' }],
        }));
        expect(stats.conflicts).toBe(1);
        expect(upsert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ status: 'conflict', conflictFields: [expect.objectContaining({ field: 'content' })] }) }), expect.anything());
    });

    it('updates candidate provenance on first scan and rescan without conflicting parent and child paths', async () => {
        vi.spyOn(Knowledge, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);
        vi.spyOn(Knowledge, 'find').mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as any);
        const upsert = vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue({} as any);
        const input = { knowledge: [{ title: 'Returns', content: 'Customers can return products within seven days.', type: 'POLICY' as const, sourceUrl: 'https://shop.example/returns' }] };

        await asTenant(() => stageCandidates(businessId, sourceId.toString(), runId.toString(), input));
        await asTenant(() => stageCandidates(businessId, sourceId.toString(), runId.toString(), input));

        expect(upsert).toHaveBeenCalledTimes(2);
        const [firstFilter, firstUpdate] = upsert.mock.calls[0];
        const [secondFilter, secondUpdate] = upsert.mock.calls[1];
        expect(secondFilter).toEqual(firstFilter);
        for (const update of [firstUpdate, secondUpdate] as any[]) {
            expect(update.$set.source).toMatchObject({ type: 'website', url: 'https://shop.example/returns' });
            expect(update.$set.source.lastSeenAt).toBeInstanceOf(Date);
            expect(Object.prototype.hasOwnProperty.call(update.$set, 'source.lastSeenAt')).toBe(false);
            expect(update.$setOnInsert.businessId).toBe(businessId);
        }

        const otherBusinessId = new mongoose.Types.ObjectId().toString();
        await expect(asTenant(() => stageCandidates(otherBusinessId, sourceId.toString(), runId.toString(), input))).rejects.toThrow('Tenant context mismatch');
        expect(upsert).toHaveBeenCalledTimes(2);
    });

    it('is idempotent when the same candidate is approved again', async () => {
        const candidate: any = { _id: new mongoose.Types.ObjectId(), status: 'imported' };
        vi.spyOn(TrainingCandidate, 'findById').mockResolvedValue(candidate);
        const claim = vi.spyOn(TrainingCandidate, 'findOneAndUpdate');
        await expect(asTenant(() => approveCandidate(businessId, candidate._id.toString(), 'merchant-user'))).resolves.toBe(candidate);
        expect(claim).not.toHaveBeenCalled();
    });

    it('keeps a failed approval retryable without rolling back successful siblings', async () => {
        const candidate: any = { _id: new mongoose.Types.ObjectId(), kind: 'product', status: 'ready', fingerprint: 'failed-product', payload: { name: 'Broken image product', basePrice: 100, images: ['https://example.com/broken.jpg'] }, source: { type: 'website' } };
        vi.spyOn(TrainingCandidate, 'findById').mockResolvedValue(candidate);
        vi.spyOn(TrainingCandidate, 'findOneAndUpdate').mockResolvedValue(candidate);
        const update = vi.spyOn(TrainingCandidate, 'updateOne').mockResolvedValue({ acknowledged: true } as any);
        vi.mocked(mirrorExternalProductImages).mockRejectedValueOnce(new Error('image import unavailable'));
        await expect(asTenant(() => approveCandidate(businessId, candidate._id.toString(), 'merchant-user'))).rejects.toThrow('image import unavailable');
        expect(update.mock.calls[0][0]).toMatchObject({ _id: candidate._id.toString(), status: 'approving' });
        expect(update.mock.calls[0][1]).toMatchObject({ $set: { status: 'failed', lastError: 'image import unavailable' } });
    });
});
