import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, requireAdministrator } from '../auth/middleware';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { Offering } from '../models/Offering';
import { TrainingCandidate } from '../models/TrainingCandidate';
import { TrainingRun } from '../models/TrainingRun';
import { TrainingSource } from '../models/TrainingSource';
import { tenantDocument, withTenantContext } from '../tenancy/context';
import { approveCandidate, runWebsiteIngestion, stageCandidates } from '../services/ingestion/business-ingestion.service';
import { DEFAULT_MAX_TRAINING_FILE_BYTES, extractFile, FileIngestionError, validateTrainingFile } from '../services/ingestion/file-ingestion.service';
import { FacebookPermissionError, importAuthorizedFacebookPage } from '../services/ingestion/facebook-ingestion.service';
import { syncAuthorizedFacebookAwareness } from '../services/ingestion/facebook-awareness.service';
import { canonicalUrl, knowledgeFact, stableFingerprint } from '../services/ingestion/normalization';
import { validatePublicUrl } from '../services/ingestion/url-security';
import { BusinessAwareness } from '../models/BusinessAwareness';
import { upsertBusinessAwareness } from '../services/business-awareness.service';
import { ingestWebsite } from '../services/ingestion/website-ingestion.service';
import { BUSINESS_TYPE_OPTIONS, BUSINESS_TYPES, getBusinessSetupQuestions, getFaqTemplates, getLeadFields, getTrainingPlan, normalizeBusinessType, safeReferenceInsights, testPrompts } from '../services/adaptive-training.service';

const router = Router();
router.use(requireAdministrator);
const maxTrainingFileBytes = DEFAULT_MAX_TRAINING_FILE_BYTES;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxTrainingFileBytes, files: 1 } });
const APPROVAL_BATCH_SIZE = 25;

export function candidateFilter(input: Record<string, any>, options: { approvable?: boolean } = {}) {
    const query: Record<string, any> = {};
    if (input.kind) query.kind = input.kind;
    if (input.sourceId) query.sourceId = input.sourceId;
    if (input.availability && input.availability !== 'all') query['payload.availability'] = input.availability;
    if (input.category && input.category !== 'all') query['payload.category'] = String(input.category).slice(0, 120);
    if (input.search) {
        const escaped = String(input.search).trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (escaped) query.$or = [{ title: { $regex: escaped, $options: 'i' } }, { 'payload.sku': { $regex: escaped, $options: 'i' } }];
    }
    if (options.approvable) query.status = 'ready';
    else if (input.status && input.status !== 'all') query.status = input.status === 'approved' ? 'imported' : input.status;
    return query;
}

async function createRun(source: InstanceType<typeof TrainingSource>) {
    return TrainingRun.create(tenantDocument({ sourceId: source._id, status: 'queued', stage: 'Preparing your SellPilot...', progress: 0 }));
}
function runDetached(req: AuthenticatedRequest, work: () => Promise<unknown>) {
    const principal = { ...req.auth! };
    setImmediate(() => withTenantContext(principal, async () => { try { await work(); } catch (error) { console.warn(`Business ingestion stopped: ${error instanceof Error ? error.message : 'unknown error'}`); } }));
}
async function markSourceFailure(businessId: string, sourceId: string) {
    const hasOtherResults = Boolean(await TrainingSource.exists({ _id: { $ne: sourceId }, status: { $in: ['ready', 'needs_attention'] } }));
    await Business.findByIdAndUpdate(businessId, { $set: { 'training.status': hasOtherResults ? 'needs_review' : 'error' } });
}

router.get('/status', async (req: AuthenticatedRequest, res) => {
    const [business, sources, latestRun, groups, productSamples, knowledgeSamples, offeringSamples] = await Promise.all([
        Business.findById(req.auth!.businessId).lean(), TrainingSource.find().sort({ updatedAt: -1 }).lean(),
        TrainingRun.findOne().sort({ createdAt: -1 }).lean(),
        TrainingCandidate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Product.find({ isActive: true }).limit(3).select('name variants').lean(), Knowledge.find({ status: 'active' }).limit(100).select('title type content knowledgeDomain setupQuestionKey structuredValue updatedAt').lean(),
        Offering.find({ status: 'active' }).limit(20).select('name offeringType description').lean(),
    ]);
    const candidateCounts = Object.fromEntries(groups.map((group: any) => [group._id, group.count]));
    const plan = getTrainingPlan(business || {}, {
        facts: knowledgeSamples.map((entry: any) => `${entry.title} ${entry.content} ${entry.knowledgeDomain || ''}`).join(' '),
        productCount: productSamples.length, offeringCount: offeringSamples.length, answeredKeys: knowledgeSamples.map((entry: any) => entry.setupQuestionKey).filter(Boolean),
    });
    const suggestedQuestions = testPrompts(business?.businessType);
    res.json({
        training: business?.training || { status: 'not_started' }, sources, latestRun, candidateCounts,
        businessProfile: { businessType: business?.businessType, businessSubType: business?.businessSubType, customBusinessType: business?.customBusinessType, secondaryBusinessTypes: business?.secondaryBusinessTypes || [], status: business?.businessTypeStatus || 'unconfirmed', inference: business?.businessTypeInference },
        businessTypeOptions: BUSINESS_TYPE_OPTIONS, gaps: plan.gaps, missing: plan.gaps.map((gap) => gap.question),
        readiness: { ready: plan.ready, critical: plan.gaps.filter((gap) => gap.priority === 'CRITICAL').length, important: plan.gaps.filter((gap) => gap.priority === 'IMPORTANT').length, optional: plan.gaps.filter((gap) => gap.priority === 'OPTIONAL').length },
        setupQuestions: Object.fromEntries(BUSINESS_TYPES.map((type) => [type, getBusinessSetupQuestions(type)])),
        setupAnswers: Object.fromEntries(knowledgeSamples.filter((entry: any) => entry.setupQuestionKey).map((entry: any) => [entry.setupQuestionKey, { value: entry.structuredValue ?? entry.content, updatedAt: entry.updatedAt }])),
        faqTemplates: getFaqTemplates(business?.businessType), leadFields: getLeadFields(business?.businessType), suggestedQuestions,
    });
});

router.patch('/business-profile', async (req: AuthenticatedRequest, res) => {
    const businessType = normalizeBusinessType(req.body?.businessType);
    if (!businessType) return res.status(400).json({ error: 'Choose a supported business type' });
    const secondaryBusinessTypes = Array.isArray(req.body?.secondaryBusinessTypes)
        ? [...new Set(req.body.secondaryBusinessTypes.map(normalizeBusinessType).filter(Boolean))].filter((value) => value !== businessType).slice(0, 4)
        : [];
    const business = await Business.findByIdAndUpdate(req.auth!.businessId, { $set: {
        businessType, businessSubType: String(req.body?.businessSubType || '').trim().slice(0, 120),
        customBusinessType: String(req.body?.customBusinessType || '').trim().slice(0, 160), secondaryBusinessTypes,
        businessTypeStatus: 'confirmed',
    } }, { new: true, runValidators: true });
    res.json(business);
});

router.post('/business-profile/confirm', async (req: AuthenticatedRequest, res) => {
    const current = await Business.findById(req.auth!.businessId).lean();
    const businessType = normalizeBusinessType(req.body?.businessType || current?.businessTypeInference?.value || current?.businessType);
    if (!businessType) return res.status(400).json({ error: 'There is no inferred business type to confirm' });
    const business = await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { businessType, businessTypeStatus: 'confirmed' } }, { new: true, runValidators: true });
    res.json(business);
});

router.put('/business-facts/:key', async (req: AuthenticatedRequest, res) => {
    const business = await Business.findById(req.auth!.businessId).select('businessType').lean();
    const type = normalizeBusinessType(business?.businessType);
    const question = getBusinessSetupQuestions(type).find((item) => item.id === req.params.key);
    if (!type || !question) return res.status(400).json({ error: 'This question does not apply to the current business type' });
    const rawValue = req.body?.value;
    const value = Array.isArray(rawValue) ? rawValue.map((item) => String(item).trim()).filter(Boolean).slice(0, 30) : String(rawValue ?? '').trim();
    if ((Array.isArray(value) && !value.length) || (!Array.isArray(value) && !value)) return res.status(400).json({ error: 'Choose or enter an answer before saving' });
    const content = Array.isArray(value) ? value.join(', ') : value;
    if (content.length > 8_000) return res.status(400).json({ error: 'Please keep this answer under 8,000 characters' });
    const fingerprint = stableFingerprint(`business-setup:${req.params.key}`);
    const now = new Date();
    const fact = await Knowledge.findOneAndUpdate(
        { setupQuestionKey: req.params.key },
        { $set: { title: question.question, content, type: question.domain === 'RETURN' || question.domain === 'POLICY' ? 'POLICY' : 'GUIDE', language: 'en', tags: [question.id, question.domain.toLowerCase()], status: 'active', sourcePriority: 'high', updatedBy: req.auth!.userId, isPinned: true, normalizedFact: knowledgeFact(content), fingerprint, merchantConfirmed: true, businessType: type, knowledgeDomain: question.domain, setupQuestionKey: question.id, structuredValue: value, factSource: 'BUSINESS_SETUP', provenance: [{ sourceType: 'manual', fingerprint, lastSeenAt: now, lastSyncedAt: now }] }, $setOnInsert: tenantDocument({ createdBy: req.auth!.userId, versionHistory: [] }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ key: question.id, value: fact.structuredValue, updatedAt: fact.updatedAt });
});

router.post('/sources/reference', async (req: AuthenticatedRequest, res) => {
    const safe = await validatePublicUrl(String(req.body?.url || ''));
    const url = canonicalUrl(safe.toString())!;
    const fingerprint = stableFingerprint(`reference:${safe.origin}${safe.pathname}`);
    const source = await TrainingSource.findOneAndUpdate(
        { type: 'reference', fingerprint },
        { $set: { name: String(req.body?.label || safe.hostname).slice(0, 160), url, status: 'learning', errorCode: null, errorMessage: null }, $setOnInsert: tenantDocument({ type: 'reference', fingerprint }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await Business.findByIdAndUpdate(req.auth!.businessId, { $addToSet: { businessReferences: { url, label: String(req.body?.label || safe.hostname).slice(0, 160), sourceId: source._id } } });
    runDetached(req, async () => {
        try {
            const extracted = await ingestWebsite(url);
            const structureText = [
                ...extracted.products.flatMap((item) => [item.name, item.category, item.description]),
                ...extracted.knowledge.flatMap((item) => [item.title, item.topic, item.content]),
            ].filter(Boolean).join(' ');
            const business = await Business.findById(req.auth!.businessId).lean();
            await TrainingSource.findByIdAndUpdate(source._id, { $set: { status: 'ready', lastSyncedAt: new Date(), referenceInsights: safeReferenceInsights(structureText, business?.businessType) } });
        } catch (error) {
            await TrainingSource.findByIdAndUpdate(source._id, { $set: { status: 'error', errorCode: 'REFERENCE_SCAN_FAILED', errorMessage: 'This reference could not be analyzed safely.' } });
        }
    });
    res.status(202).json(source);
});

router.post('/sources/website', async (req: AuthenticatedRequest, res) => {
    const safe = await validatePublicUrl(String(req.body?.url || ''));
    const url = canonicalUrl(safe.toString())!;
    const fingerprint = stableFingerprint(`website:${safe.origin}`);
    const source = await TrainingSource.findOneAndUpdate(
        { type: 'website', fingerprint },
        { $set: { name: safe.hostname, url, status: 'connected', errorCode: null, errorMessage: null }, $setOnInsert: tenantDocument({ type: 'website', fingerprint }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const run = await createRun(source);
    runDetached(req, () => runWebsiteIngestion(req.auth!.businessId, source._id.toString(), run._id.toString()));
    res.status(202).json({ source, run });
});

router.post('/sources/:id/rescan', async (req: AuthenticatedRequest, res) => {
    const source = await TrainingSource.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const run = await createRun(source);
    if (source.type === 'website') runDetached(req, () => runWebsiteIngestion(req.auth!.businessId, source._id.toString(), run._id.toString()));
    else return res.status(409).json({ error: 'Use the relevant Facebook or file action to refresh this source' });
    res.status(202).json({ source, run });
});

router.patch('/sources/:id/import-preference', async (req: AuthenticatedRequest, res) => {
    const preference = String(req.body?.importPreference || '');
    if (!['in_stock_only', 'all', 'ask_during_review'].includes(preference)) return res.status(400).json({ error: 'Choose a valid product import preference' });
    const source = await TrainingSource.findByIdAndUpdate(req.params.id, { $set: { importPreference: preference } }, { new: true });
    if (!source) return res.status(404).json({ error: 'Source not found' });
    await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'training.importPreference': preference } });
    res.json(source);
});

router.post('/sources/:id/clear-staged', async (req: AuthenticatedRequest, res) => {
    if (req.body?.confirm !== 'CLEAR_STAGED_CANDIDATES') return res.status(400).json({ error: 'Confirmation is required' });
    const source = await TrainingSource.findById(req.params.id).select('_id').lean();
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const result = await TrainingCandidate.deleteMany({ sourceId: source._id, status: { $nin: ['imported','approved','approving'] } });
    res.json({ cleared: result.deletedCount });
});

router.post('/sources/:id/start-fresh', async (req: AuthenticatedRequest, res) => {
    if (req.body?.confirm !== 'START_FRESH_SCAN') return res.status(400).json({ error: 'Confirmation is required' });
    const source = await TrainingSource.findById(req.params.id);
    if (!source || source.type !== 'website') return res.status(404).json({ error: 'Website source not found' });
    const cleared = await TrainingCandidate.deleteMany({ sourceId: source._id, status: { $nin: ['imported','approved','approving'] } });
    source.crawlPages = []; await source.save();
    const run = await createRun(source);
    runDetached(req, () => runWebsiteIngestion(req.auth!.businessId, source._id.toString(), run._id.toString()));
    res.status(202).json({ source, run, cleared: cleared.deletedCount });
});

router.post('/sources/:id/retry-failed', async (req: AuthenticatedRequest, res) => {
    const source = await TrainingSource.findById(req.params.id);
    if (!source || source.type !== 'website') return res.status(404).json({ error: 'Website source not found' });
    const failed = (source.crawlPages || []).filter((page) => page.status === 'failed');
    if (!failed.length) return res.status(409).json({ error: 'There are no failed pages to retry' });
    const run = await createRun(source);
    runDetached(req, () => runWebsiteIngestion(req.auth!.businessId, source._id.toString(), run._id.toString(), { failedOnly: true }));
    res.status(202).json({ source, run, failedPages: failed.length });
});

router.post('/sources/file', upload.single('file'), async (req: AuthenticatedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF, DOCX, TXT, CSV, or XLSX file' });
    const buffer = Buffer.from(req.file.buffer);
    const validated = validateTrainingFile(req.file.originalname, req.file.mimetype, buffer, maxTrainingFileBytes);
    const extracted = await extractFile(validated.filename, buffer);
    const fingerprint = stableFingerprint(req.file.buffer);
    const source = await TrainingSource.findOneAndUpdate(
        { type: 'file', fingerprint },
        { $set: { name: validated.filename, status: 'learning', errorCode: null, errorMessage: null }, $setOnInsert: tenantDocument({ type: 'file', fingerprint }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const run = await createRun(source);
    runDetached(req, async () => {
        await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'training.status': 'learning' } });
        await TrainingRun.findByIdAndUpdate(run._id, { $set: { status: 'learning', stage: 'Reading your file...', progress: 25, startedAt: new Date() } });
        try { await stageCandidates(req.auth!.businessId, source._id.toString(), run._id.toString(), extracted); }
        catch (error) {
            console.error('File ingestion staging failed:', error instanceof Error ? error.message : String(error));
            const merchantMessage = "We couldn't finish learning from this file. Please try again.";
            await Promise.all([TrainingRun.findByIdAndUpdate(run._id, { $set: { status: 'error', stage: 'File needs attention', progress: 0, errorCode: 'FILE_IMPORT_FAILED', errorMessage: merchantMessage, completedAt: new Date() } }), TrainingSource.findByIdAndUpdate(source._id, { $set: { status: 'error', errorCode: 'FILE_IMPORT_FAILED', errorMessage: merchantMessage } })]);
            await markSourceFailure(req.auth!.businessId, source._id.toString());
        }
    });
    res.status(202).json({ source, run, summary: { products: extracted.products?.length || 0, knowledge: extracted.knowledge?.length || 0, warnings: extracted.warnings || [] } });
});

router.post('/sources/facebook', async (req: AuthenticatedRequest, res) => {
    const connectionId = String(req.body?.connectionId || '').trim();
    if (!connectionId) return res.status(400).json({ error: 'Choose an authorized Facebook Page' });
    const channel = await BusinessChannel.findOne({ _id: connectionId, businessId: req.auth!.businessId, platform: 'facebook', status: 'active', connectionStatus: 'CONNECTED' }).lean();
    if (!channel) return res.status(409).json({ error: 'Facebook import requires an authorized Page connection' });
    const pageId = channel.externalId;
    const fingerprint = stableFingerprint(`facebook:${pageId}`);
    const source = await TrainingSource.findOneAndUpdate(
        { type: 'facebook', fingerprint },
        { $set: { name: channel.name, externalId: pageId, status: 'learning', errorCode: null, errorMessage: null }, $setOnInsert: tenantDocument({ type: 'facebook', fingerprint }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const run = await createRun(source);
    runDetached(req, async () => {
        await Business.findByIdAndUpdate(req.auth!.businessId, { $set: { 'training.status': 'learning' } });
        await TrainingRun.findByIdAndUpdate(run._id, { $set: { status: 'learning', stage: 'Reading your Facebook Page...', progress: 30, startedAt: new Date() } });
        try {
            await stageCandidates(req.auth!.businessId, source._id.toString(), run._id.toString(), await importAuthorizedFacebookPage(pageId));
            try {
                const sync = await syncAuthorizedFacebookAwareness(req.auth!.businessId, pageId, source.syncCheckpoint?.lastProcessedPostAt);
                await TrainingSource.findByIdAndUpdate(source._id, { $set: { syncCheckpoint: sync.checkpoint } });
            } catch (awarenessError: any) {
                const permissionDenied = awarenessError?.response?.status === 403 || awarenessError?.response?.data?.error?.code === 100 || awarenessError?.message === 'META_PERMISSION_REQUIRED';
                await TrainingSource.findByIdAndUpdate(source._id, { $set: { status: 'needs_attention', errorCode: permissionDenied ? 'META_POSTS_PERMISSION_REQUIRED' : 'FACEBOOK_AWARENESS_SYNC_FAILED', errorMessage: permissionDenied ? 'Meta Page posts permission is required for automatic awareness.' : 'Facebook business information imported, but recent post awareness could not sync.' } });
            }
        }
        catch (error) {
            const permission = error instanceof FacebookPermissionError;
            const message = error instanceof Error ? error.message : 'Facebook import is unavailable';
            await Promise.all([TrainingRun.findByIdAndUpdate(run._id, { $set: { status: permission ? 'partial' : 'error', stage: 'Facebook needs attention', progress: 100, errorCode: permission ? 'META_PERMISSION_REQUIRED' : 'FACEBOOK_IMPORT_FAILED', errorMessage: message, completedAt: new Date() } }), TrainingSource.findByIdAndUpdate(source._id, { $set: { status: 'needs_attention', errorCode: permission ? 'META_PERMISSION_REQUIRED' : 'FACEBOOK_IMPORT_FAILED', errorMessage: message } })]);
            await markSourceFailure(req.auth!.businessId, source._id.toString());
        }
    });
    res.status(202).json({ source, run });
});

router.post('/sources/manual', async (req: AuthenticatedRequest, res) => {
    const kind = req.body?.kind === 'faq' ? 'faq' : 'information';
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (title.length < 3 || title.length > 200 || content.length < 3 || content.length > 8_000) return res.status(400).json({ error: 'Enter a title/question and an answer of reasonable length' });
    const fingerprint = stableFingerprint('manual:merchant');
    const source = await TrainingSource.findOneAndUpdate(
        { type: 'manual', fingerprint },
        { $set: { name: 'Merchant-provided information', status: 'learning', errorCode: null, errorMessage: null }, $setOnInsert: tenantDocument({ type: 'manual', fingerprint }) },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const run = await createRun(source);
    const stats = await stageCandidates(req.auth!.businessId, source._id.toString(), run._id.toString(), {
        knowledge: [{ title, content, type: kind === 'faq' ? 'FAQ' : 'GUIDE', sourceUrl: 'merchant://manual', topic: kind === 'faq' ? 'FAQ' : 'BUSINESS_INFO', confidence: 1 }],
    });
    res.status(201).json({ source, run, stats });
});

router.get('/awareness', async (req, res) => {
    const query: Record<string, any> = {};
    if (req.query.status) query.status = req.query.status;
    res.json(await BusinessAwareness.find(query).sort({ publishedAt: -1, createdAt: -1 }).limit(100).lean());
});

router.post('/awareness', async (req: AuthenticatedRequest, res) => {
    const input = req.body || {};
    if (!input.title || !input.summary || !input.type || !input.targetType) return res.status(400).json({ error: 'Awareness title, summary, type, and target are required' });
    const awareness = await upsertBusinessAwareness(req.auth!.businessId, { ...input, sourceType: 'merchant', sourceId: input.sourceId || `merchant:${crypto.randomUUID()}`, startsAt: input.startsAt ? new Date(input.startsAt) : undefined, endsAt: input.endsAt ? new Date(input.endsAt) : undefined });
    res.status(201).json(awareness);
});

router.post('/awareness/:id/activate', async (req: AuthenticatedRequest, res) => {
    const awareness = await BusinessAwareness.findById(req.params.id);
    if (!awareness) return res.status(404).json({ error: 'Awareness item not found' });
    if (awareness.endsAt && awareness.endsAt <= new Date()) return res.status(409).json({ error: 'Expired awareness cannot be activated' });
    if (awareness.validation === 'MISMATCH' && req.body?.confirmCatalogMismatch !== true) return res.status(409).json({ error: awareness.validationNote || 'Catalog mismatch requires explicit merchant confirmation' });
    awareness.status = 'ACTIVE';
    if (req.body?.confirmCatalogMismatch === true) { awareness.validation = 'VERIFIED'; awareness.validationNote = 'Explicitly confirmed by merchant after catalog mismatch review'; }
    await awareness.save(); res.json(awareness);
});

router.get('/candidates', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const query = candidateFilter(req.query as Record<string, any>);
    const [data, total, availability, categories] = await Promise.all([
        TrainingCandidate.find(query).sort({ status: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        TrainingCandidate.countDocuments(query),
        TrainingCandidate.aggregate([{ $match: { kind: 'product' } }, { $group: { _id: '$payload.availability', count: { $sum: 1 } } }]),
        TrainingCandidate.distinct('payload.category', { kind: 'product' }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, availabilityCounts: Object.fromEntries(availability.map((item: any) => [item._id || 'unknown', item.count])), categories: categories.filter(Boolean).sort() });
});

router.patch('/candidates/:id', async (req, res) => {
    const candidate = await TrainingCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    const payload = { ...candidate.payload, ...(req.body?.payload || {}) };
    candidate.payload = payload; candidate.title = String(req.body?.title || candidate.title).slice(0, 240);
    candidate.status = 'ready'; candidate.conflictFields = []; candidate.reviewNote = 'Edited by merchant';
    await candidate.save(); res.json(candidate);
});

router.post('/candidates/:id/reject', async (req, res) => {
    const candidate = await TrainingCandidate.findByIdAndUpdate(req.params.id, { $set: { status: 'rejected', reviewNote: String(req.body?.note || 'Rejected by merchant') } }, { new: true });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' }); res.json(candidate);
});
router.post('/candidates/:id/keep-separate', async (req, res) => {
    const candidate = await TrainingCandidate.findByIdAndUpdate(req.params.id, { $set: { status: 'ready', reviewNote: 'Merchant chose to keep this item separate' }, $unset: { matchedRecordId: 1, duplicateKind: 1 } }, { new: true });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' }); res.json(candidate);
});
router.post('/candidates/:id/merge', async (req, res) => {
    const candidate = await TrainingCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    if (!candidate.matchedRecordId) return res.status(409).json({ error: 'No existing item is available to merge' });
    candidate.status = 'ready'; candidate.duplicateKind = 'exact'; candidate.reviewNote = 'Merchant confirmed this duplicate';
    await candidate.save(); res.json(candidate);
});
router.post('/candidates/:id/resolve', async (req, res) => {
    const candidate = await TrainingCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    const decisions = req.body?.decisions || {};
    const payload = { ...candidate.payload }; const resolvedFields: string[] = [];
    for (const conflict of candidate.conflictFields) {
        const decision = decisions[conflict.field];
        if (!decision || !['current', 'imported', 'custom'].includes(decision.choice)) return res.status(400).json({ error: `Resolve ${conflict.field}` });
        if (decision.choice === 'current') payload[conflict.field] = conflict.currentValue;
        if (decision.choice === 'imported') payload[conflict.field] = conflict.importedValue;
        if (decision.choice === 'custom') payload[conflict.field] = decision.value;
        if (decision.choice !== 'current') resolvedFields.push(conflict.field);
    }
    payload.resolvedFields = resolvedFields; candidate.payload = payload; candidate.conflictFields = []; candidate.status = 'ready'; candidate.reviewNote = 'Conflict resolved by merchant';
    await candidate.save(); res.json(candidate);
});
router.post('/candidates/:id/approve', async (req: AuthenticatedRequest, res) => {
    try { res.json(await approveCandidate(req.auth!.businessId, String(req.params.id), req.auth!.userId)); }
    catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Could not approve item' }); }
});
router.post('/approve-safe', async (req: AuthenticatedRequest, res) => {
    const body = req.body || {};
    const selectedIds = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))].slice(0, APPROVAL_BATCH_SIZE) : [];
    const filter = candidateFilter({ ...(body.filter || {}), kind: body.filter?.kind || 'product' }, { approvable: true });
    if (body.retryFailed) filter.status = 'failed';
    if (selectedIds.length) filter._id = { $in: selectedIds };
    const candidates = await TrainingCandidate.find(filter).sort({ createdAt: 1 }).limit(APPROVAL_BATCH_SIZE).select('_id').lean();
    let approved = 0; const errors: Array<{ id: string; error: string }> = [];
    for (const candidate of candidates) {
        try { await approveCandidate(req.auth!.businessId, candidate._id.toString(), req.auth!.userId); approved += 1; }
        catch (error) { errors.push({ id: candidate._id.toString(), error: error instanceof Error ? error.message : 'Approval failed' }); }
    }
    const remaining = selectedIds.length
        ? Math.max(0, selectedIds.length - candidates.length)
        : await TrainingCandidate.countDocuments(filter);
    res.json({ processed: candidates.length, approved, failed: errors.length, errors, remaining, batchSize: APPROVAL_BATCH_SIZE });
});

router.post('/candidates/clear', async (req: AuthenticatedRequest, res) => {
    if (req.body?.confirm !== 'CLEAR_STAGED_CANDIDATES') return res.status(400).json({ error: 'Confirmation is required' });
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String))].slice(0, 5_000) : [];
    const query = candidateFilter(req.body?.filter || {});
    query.status = { $nin: ['imported', 'approved', 'approving'] };
    if (ids.length) query._id = { $in: ids };
    const result = await TrainingCandidate.deleteMany(query);
    res.json({ cleared: result.deletedCount });
});

router.use((error: any, _req: any, res: any, _next: any) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? `File is too large. The maximum size is ${Math.floor(maxTrainingFileBytes / 1_000_000)} MB.` : 'The file upload could not be processed' });
    if (error instanceof FileIngestionError) return res.status(400).json({ error: error.message });
    const status = error?.name === 'UnsafeUrlError' ? 400 : 500;
    if (status === 500) console.error('Business ingestion request failed:', error instanceof Error ? error.message : String(error));
    res.status(status).json({ error: status === 400 ? error.message : 'Business ingestion failed safely', ...(status === 400 ? { code: error.code || 'INVALID_INPUT' } : {}) });
});

export default router;
