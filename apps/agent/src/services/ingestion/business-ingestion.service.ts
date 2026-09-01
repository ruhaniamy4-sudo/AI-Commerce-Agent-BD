import crypto from 'node:crypto';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import { Business } from '../../models/Business';
import { Category } from '../../models/Category';
import { Knowledge } from '../../models/Knowledge';
import { Product } from '../../models/Product';
import { Offering } from '../../models/Offering';
import { TrainingCandidate, CandidateStatus } from '../../models/TrainingCandidate';
import { TrainingRun } from '../../models/TrainingRun';
import { TrainingSource } from '../../models/TrainingSource';
import { assertTenantBusinessId, tenantDocument } from '../../tenancy/context';
import { classifyProductSimilarity, knowledgeFact, normalizeCurrency, normalizeMoney, normalizeSku, normalizedText, productKey, stableFingerprint, tokenSimilarity } from './normalization';
import { ExtractedKnowledge, ExtractedProduct, WebsiteExtraction, WebsiteIngestionError, ingestWebsite } from './website-ingestion.service';
import { mirrorExternalProductImages } from './external-image.service';
import { getImageEmbedding } from '../embedding.service';
import { normalizeProductAvailability } from './product-availability';
import { defaultOfferingType, inferBusinessType, knowledgeDomain, normalizeBusinessType } from '../adaptive-training.service';

export interface CandidateInput {
    products?: ExtractedProduct[];
    knowledge?: ExtractedKnowledge[];
    business?: Record<string, string | undefined>;
    pages?: number;
    warnings?: string[];
    crawl?: WebsiteExtraction['crawl'];
}

function sourceMeta(source: any, url?: string, externalId?: string) {
    return { type: source.type, url: url || source.url, externalId: externalId || source.externalId, lastSeenAt: new Date() };
}
function productPayload(raw: ExtractedProduct) {
    const price = normalizeMoney(raw.basePrice);
    const description = String(raw.description || '').includes('<') ? cheerio.load(String(raw.description || '')).text() : String(raw.description || '');
    const name = cheerio.load(`<span>${String(raw.name || '')}</span>`).text();
    const images = [...new Set((raw.images || []).filter((url) => /^https?:\/\//i.test(String(url))))].slice(0, 12);
    const variants = (raw.variants || []).map((variant) => ({
        ...variant, name: String(variant.name || variant.specs?.color || variant.specs?.size || 'Variant').trim(),
        sku: normalizeSku(variant.sku), price: normalizeMoney(variant.price), currency: normalizeCurrency(variant.currency, raw.currency), stock: Number.isFinite(variant.stock) ? Math.max(0, Number(variant.stock)) : undefined, availability: normalizeProductAvailability(variant.availability, variant.stock),
        images: [...new Set((variant.images || []).filter((url) => /^https?:\/\//i.test(String(url))))],
        specs: Object.fromEntries(Object.entries(variant.specs || {}).filter(([, value]) => value !== undefined && value !== '')),
    }));
    return {
        name: name.trim().slice(0, 240), description: description.replace(/\s+/g, ' ').trim().slice(0, 20_000),
        category: String(raw.category || 'Imported').trim().slice(0, 120), basePrice: price, salePrice: normalizeMoney(raw.salePrice), currency: normalizeCurrency(raw.currency),
        stock: Number.isFinite(raw.stock) ? Math.max(0, Number(raw.stock)) : undefined, sku: normalizeSku(raw.sku), barcode: raw.barcode,
        availability: normalizeProductAvailability(raw.availability, raw.stock), brand: raw.brand, canonicalUrl: raw.canonicalUrl, images, variants, specs: raw.specs || {},
    };
}
function conflictsForProduct(existing: any, imported: any) {
    const conflicts: Array<{ field: string; currentValue: unknown; importedValue: unknown }> = [];
    for (const field of ['basePrice', 'salePrice', 'currency', 'stock', 'availability'] as const) {
        if (existing?.[field] !== undefined && imported[field] !== undefined && Number(existing[field]) !== Number(imported[field])) {
            conflicts.push({ field, currentValue: existing[field], importedValue: imported[field] });
        }
    }
    return conflicts;
}
function policyTopic(value: string) { return knowledgeFact(value).replace(/\d+(?:\.\d+)?/g, '#').replace(/\s+/g, ' ').trim(); }

async function upsertCandidate(source: any, run: any, values: Record<string, any>) {
    const observedAt = new Date();
    const candidateSource = { ...values.source, lastSeenAt: observedAt };
    return TrainingCandidate.findOneAndUpdate(
        { sourceId: source._id, fingerprint: values.fingerprint },
        { $set: { ...values, source: candidateSource, runId: run._id, sourceId: source._id }, $setOnInsert: tenantDocument({}) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
}

export async function stageCandidates(businessId: string, sourceId: string, runId: string, input: CandidateInput) {
    assertTenantBusinessId(businessId, 'ingestion.stage');
    const [source, run, currentBusiness] = await Promise.all([TrainingSource.findById(sourceId), TrainingRun.findById(runId), Business.findById(businessId).lean()]);
    if (!source || !run) throw new Error('Training source or run is unavailable');
    const inferenceText = [
        ...(input.products || []).flatMap((item) => [item.name, item.description, item.category]),
        ...(input.knowledge || []).flatMap((item) => [item.title, item.content, item.topic]),
        ...Object.values(input.business || {}),
    ].filter(Boolean).join(' ');
    const inference = inferBusinessType(inferenceText) || ((input.products || []).length ? { businessType: 'ECOMMERCE' as const, confidence: .65, evidence: ['catalog-like offerings'] } : undefined);
    if (inference && currentBusiness?.businessTypeStatus !== 'confirmed') {
        await Business.findByIdAndUpdate(businessId, { $set: {
            businessType: inference.businessType, businessTypeStatus: 'inferred',
            businessTypeInference: { value: inference.businessType, confidence: inference.confidence, evidence: inference.evidence, sourceId: source._id, inferredAt: new Date() },
        } });
    }
    const businessType = normalizeBusinessType(currentBusiness?.businessTypeStatus === 'confirmed' ? currentBusiness.businessType : inference?.businessType || currentBusiness?.businessType) || 'ECOMMERCE';
    const stats = {
        pages: input.pages || 0, discovered: input.crawl?.discovered || input.pages || 0, productUrls: input.crawl?.productUrls || 0,
        remaining: input.crawl?.remaining || 0, failed: input.crawl?.failed || 0, fetches: input.crawl?.fetches || 0,
        aiCalls: input.crawl?.aiCalls || 0, pagesWithoutAI: input.crawl?.pagesWithoutAI || 0,
        unchanged: input.crawl?.unchanged || 0, changed: input.crawl?.changed || 0, newPages: input.crawl?.newPages || 0, durationMs: input.crawl?.durationMs || 0,
        products: 0, knowledge: 0, duplicates: 0, conflicts: 0, needsAttention: 0,
    };
    const seenProducts = new Set<string>();
    const seenKnowledge = new Set<string>();

    for (const raw of input.products || []) {
        const payload = productPayload(raw);
        const key = productKey(payload);
        if (seenProducts.has(key)) { stats.duplicates += 1; continue; }
        seenProducts.add(key);
        const fingerprint = stableFingerprint(key);
        let status: CandidateStatus = payload.name.length < 2 || payload.basePrice === undefined || !payload.currency ? 'needs_attention' : 'ready';
        let duplicateKind: 'exact' | 'probable' | undefined;
        let matchedRecordId: mongoose.Types.ObjectId | undefined;
        let conflictFields: Array<{ field: string; currentValue: unknown; importedValue: unknown }> = [];
        if (businessType !== 'ECOMMERCE') {
            const offeringPayload = {
                offeringType: defaultOfferingType(businessType), name: payload.name, description: payload.description,
                category: payload.category, price: payload.basePrice, salePrice: payload.salePrice, currency: payload.currency,
                availability: payload.availability, attributes: { ...payload.specs, variants: payload.variants }, images: payload.images,
                canonicalUrl: payload.canonicalUrl,
            };
            const existingOffering = await Offering.findOne({ $or: [
                ...(payload.canonicalUrl ? [{ canonicalUrl: payload.canonicalUrl }] : []),
                { name: { $regex: `^${payload.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            ] }).lean();
            if (existingOffering) { duplicateKind = 'exact'; matchedRecordId = existingOffering._id; status = 'possible_duplicate'; stats.duplicates += 1; }
            if (!payload.name) { status = 'needs_attention'; stats.needsAttention += 1; }
            await upsertCandidate(source, run, { kind: 'offering', status, title: payload.name || 'Unnamed offering', normalizedKey: key, fingerprint, confidence: status === 'ready' ? 1 : .75, payload: offeringPayload, source: sourceMeta(source, payload.canonicalUrl), duplicateKind, matchedRecordId, conflictFields });
            stats.products += 1;
            continue;
        }
        const exactQueries: Record<string, unknown>[] = [];
        if (payload.sku) exactQueries.push({ 'variants.sku': payload.sku });
        if (payload.barcode) exactQueries.push({ barcode: payload.barcode });
        if (payload.canonicalUrl) exactQueries.push({ canonicalUrl: payload.canonicalUrl });
        let existing = exactQueries.length ? await Product.findOne({ $or: exactQueries }).lean() : null;
        if (!existing && payload.name) {
            const possible = await Product.find({ name: { $regex: payload.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/).slice(0, 2).join('.*'), $options: 'i' } }).limit(20).lean();
            existing = possible.find((item) => classifyProductSimilarity(payload, item) !== 'different') || null;
        }
        if (existing) {
            duplicateKind = classifyProductSimilarity(payload, existing) === 'exact' ? 'exact' : 'probable';
            matchedRecordId = existing._id;
            conflictFields = conflictsForProduct(existing, payload);
            if (conflictFields.length) { status = 'conflict'; stats.conflicts += 1; }
            else if (duplicateKind === 'probable') { status = 'possible_duplicate'; stats.duplicates += 1; }
            else stats.duplicates += 1;
        } else {
            const staged = await TrainingCandidate.findOne({ kind: 'product', sourceId: { $ne: source._id }, status: { $nin: ['rejected'] }, normalizedKey: key }).lean();
            if (staged) { duplicateKind = 'exact'; stats.duplicates += 1; }
        }
        if (status === 'needs_attention') stats.needsAttention += 1;
        await upsertCandidate(source, run, { kind: 'product', status, title: payload.name || 'Unnamed product', normalizedKey: key, fingerprint, confidence: status === 'ready' ? 1 : .75, payload, source: sourceMeta(source, payload.canonicalUrl), duplicateKind, matchedRecordId, conflictFields });
        stats.products += 1;
    }

    for (const raw of input.knowledge || []) {
        const content = String(raw.content || '').replace(/\s+/g, ' ').trim().slice(0, 20_000);
        if (!content) continue;
        const fact = knowledgeFact(content);
        if (seenKnowledge.has(fact)) { stats.duplicates += 1; continue; }
        seenKnowledge.add(fact);
        const topic = policyTopic(`${raw.title} ${content.slice(0, 500)}`);
        const fingerprint = stableFingerprint(fact);
        let status: CandidateStatus = content.length < 20 || (raw.confidence !== undefined && raw.confidence < .75) ? 'needs_attention' : 'ready';
        let duplicateKind: 'exact' | 'probable' | undefined;
        let matchedRecordId: mongoose.Types.ObjectId | undefined;
        let conflictFields: Array<{ field: string; currentValue: unknown; importedValue: unknown }> = [];
        const existing = await Knowledge.findOne({ $or: [{ fingerprint }, { normalizedFact: fact }] }).lean();
        if (existing) { duplicateKind = 'exact'; matchedRecordId = existing._id; stats.duplicates += 1; }
        else {
            const likely = await Knowledge.find({ type: raw.type, status: 'active' }).limit(100).lean();
            const similar = likely.find((item) => tokenSimilarity(policyTopic(`${item.title} ${item.content}`), topic) >= .72);
            if (similar) {
                matchedRecordId = similar._id;
                const currentNumbers = String(similar.content).match(/\d+(?:\.\d+)?/g) || [];
                const importedNumbers = content.match(/\d+(?:\.\d+)?/g) || [];
                if (currentNumbers.join(',') !== importedNumbers.join(',')) {
                    status = 'conflict'; conflictFields = [{ field: 'content', currentValue: similar.content, importedValue: content }]; stats.conflicts += 1;
                } else { status = 'possible_duplicate'; duplicateKind = 'probable'; stats.duplicates += 1; }
            }
        }
        if (status === 'needs_attention') stats.needsAttention += 1;
        await upsertCandidate(source, run, { kind: 'knowledge', status, title: String(raw.title || 'Business information').slice(0, 200), normalizedKey: topic, fingerprint, confidence: raw.confidence ?? (status === 'ready' ? 1 : .75), payload: { title: raw.title, content, type: raw.type, topic: raw.topic, language: 'bn', normalizedFact: fact, businessType, knowledgeDomain: knowledgeDomain(businessType, `${raw.title} ${content}`) }, source: sourceMeta(source, raw.sourceUrl), duplicateKind, matchedRecordId, conflictFields });
        stats.knowledge += 1;
    }

    const allowedBusinessFields = ['name', 'description', 'phone', 'email', 'address', 'openingHours', 'socialLinks'];
    for (const field of allowedBusinessFields) {
        const value = String(input.business?.[field] || '').trim();
        if (!value) continue;
        const currentValue = (currentBusiness as any)?.[field];
        const conflictFields = currentValue && normalizedText(currentValue) !== normalizedText(value) ? [{ field, currentValue, importedValue: value }] : [];
        const fingerprint = stableFingerprint(`business:${field}`);
        await upsertCandidate(source, run, { kind: 'business', status: conflictFields.length ? 'conflict' : 'ready', title: field.replace(/([A-Z])/g, ' $1'), normalizedKey: `business:${field}`, fingerprint, confidence: 1, payload: { field, value }, source: sourceMeta(source), conflictFields });
        if (conflictFields.length) stats.conflicts += 1;
    }
    const runStatus = stats.remaining || stats.failed ? 'partial' : 'needs_review';
    await TrainingRun.findByIdAndUpdate(run._id, { $set: { stats, status: runStatus, stage: stats.remaining ? `Ready for review · ${stats.remaining} pages remain for another bounded scan` : 'Ready for your review', progress: 100, completedAt: new Date() } });
    await TrainingSource.findByIdAndUpdate(source._id, { $set: { status: stats.conflicts || stats.needsAttention ? 'needs_attention' : 'ready', stats, lastSeenAt: new Date(), lastSyncedAt: new Date(), errorCode: null, errorMessage: null } });
    await Business.findByIdAndUpdate(businessId, { $set: { 'training.status': 'needs_review', 'training.needsReview': stats.conflicts + stats.needsAttention, 'training.lastSyncedAt': new Date() } });
    return stats;
}

export async function runWebsiteIngestion(businessId: string, sourceId: string, runId: string, options?: { failedOnly?: boolean }) {
    assertTenantBusinessId(businessId, 'ingestion.website');
    const [source, business] = await Promise.all([TrainingSource.findById(sourceId), Business.findById(businessId).lean()]);
    if (!source?.url) throw new Error('Website source is unavailable');
    await Promise.all([
        source.updateOne({ $set: { status: 'learning' } }),
        TrainingRun.findByIdAndUpdate(runId, { $set: { status: 'learning', stage: 'Scanning your business...', progress: 5, startedAt: new Date() } }),
        Business.findByIdAndUpdate(businessId, { $set: { 'training.status': 'learning' } }),
    ]);
    try {
        const extracted: WebsiteExtraction = await ingestWebsite(source.url, (stage, progress, stats) => TrainingRun.findByIdAndUpdate(runId, { $set: {
            stage, progress, ...(stats ? { 'stats.discovered': stats.discovered, 'stats.pages': stats.pages, 'stats.productUrls': stats.productUrls, 'stats.remaining': stats.remaining, 'stats.failed': stats.failed, 'stats.fetches': stats.fetches } : {}),
        } }).then(() => undefined), {
            previousPages: source.crawlPages || [],
            retryUrls: options?.failedOnly ? (source.crawlPages || []).filter((page) => page.status === 'failed').map((page) => page.url) : undefined,
            businessType: normalizeBusinessType(business?.businessType),
        });
        if (extracted.crawl?.pages) {
            const pageMap = new Map<string, any>();
            if (options?.failedOnly) for (const page of source.crawlPages || []) pageMap.set(page.url, (page as any).toObject?.() || page);
            for (const page of extracted.crawl.pages) pageMap.set(page.url, page);
            const crawlPages = [...pageMap.values()];
            await TrainingSource.findByIdAndUpdate(sourceId, { $set: { crawlPages } });
        }
        return await stageCandidates(businessId, sourceId, runId, extracted);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Website import failed';
        console.error('Website ingestion failed:', message);
        const code = error instanceof WebsiteIngestionError ? error.code : 'CRAWLER_FAILURE';
        const merchantMessage = code === 'TIMEOUT' ? "The website didn't respond in time. Try again."
            : code === 'UNREACHABLE' ? "We couldn't reach this website. Check the link and try again."
            : code === 'BLOCKED' ? "This website couldn't be accessed for learning."
            : "We couldn't finish learning from this website. Please try again.";
        const hasOtherResults = Boolean(await TrainingSource.exists({ _id: { $ne: source._id }, status: { $in: ['ready', 'needs_attention'] } }));
        await Promise.all([
            TrainingRun.findByIdAndUpdate(runId, { $set: { status: 'error', stage: 'Learning failed', progress: 0, errorCode: code, errorMessage: merchantMessage, completedAt: new Date() } }),
            TrainingSource.findByIdAndUpdate(sourceId, { $set: { status: 'error', errorCode: code, errorMessage: merchantMessage } }),
            Business.findByIdAndUpdate(businessId, { $set: { 'training.status': hasOtherResults ? 'needs_review' : 'error' } }),
        ]);
        throw error;
    }
}

function slug(value: string) { return normalizedText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || `imported-${crypto.randomBytes(4).toString('hex')}`; }
function provenance(candidate: any) { return { sourceType: candidate.source.type, sourceUrl: candidate.source.url, sourceExternalId: candidate.source.externalId, fingerprint: candidate.fingerprint, lastSeenAt: candidate.source.lastSeenAt || new Date(), lastSyncedAt: new Date() }; }

async function refreshApprovedImageIndex(product: InstanceType<typeof Product>) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
    const images = [...new Set((product.images || []).filter(Boolean))];
    if (!images.length) return;
    try {
        const results = await Promise.all(images.map((url) => getImageEmbedding(url)));
        product.imageEmbeddings = results.map((result, index) => ({ url: images[index], embedding: result.embedding, model: result.model, updatedAt: new Date() }));
        product.imageEmbedding = results[0].embedding; product.imageEmbeddingModel = results[0].model; product.lastEmbeddingUpdate = new Date();
        await product.save();
    } catch (error) {
        console.warn(`Product ${product._id} was approved without a vision index: ${error instanceof Error ? error.message : 'embedding unavailable'}`);
    }
}

async function promoteClaimedCandidate(businessId: string, candidateId: string, userId: string) {
    assertTenantBusinessId(businessId, 'ingestion.approve');
    const candidate = await TrainingCandidate.findById(candidateId);
    if (!candidate) throw new Error('Candidate not found');
    if (candidate.status === 'conflict' || candidate.status === 'needs_attention' || candidate.status === 'possible_duplicate') throw new Error('Resolve this item before approval');
    if (candidate.status === 'imported') return candidate;
    if (candidate.kind === 'product') {
        const data = candidate.payload;
        const imageImport = await mirrorExternalProductImages(Array.isArray(data.images) ? data.images : [], businessId);
        let existing = candidate.matchedRecordId ? await Product.findById(candidate.matchedRecordId) : null;
        if (!existing) {
            const exact: Record<string, unknown>[] = [];
            if (data.sku) exact.push({ 'variants.sku': data.sku });
            if (data.barcode) exact.push({ barcode: data.barcode });
            if (data.canonicalUrl) exact.push({ canonicalUrl: data.canonicalUrl });
            if (exact.length) existing = await Product.findOne({ $or: exact });
        }
        if (existing) {
            for (const field of data.resolvedFields || []) {
                if (['basePrice', 'salePrice', 'currency', 'stock', 'availability'].includes(field) && data[field] !== undefined) (existing as any)[field] = data[field];
            }
            existing.provenance = [...(existing.provenance || []).filter((item: any) => item.fingerprint !== candidate.fingerprint), provenance(candidate)];
            if (imageImport.images.length && !existing.images?.length) existing.images = imageImport.images;
            if (imageImport.imports.length) existing.imageImports = imageImport.imports;
            await existing.save();
            if (imageImport.images.length) void refreshApprovedImageIndex(existing);
            candidate.matchedRecordId = existing._id;
        } else {
            const categoryName = data.category || 'Imported';
            const categorySlug = slug(normalizedText(categoryName).replace(/\s+/g, ''));
            let category = await Category.findOne({ slug: categorySlug, isActive: true });
            if (!category) category = await Category.create(tenantDocument({ name: categoryName, slug: categorySlug, isActive: true, order: 0 }));
            const product = await Product.create(tenantDocument({
                name: data.name, slug: `${slug(data.name)}-${candidate.fingerprint.slice(0, 8)}`, description: data.description || data.name,
                categoryId: category._id, basePrice: data.basePrice, salePrice: data.salePrice, currency: data.currency, stock: data.stock ?? null,
                variants: (data.variants?.length ? data.variants : data.sku ? [{ name: 'Default', sku: data.sku, price: data.basePrice, currency: data.currency, stock: data.stock, availability: data.availability, images: data.images || [], specs: {} }] : []).map((variant: any, index: number) => ({ variantId: `import-${index}-${candidate.fingerprint.slice(0, 6)}`, name: variant.name || 'Variant', sku: variant.sku || `${candidate.fingerprint.slice(0, 10)}-${index}`, price: variant.price ?? data.basePrice, currency: variant.currency || data.currency, stock: variant.stock ?? null, availability: variant.availability || normalizeProductAvailability(undefined, variant.stock), images: variant.images || [], specs: variant.specs || {}, isActive: true })),
                specs: data.specs || {}, compatibilityTags: [], images: imageImport.images, imageImports: imageImport.imports, barcode: data.barcode, brand: data.brand,
                canonicalUrl: data.canonicalUrl, warrantyMonths: 0, isReturnable: true, returnDays: 7, isActive: true, isFeatured: false,
                lowStockThreshold: 10, availability: data.availability, provenance: [provenance(candidate)], merchantConfirmed: true,
            }));
            candidate.matchedRecordId = product._id;
            void refreshApprovedImageIndex(product);
        }
    } else if (candidate.kind === 'offering') {
        const data = candidate.payload;
        let existing = candidate.matchedRecordId ? await Offering.findById(candidate.matchedRecordId) : null;
        if (!existing && data.canonicalUrl) existing = await Offering.findOne({ canonicalUrl: data.canonicalUrl });
        const values = { ...data, fingerprint: candidate.fingerprint, provenance: [provenance(candidate)], merchantConfirmed: true, createdBy: userId, updatedBy: userId };
        if (existing) {
            Object.assign(existing, values, { provenance: [...(existing.provenance || []).filter((item: any) => item.fingerprint !== candidate.fingerprint), provenance(candidate)] });
            await existing.save();
        } else existing = await Offering.create(tenantDocument(values));
        candidate.matchedRecordId = existing._id;
    } else if (candidate.kind === 'knowledge') {
        const data = candidate.payload;
        let existing = await Knowledge.findOne({ $or: [{ fingerprint: candidate.fingerprint }, { normalizedFact: data.normalizedFact }] });
        if (existing) {
            if ((data.resolvedFields || []).includes('content')) {
                existing.content = data.content; existing.normalizedFact = data.normalizedFact; existing.updatedBy = userId;
            }
            existing.businessType = data.businessType || existing.businessType;
            existing.knowledgeDomain = data.knowledgeDomain || existing.knowledgeDomain;
            existing.provenance = [...(existing.provenance || []).filter((item: any) => item.fingerprint !== candidate.fingerprint), provenance(candidate)];
            await existing.save(); candidate.matchedRecordId = existing._id;
        } else {
            existing = await Knowledge.create(tenantDocument({ title: data.title, content: data.content, type: data.type, language: data.language || 'bn', tags: normalizedText(`${data.title} ${data.content}`).split(' ').slice(0, 12), status: 'active', sourcePriority: 'normal', createdBy: userId, updatedBy: userId, isPinned: data.type === 'POLICY', normalizedFact: data.normalizedFact, fingerprint: candidate.fingerprint, provenance: [provenance(candidate)], merchantConfirmed: true, businessType: data.businessType, knowledgeDomain: data.knowledgeDomain }));
            candidate.matchedRecordId = existing._id;
        }
    } else {
        const { field, value } = candidate.payload;
        if (!['name', 'phone', 'website', 'businessType'].includes(field)) {
            await Knowledge.create(tenantDocument({ title: candidate.title, content: String(value), type: 'GUIDE', language: 'bn', tags: [field], status: 'active', sourcePriority: 'normal', createdBy: userId, updatedBy: userId, isPinned: false, normalizedFact: knowledgeFact(value), fingerprint: candidate.fingerprint, provenance: [provenance(candidate)], merchantConfirmed: true }));
        } else await Business.findByIdAndUpdate(businessId, { $set: { [field]: value } });
    }
    candidate.status = 'imported'; candidate.approvedBy = userId; candidate.approvedAt = new Date();
    await candidate.save();
    const [productsImported, knowledgeImported, needsReview] = await Promise.all([
        TrainingCandidate.countDocuments({ kind: { $in: ['product', 'offering'] }, status: 'imported' }),
        TrainingCandidate.countDocuments({ kind: { $in: ['knowledge', 'business'] }, status: 'imported' }),
        TrainingCandidate.countDocuments({ status: { $in: ['possible_duplicate', 'conflict', 'needs_attention'] } }),
    ]);
    await Business.findByIdAndUpdate(businessId, { $set: { 'training.status': needsReview ? 'needs_review' : 'ready', 'training.productsImported': productsImported, 'training.knowledgeImported': knowledgeImported, 'training.needsReview': needsReview, 'onboarding.productAdded': productsImported > 0, 'onboarding.knowledgeAdded': knowledgeImported > 0 } });
    return candidate;
}

export async function approveCandidate(businessId: string, candidateId: string, userId: string) {
    assertTenantBusinessId(businessId, 'ingestion.approve');
    const current = await TrainingCandidate.findById(candidateId);
    if (!current) throw new Error('Candidate not found');
    if (current.status === 'imported') return current;
    const candidate = await TrainingCandidate.findOneAndUpdate(
        { _id: candidateId, status: { $in: ['ready', 'failed', 'approved'] } },
        { $set: { status: 'approving' }, $unset: { lastError: 1 }, $inc: { approvalAttempts: 1 } },
        { new: true }
    );
    if (!candidate) throw new Error(current.status === 'approving' ? 'Approval is already in progress' : 'Resolve this item before approval');
    try {
        return await promoteClaimedCandidate(businessId, candidateId, userId);
    } catch (error) {
        await TrainingCandidate.updateOne(
            { _id: candidateId, status: 'approving' },
            { $set: { status: 'failed', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Approval failed' } }
        );
        throw error;
    }
}
