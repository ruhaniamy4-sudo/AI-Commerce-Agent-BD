import crypto from 'node:crypto';
import { Router } from 'express';
import { AuthenticatedRequest, requireAdministrator } from '../auth/middleware';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { Category } from '../models/Category';
import { Conversation } from '../models/Conversation';
import { CourierIntegration } from '../models/CourierIntegration';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { tenantDocument } from '../tenancy/context';
import { mirrorExternalProductImages } from '../services/ingestion/external-image.service';

const router = Router();
router.use(requireAdministrator);

async function checklist(businessId: string) {
    const [business, productCount, knowledgeCount, aiTestCount, facebookConnected, websiteConnected, steadfastConnected] = await Promise.all([
        Business.findById(businessId).lean(),
        Product.countDocuments({ isActive: true }),
        Knowledge.countDocuments({ status: 'active' }),
        Conversation.countDocuments({ platform: 'manual', 'metadata.testMode': true, messageCount: { $gt: 0 } }),
        BusinessChannel.exists({ businessId, platform: 'facebook', status: 'active' }),
        BusinessChannel.exists({ businessId, platform: 'web', status: 'active' }),
        CourierIntegration.exists({ provider: 'steadfast', status: 'connected' }),
    ]);
    return {
        business: Boolean(business), productAdded: productCount > 0, knowledgeAdded: knowledgeCount > 0,
        aiTested: aiTestCount > 0, facebookConnected: Boolean(facebookConnected), websiteConnected: Boolean(websiteConnected),
        steadfastConnected: Boolean(steadfastConnected), completed: Boolean(business?.onboarding?.completedAt),
        businessProfile: business ? { name: business.name, businessType: business.businessType, phone: business.phone, website: business.website, preferredLanguage: business.preferredLanguage, currency: business.currency } : null,
    };
}

router.get('/status', async (req: AuthenticatedRequest, res) => {
    res.json(await checklist(req.auth!.businessId));
});

router.post('/product', async (req: AuthenticatedRequest, res) => {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const sku = String(req.body?.sku || '').trim();
    const imageUrl = String(req.body?.imageUrl || '').trim();
    const price = Number(req.body?.price);
    const stock = Number(req.body?.stock);
    if (name.length < 2 || description.length < 5 || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0 || sku.length > 100 || imageUrl.length > 1000) {
        return res.status(400).json({ error: 'Valid product name, description, price, and stock are required' });
    }
    let category = await Category.findOne({ slug: 'onboarding-products', isActive: true });
    if (!category) category = await Category.create(tenantDocument({ name: 'Onboarding Products', slug: 'onboarding-products', description: 'Products added during setup', isActive: true }));
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'product';
    const importedImages = imageUrl ? await mirrorExternalProductImages([imageUrl], req.auth!.businessId) : { images: [], imports: [] };
    const product = await Product.create(tenantDocument({
        name, description, basePrice: price, stock, categoryId: category._id,
        slug: `${slugBase}-${crypto.randomBytes(3).toString('hex')}`,
        images: importedImages.images,
        imageImports: importedImages.imports,
        variants: sku ? [{ variantId: `default-${crypto.randomBytes(3).toString('hex')}`, name: 'Default', sku, price, stock, images: importedImages.images, isActive: true }] : [],
        specs: {}, compatibilityTags: [], isActive: true,
    }));
    await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'onboarding.productAdded': true } });
    res.status(201).json(product);
});

router.post('/knowledge', async (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    const type = ['FAQ', 'POLICY', 'GUIDE'].includes(req.body?.type) ? req.body.type : 'POLICY';
    const language = req.body?.language === 'en' ? 'en' : 'bn';
    if (title.length < 2 || title.length > 200 || content.length < 5 || content.length > 10000) return res.status(400).json({ error: 'Valid knowledge title and content are required' });
    const knowledge = await Knowledge.create(tenantDocument({ title, content, type, language, tags: [], status: 'active', sourcePriority: 'high', createdBy: req.auth!.userId, updatedBy: req.auth!.userId, isPinned: type === 'POLICY' }));
    await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'onboarding.knowledgeAdded': true } });
    res.status(201).json(knowledge);
});

router.post('/channel', async (req: AuthenticatedRequest, res) => {
    const platform = req.body?.platform;
    if (platform !== 'web') return res.status(400).json({ error: 'Website/Test chat is the supported onboarding channel. Facebook can be configured later.' });
    const externalId = `test-${req.auth!.businessId}`;
    const channel = await BusinessChannel.findOneAndUpdate(
        { platform: 'web', externalId },
        { $set: { businessId: req.auth!.businessId, name: 'Website / Test Chat', status: 'active' } },
        { upsert: true, new: true, runValidators: true }
    );
    await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'onboarding.channelConfigured': true } });
    res.json(channel);
});

router.post('/complete', async (req: AuthenticatedRequest, res) => {
    const business = await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'onboarding.completedAt': new Date() } }, { new: true });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(await checklist(req.auth!.businessId));
});

export default router;
