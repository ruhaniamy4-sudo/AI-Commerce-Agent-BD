import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import {
    buildKnowledgeSearchProfile,
    buildProductSearchProfile,
    cleanText,
    compareCanonicalProducts,
    parseBudget,
    productMatchesConstraints,
    refineDisplayText,
    scoreProductMatch,
    understandQuery,
} from './knowledge-intelligence.service';

const businessId = new mongoose.Types.ObjectId().toString();
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'merchant', membershipId: 'member', role: 'Owner' }, work);

const shirt = {
    name: 'Premium Linen Blend Shirt',
    description: 'Lightweight casual shirt',
    basePrice: 1490,
    salePrice: undefined,
    stock: 8,
    specs: { material: 'Linen blend', color: 'Black' },
    compatibilityTags: ['casual'],
    variants: [{ variantId: 'black-xl', name: 'Black XL', sku: 'SHIRT-BLACK-XL', price: 1490, images: [], specs: { color: 'Black', size: 'XL' }, stock: 3, isActive: true }],
};

describe('deterministic product and knowledge intelligence', () => {
    it('keeps retrieval profiles hidden from ordinary merchant API queries', () => {
        expect(Product.schema.path('intelligence').options.select).toBe(false);
        expect(Knowledge.schema.path('intelligence').options.select).toBe(false);
    });

    it.each([
        ['Bangla', 'কালো শার্ট আছে?', 'black'],
        ['English', 'Do you have a black shirt?', 'black'],
        ['Banglish', 'kalo shirt ache?', 'black'],
        ['spelling/category variation', 'black sart dekhaw', 'shirt'],
    ])('understands %s product queries', (_label, message, expected) => {
        const query = understandQuery(message);
        expect([...query.colors, ...query.categories]).toContain(expected);
        expect(productMatchesConstraints({ ...shirt, intelligence: buildProductSearchProfile(shirt) }, query)).toBe(true);
    });

    it('normalizes equivalent color and category terms without an AI call', () => {
        expect(understandQuery('কালো টি-শার্ট').colors).toEqual(['black']);
        expect(understandQuery('kalo tee').categories).toEqual(['tshirt']);
    });

    it('extracts 2k and explicit budgets and applies canonical sale/base price', () => {
        expect(parseBudget('2k er moddhe kichu dekhaw')).toBe(2000);
        expect(parseBudget('budget 1,500')).toBe(1500);
        const query = understandQuery('1500 er moddhe black shirt');
        expect(productMatchesConstraints({ ...shirt, intelligence: buildProductSearchProfile(shirt) }, query)).toBe(true);
        expect(productMatchesConstraints({ ...shirt, basePrice: 1700, intelligence: buildProductSearchProfile(shirt) }, query)).toBe(false);
    });

    it('uses exact size constraints', () => {
        const profile = buildProductSearchProfile(shirt);
        expect(productMatchesConstraints({ ...shirt, intelligence: profile }, understandQuery('black XL shirt ache?'))).toBe(true);
        expect(productMatchesConstraints({ ...shirt, intelligence: profile }, understandQuery('black XXL shirt ache?'))).toBe(false);
    });

    it('does not infer a hot-weather benefit from linen alone', () => {
        const unsupported = { ...shirt, description: 'Linen blend shirt' };
        expect(productMatchesConstraints({ ...unsupported, intelligence: buildProductSearchProfile(unsupported) }, understandQuery('gorom e porar shirt'))).toBe(false);
        expect(productMatchesConstraints({ ...shirt, intelligence: buildProductSearchProfile(shirt) }, understandQuery('gorom e porar shirt'))).toBe(true);
    });

    it('distinguishes confirmed attributes from unsupported interpretations', () => {
        const profile = buildProductSearchProfile({ ...shirt, description: 'Water resistant backpack' });
        expect(profile.terms).toContain('water_resistant');
        expect(profile.terms).not.toContain('waterproof');
        expect(profile.facts.every((fact) => fact.confidence === 'confirmed')).toBe(true);
    });

    it('structures and connects multiple approved delivery facts', () => {
        const profile = buildKnowledgeSearchProfile({
            title: 'Delivery',
            content: 'Dhakar moddhe 70 tk delivery, outside Dhaka 120. 2-3 diner moddhe delivery hoy. COD available.',
            tags: ['delivery'],
            type: 'POLICY',
        });
        expect(profile.facts).toEqual(expect.arrayContaining([
            expect.objectContaining({ subject: 'delivery_inside_dhaka', value: 70, unit: 'BDT' }),
            expect.objectContaining({ subject: 'delivery_outside_dhaka', value: 120, unit: 'BDT' }),
            expect.objectContaining({ predicate: 'estimated_time', value: '2-3 days' }),
            expect.objectContaining({ predicate: 'cod_available', value: true }),
        ]));
    });

    it('recognizes comparison intent and scores factual attribute overlap', () => {
        const query = understandQuery('black shirt ei 2 tar difference ki?');
        expect(query.comparison).toBe(true);
        expect(scoreProductMatch({ ...shirt, intelligence: buildProductSearchProfile(shirt) }, query)).toBeGreaterThan(5);
        const cotton = { ...shirt, name: 'Cotton Shirt', basePrice: 1290, specs: { material: 'Cotton', color: 'White' }, variants: [] };
        const differences = compareCanonicalProducts([
            { ...shirt, intelligence: buildProductSearchProfile(shirt) },
            { ...cotton, intelligence: buildProductSearchProfile(cotton) },
        ]);
        expect(differences).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'price' }),
            expect.objectContaining({ field: 'materials' }),
            expect.objectContaining({ field: 'colors' }),
        ]));
    });

    it('understands service and visa intent without guaranteeing an outcome', () => {
        const query = understandQuery('Canada te masters korte chai, visa hobe?');
        expect(query).toMatchObject({
            highStakes: true,
            serviceIntent: { country: 'Canada', visaType: 'student', studyLevel: 'masters' },
        });
        const profile = buildKnowledgeSearchProfile({ title: 'Canada student visa', content: 'We provide masters profile review. Service fee 5000 tk.', tags: [], type: 'GUIDE' });
        expect(profile.riskLevel).toBe('high');
        expect(profile.facts).toEqual(expect.arrayContaining([
            expect.objectContaining({ predicate: 'country', value: 'Canada' }),
            expect.objectContaining({ predicate: 'visa_type', value: 'student' }),
            expect.objectContaining({ predicate: 'study_level', value: 'masters' }),
            expect.objectContaining({ predicate: 'merchant_fee', value: 5000 }),
        ]));
        expect(profile.facts.some((fact) => fact.predicate === 'guaranteed')).toBe(false);
    });

    it('cleans HTML and entities deterministically', () => {
        expect(cleanText('<p>Delivery&nbsp;&amp; COD</p>')).toBe('delivery & cod'.replace('&', '').replace(/\s+/g, ' ').trim());
        expect(refineDisplayText("Men&#039;s <b>Panjabi</b>")).toBe("Men's Panjabi");
    });

    it('refreshes reusable profiles when a merchant edits canonical records', async () => {
        await tenant(async () => {
            const product = new Product({ ...shirt, slug: 'linen-shirt', categoryId: new mongoose.Types.ObjectId(), images: [], warrantyMonths: 0, isReturnable: true, isActive: true, isFeatured: false, lowStockThreshold: 2 });
            await product.validate();
            const firstHash = product.intelligence?.sourceHash;
            product.description = 'Breathable lightweight casual shirt';
            await product.validate();
            expect(product.intelligence?.sourceHash).not.toBe(firstHash);
            expect(product.intelligence?.useCases).toContain('breathable');

            const knowledge = new Knowledge({ title: 'Delivery', content: 'Inside Dhaka 70 tk', type: 'POLICY', language: 'en', tags: [], status: 'active', sourcePriority: 'high', versionHistory: [], createdBy: 'merchant', updatedBy: 'merchant', isPinned: true });
            await knowledge.validate();
            const knowledgeHash = knowledge.intelligence?.sourceHash;
            knowledge.content = 'Inside Dhaka 80 tk';
            await knowledge.validate();
            expect(knowledge.intelligence?.sourceHash).not.toBe(knowledgeHash);
            expect(knowledge.intelligence?.facts).toContainEqual(expect.objectContaining({ value: 80 }));
        });
    });
});
