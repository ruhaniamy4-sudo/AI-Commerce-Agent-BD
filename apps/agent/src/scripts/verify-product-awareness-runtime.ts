import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { BusinessMember } from '../models/BusinessMember';
import { Category } from '../models/Category';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { TrainingCandidate } from '../models/TrainingCandidate';
import { TrainingRun } from '../models/TrainingRun';
import { TrainingSource } from '../models/TrainingSource';
import { BusinessAwareness } from '../models/BusinessAwareness';
import { User } from '../models/User';
import { withTenantContext, tenantDocument } from '../tenancy/context';
import { stageCandidates } from '../services/ingestion/business-ingestion.service';
import { stableFingerprint } from '../services/ingestion/normalization';
import { retrieveRelevantAwareness } from '../services/business-awareness.service';
import { ingestWebsite } from '../services/ingestion/website-ingestion.service';

async function main() {
    const businessId = String(process.env.RUNTIME_BUSINESS_ID || '');
    const mode = process.argv[2] || 'setup';
    if (!process.env.MONGODB_URI) throw new Error('Runtime database is required');
    await mongoose.connect(process.env.MONGODB_URI);
    if (mode === 'website-only') {
        if (!process.env.RUNTIME_WEBSITE_URL) throw new Error('Runtime website is required');
        const extracted = await ingestWebsite(process.env.RUNTIME_WEBSITE_URL);
        const availability: Record<string, number> = {};
        for (const product of extracted.products) availability[product.availability || 'unknown'] = (availability[product.availability || 'unknown'] || 0) + 1;
        process.stdout.write(JSON.stringify({ pages: extracted.pages, products: extracted.products.length, knowledge: extracted.knowledge.length, availability, images: extracted.products.filter((item) => item.images.length > 0).length }));
        await mongoose.disconnect(); return;
    }
    if (mode === 'cleanup-orphans') {
        const businesses = await Business.collection.find({ name: /^Runtime Milestone \d+$/ }, { projection: { _id: 1 } }).toArray();
        for (const business of businesses) {
            const objectId = business._id;
            const members = await BusinessMember.collection.find({ businessId: objectId }).toArray();
            const collections = await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray();
            for (const collection of collections) if (!['businesses', 'users', 'businessmembers'].includes(collection.name)) await mongoose.connection.db!.collection(collection.name).deleteMany({ businessId: objectId });
            await BusinessMember.collection.deleteMany({ businessId: objectId });
            for (const member of members) if (!await BusinessMember.collection.findOne({ userId: member.userId })) await User.collection.deleteOne({ _id: member.userId });
            await Business.collection.deleteOne({ _id: objectId });
        }
        process.stdout.write(JSON.stringify({ cleaned: businesses.length })); await mongoose.disconnect(); return;
    }
    if (!mongoose.isValidObjectId(businessId)) throw new Error('Runtime business is required');
    const member = await BusinessMember.collection.findOne({ businessId: new mongoose.Types.ObjectId(businessId), status: 'active' });
    if (!member) throw new Error('Runtime owner membership not found');
    if (mode === 'cleanup') {
        const objectId = new mongoose.Types.ObjectId(businessId);
        const collections = await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray();
        for (const collection of collections) {
            if (!['businesses', 'users', 'businessmembers'].includes(collection.name)) await mongoose.connection.db!.collection(collection.name).deleteMany({ businessId: objectId });
        }
        await BusinessMember.collection.deleteMany({ businessId: objectId });
        if (!await BusinessMember.collection.findOne({ userId: member.userId })) await User.collection.deleteOne({ _id: member.userId });
        await Business.collection.deleteOne({ _id: objectId });
        process.stdout.write(JSON.stringify({ cleaned: true, businessId }));
        await mongoose.disconnect(); return;
    }
    const principal = { businessId, userId: String(member.userId), membershipId: String(member._id), role: 'Owner' as const };
    const result = await withTenantContext(principal, async () => {
        if (mode === 'setup') {
            const source = await TrainingSource.create(tenantDocument({ type: 'website', name: 'Runtime Product Catalog', url: 'https://example.com/runtime-catalog', fingerprint: stableFingerprint(`runtime:${businessId}`), status: 'learning', importPreference: 'ask_during_review' }));
            const run = await TrainingRun.create(tenantDocument({ sourceId: source._id, status: 'learning', stage: 'Runtime verification', progress: 10 }));
            const products = Array.from({ length: 60 }, (_, index) => ({
                name: `Runtime ${index < 30 ? 'Kurti' : 'Shoes'} ${index + 1}`, description: 'Runtime catalog verification product', category: index < 30 ? 'Kurti' : 'Shoes',
                basePrice: 2000, salePrice: index < 10 ? 1400 : index < 20 ? 1600 : undefined, sku: `RUNTIME-${businessId.slice(-6)}-${index + 1}`,
                stock: index < 20 ? 5 : index < 40 ? 0 : undefined, availability: index < 20 ? 'in_stock' : index < 40 ? 'out_of_stock' : 'unknown',
                canonicalUrl: `https://example.com/runtime-catalog/${businessId}/${index + 1}`, images: [`https://example.com/runtime-images/${index + 1}.jpg`], variants: [], specs: {},
            }));
            let realWebsite: { products: number; pages: number; availability: Record<string, number>; error?: string } | undefined;
            if (process.env.RUNTIME_WEBSITE_URL) {
                try {
                    const extracted = await ingestWebsite(process.env.RUNTIME_WEBSITE_URL);
                    const counts: Record<string, number> = {};
                    for (const product of extracted.products) counts[product.availability || 'unknown'] = (counts[product.availability || 'unknown'] || 0) + 1;
                    products.push(...extracted.products.map((product, index) => ({ ...product, sku: product.sku || `REAL-${businessId.slice(-6)}-${index + 1}` })) as any);
                    realWebsite = { products: extracted.products.length, pages: extracted.pages, availability: counts };
                } catch (error) { realWebsite = { products: 0, pages: 0, availability: {}, error: error instanceof Error ? error.message : String(error) }; }
            }
            const stats = await stageCandidates(businessId, source._id.toString(), run._id.toString(), { products });
            if (!await Knowledge.exists({ title: 'Runtime canonical safety knowledge' })) await Knowledge.create(tenantDocument({ title: 'Runtime canonical safety knowledge', content: 'Canonical Knowledge must survive staged candidate clearing.', type: 'GUIDE', language: 'en', tags: ['runtime'], status: 'active', sourcePriority: 'normal', createdBy: principal.userId, updatedBy: principal.userId, isPinned: false, merchantConfirmed: true }));
            return { sourceId: source._id.toString(), stats, realWebsite };
        }
        const [products, knowledge, staged, imported, awareness, availability] = await Promise.all([
            Product.countDocuments(), Knowledge.countDocuments({ status: 'active' }), TrainingCandidate.countDocuments({ status: { $nin: ['imported','approved'] } }), TrainingCandidate.countDocuments({ status: 'imported' }), BusinessAwareness.countDocuments(),
            TrainingCandidate.aggregate([{ $match: { kind: 'product' } }, { $group: { _id: '$payload.availability', count: { $sum: 1 } } }]),
        ]);
        const relevant = await retrieveRelevantAwareness(businessId, 'Kurti te offer ache?');
        return { products, knowledge, staged, imported, awareness, availability: Object.fromEntries(availability.map((item: any) => [item._id, item.count])), relevant: relevant.map((item) => ({ title: item.title, validation: item.validation, status: item.status, claimType: item.claimType, claimValue: item.claimValue })) };
    });
    process.stdout.write(JSON.stringify(result));
    await mongoose.disconnect();
}

main().catch(async (error) => { process.stderr.write(error instanceof Error ? error.message : String(error)); await mongoose.disconnect(); process.exit(1); });
