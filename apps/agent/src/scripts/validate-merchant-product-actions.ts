/**
 * Proves the merchant product actions against a real database: a custom SKU is
 * stored and enforced unique, an update actually persists, and a delete really
 * removes the product from the catalog, the storefront listing and the AI — the
 * three things that were reported broken.
 *
 * Run: npm run validate:product-actions
 */
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Business } from '../models/Business';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { getDeterministicResponse } from '../services/deterministic-response.service';
import productRoutes from '../api/products.routes';

async function main() {
    const server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());

    const businessId = new mongoose.Types.ObjectId().toString();
    const principal = { businessId, userId: 'validation', membershipId: 'validation', role: 'Owner' as const };
    const app = express()
        .use(express.json())
        .use((req, _res, next) => {
            (req as any).auth = principal;
            withTenantContext(principal, () => next());
        })
        .use('/api', productRoutes);

    try {
        const category = await withTenantContext(principal, async () => await Category.create({ name: 'Kitchen', slug: 'kitchen' }));
        const base = { categoryId: String(category._id), basePrice: 550, description: 'Stoneware mug', stock: 10 };

        // ── Merchant's own SKU ───────────────────────────────────────────────
        const created = await request(app).post('/api/products').send({ ...base, name: 'Ceramic Coffee Mug', slug: 'ceramic-coffee-mug', publicCode: ' mug 01 ' }).expect(201);
        assert.equal(created.body.publicCode, 'MUG-01', 'the merchant SKU is stored in one typeable shape');

        const duplicate = await request(app).post('/api/products').send({ ...base, name: 'Travel Mug', slug: 'travel-mug', publicCode: 'MUG-01' }).expect(409);
        assert.match(duplicate.body.error, /already used/i, 'two products must never share a code');

        const second = await request(app).post('/api/products').send({ ...base, name: 'Travel Mug', slug: 'travel-mug', publicCode: 'MUG-02' }).expect(201);
        const third = await request(app).post('/api/products').send({ ...base, name: 'Steel Flask', slug: 'steel-flask' }).expect(201);
        assert.match(third.body.publicCode, /^STE-/, 'a product with no merchant SKU still gets a quotable code');

        // ── Update ───────────────────────────────────────────────────────────
        const updated = await request(app).patch(`/api/products/${created.body._id}`).send({ name: 'Ceramic Coffee Mug XL', basePrice: 650, publicCode: 'MUG-XL' }).expect(200);
        assert.equal(updated.body.name, 'Ceramic Coffee Mug XL');
        assert.equal(updated.body.basePrice, 650);
        assert.equal(updated.body.publicCode, 'MUG-XL');
        // Mongoose queries execute when awaited, so the await must happen inside the tenant context.
        const persisted = await withTenantContext(principal, async () => await Product.findById(created.body._id).lean());
        assert.equal(persisted!.name, 'Ceramic Coffee Mug XL', 'the update must persist, not just echo back');

        // ── Delete really removes it ─────────────────────────────────────────
        await Business.create({ _id: businessId, name: 'Validation Store', slug: 'validation-store', businessType: 'ECOMMERCE' } as any);
        const beforeDelete = await request(app).get('/api/products?includeInactive=true').expect(200);
        assert.equal(beforeDelete.body.pagination.total, 3);

        await request(app).delete(`/api/products/${created.body._id}`).expect(200);
        const afterDelete = await request(app).get('/api/products?includeInactive=true').expect(200);
        assert.equal(afterDelete.body.pagination.total, 2, 'a deleted product must leave the catalog listing, not just be hidden');
        assert.ok(!afterDelete.body.data.some((p: any) => p._id === created.body._id));
        await request(app).get(`/api/products/${created.body._id}`).expect(404);
        await request(app).delete(`/api/products/${created.body._id}`).expect(404);

        // The freed code can be reused on a replacement product.
        const replacement = await request(app).post('/api/products').send({ ...base, name: 'Ceramic Mug v2', slug: 'ceramic-mug-v2', publicCode: 'MUG-XL' }).expect(201);
        assert.equal(replacement.body.publicCode, 'MUG-XL', 'a deleted product must not hold its code hostage');
        await request(app).delete(`/api/products/${replacement.body._id}`).expect(200);

        // The AI must not sell what the merchant deleted.
        const browse: any = await withTenantContext(principal, async () => await getDeterministicResponse(businessId, 'ki ki product ache?', { conversationId: 'validation-products' }));
        assert.ok(!browse.message_text.includes('Ceramic Coffee Mug XL'), 'a deleted product must disappear from the AI catalog');
        assert.ok(browse.message_text.includes('Travel Mug'), 'remaining products must still be sold');

        // ── Bulk delete ──────────────────────────────────────────────────────
        const bulk = await request(app).post('/api/products/bulk-delete').send({ ids: [second.body._id, third.body._id] }).expect(200);
        assert.equal(bulk.body.deleted, 2);
        const empty = await request(app).get('/api/products?includeInactive=true').expect(200);
        assert.equal(empty.body.pagination.total, 0, 'bulk delete must remove every selected product');

        // ── CSV import carries the merchant SKU ──────────────────────────────
        const imported = await request(app).post('/api/products/bulk-import').send({
            products: [
                { row: 2, name: 'Imported Mug', category: 'Kitchen', basePrice: '500', sku: 'imp mug 1', stock: '5' },
                { row: 3, name: 'Imported Flask', category: 'Kitchen', basePrice: '900', sku: 'IMP-MUG-1', stock: '3' },
                { row: 4, name: 'Imported Bowl', category: 'Kitchen', basePrice: '300', stock: '2' },
            ],
        }).expect(201);
        const [mugRow, clashRow, plainRow] = imported.body.results;
        assert.equal(imported.body.created, 2);
        assert.equal(imported.body.failed, 1);
        assert.equal(mugRow.status, 'created', 'a row with a SKU must import');
        assert.equal(clashRow.status, 'error', 'a duplicate SKU must be reported, not silently renamed');
        assert.match(clashRow.error, /already used/i);
        assert.equal(plainRow.status, 'created', 'a row without a SKU still imports');

        const importedMug = await withTenantContext(principal, async () => await Product.findById(mugRow.id).lean());
        assert.equal(importedMug!.publicCode, 'IMP-MUG-1', 'the CSV SKU becomes the code customers can order with');
        const importedBowl = await withTenantContext(principal, async () => await Product.findById(plainRow.id).lean());
        assert.match(importedBowl!.publicCode, /^IMP-/, 'a blank SKU still gets a generated code');

        await request(app).post('/api/products/bulk-delete').send({ ids: [mugRow.id, plainRow.id] }).expect(200);

        // Hiding stays reversible and separate from deleting.
        const hidden = await request(app).post('/api/products').send({ ...base, name: 'Hidden Mug', slug: 'hidden-mug' }).expect(201);
        await request(app).patch(`/api/products/${hidden.body._id}`).send({ isActive: false }).expect(200);
        const withHidden = await request(app).get('/api/products?includeInactive=true').expect(200);
        assert.equal(withHidden.body.pagination.total, 1, 'a hidden product stays in the merchant catalog');
        const storefront = await request(app).get('/api/products').expect(200);
        assert.equal(storefront.body.pagination.total, 0, 'a hidden product is not shown to customers');

        console.log('✅ merchant product actions validated: SKU stored, unique and importable; update persists; delete removes from catalog, storefront and AI');
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
}

main().catch((error) => {
    console.error('❌ merchant product action validation failed:', error);
    process.exit(1);
});
