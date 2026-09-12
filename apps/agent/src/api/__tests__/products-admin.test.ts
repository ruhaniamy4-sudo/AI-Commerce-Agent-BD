import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Order } from '../../models/Order';
import { Product } from '../../models/Product';
import { withTenantContext } from '../../tenancy/context';
import productRoutes from '../products.routes';

const businessId = new mongoose.Types.ObjectId().toString();
const productId = new mongoose.Types.ObjectId().toString();
const otherId = new mongoose.Types.ObjectId().toString();

// The routes run behind authenticate/authorize in production; here the tenant and
// an Owner role are supplied directly so the tests stay on product behaviour.
const app = express()
    .use(express.json())
    .use((req, _res, next) => {
        (req as any).auth = { businessId, userId: 'u', membershipId: 'm', role: 'Owner' };
        withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Owner' }, () => next());
    })
    .use('/api', productRoutes);

describe('merchant product management', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('deletes a product so it leaves the catalog instead of only being hidden', async () => {
        const update = vi.spyOn(Product, 'findOneAndUpdate').mockResolvedValue({ _id: productId } as never);
        const response = await request(app).delete(`/api/products/${productId}`).expect(200);

        const [filter, changes] = update.mock.calls[0] as any[];
        expect(filter).toMatchObject({ _id: productId, deletedAt: null });
        expect(changes.$set.deletedAt).toBeInstanceOf(Date);
        expect(changes.$set).toMatchObject({ isActive: false, aiSellingStatus: 'disabled' });
        expect(response.body).toMatchObject({ id: productId });
    });

    it('reports a missing product instead of pretending the delete worked', async () => {
        vi.spyOn(Product, 'findOneAndUpdate').mockResolvedValue(null as never);
        await request(app).delete(`/api/products/${productId}`).expect(404);
    });

    it('deletes every selected product in one request', async () => {
        const updateMany = vi.spyOn(Product, 'updateMany').mockResolvedValue({ modifiedCount: 2 } as never);
        const response = await request(app).post('/api/products/bulk-delete').send({ ids: [productId, otherId] }).expect(200);

        const [filter, changes] = updateMany.mock.calls[0] as any[];
        expect(filter._id.$in).toEqual([productId, otherId]);
        expect(filter.deletedAt).toBeNull();
        expect(changes.$set).toMatchObject({ isActive: false, aiSellingStatus: 'disabled' });
        expect(response.body).toMatchObject({ deleted: 2, requested: 2 });
    });

    it('rejects a bulk delete with nothing valid selected', async () => {
        await request(app).post('/api/products/bulk-delete').send({ ids: ['not-an-id'] }).expect(400);
    });

    it('keeps deleted products out of the catalog listing, even when hidden ones are included', async () => {
        const find = vi.spyOn(Product, 'find').mockReturnValue({
            populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }) }),
        } as never);
        vi.spyOn(Product, 'countDocuments').mockResolvedValue(0 as never);
        vi.spyOn(Order, 'aggregate').mockResolvedValue([] as never);

        await request(app).get('/api/products?includeInactive=true').expect(200);
        expect((find.mock.calls[0][0] as any).deletedAt).toBeNull();
    });

    it('stores the merchant SKU in one typeable shape', async () => {
        const product: any = { _id: productId, name: 'Ceramic Mug', publicCode: 'OLD-1', images: [], imageImports: [], save: vi.fn().mockResolvedValue(undefined) };
        // The conflict check reads .select().lean(); the product lookup is awaited directly.
        vi.spyOn(Product, 'findOne').mockImplementation(((filter: any) => (filter?.publicCode
            ? ({ select: () => ({ lean: () => Promise.resolve(null) }) } as any)
            : (Promise.resolve(product) as any))) as never);

        await request(app).patch(`/api/products/${productId}`).send({ publicCode: ' mug 01 ' }).expect(200);
        expect(product.publicCode).toBe('MUG-01');
        expect(product.save).toHaveBeenCalled();
    });

    it('refuses a SKU another product already uses', async () => {
        const product: any = { _id: productId, name: 'Ceramic Mug', save: vi.fn() };
        vi.spyOn(Product, 'findOne').mockImplementation(((filter: any) => (filter?.publicCode
            ? ({ select: () => ({ lean: () => Promise.resolve({ _id: otherId }) }) } as any)
            : (Promise.resolve(product) as any))) as never);

        const response = await request(app).patch(`/api/products/${productId}`).send({ publicCode: 'MUG-01' }).expect(409);
        expect(response.body.error).toMatch(/already used/i);
        expect(product.save).not.toHaveBeenCalled();
    });

    it('hands a product back its generated code when the merchant clears the SKU', async () => {
        const product: any = { _id: productId, name: 'Ceramic Mug', save: vi.fn().mockResolvedValue(undefined), images: [] };
        vi.spyOn(Product, 'findOne').mockImplementation((() => (Promise.resolve(product) as any)) as never);

        await request(app).patch(`/api/products/${productId}`).send({ publicCode: '' }).expect(200);
        expect(product.publicCode).toMatch(/^CER-/);
    });
});
