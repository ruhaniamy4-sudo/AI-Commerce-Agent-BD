import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { AuthenticatedRequest, requireAdministrator } from '../auth/middleware';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { TrainingCandidate } from '../models/TrainingCandidate';
import { TrainingRun } from '../models/TrainingRun';
import { TrainingSource } from '../models/TrainingSource';
import { tenantDocument, withTenantContext } from '../tenancy/context';
import { approveCandidate, runWebsiteIngestion, stageCandidates } from '../services/ingestion/business-ingestion.service';
import { DEFAULT_MAX_TRAINING_FILE_BYTES, extractFile, FileIngestionError, validateTrainingFile } from '../services/ingestion/file-ingestion.service';
import { FacebookPermissionError, importAuthorizedFacebookPage } from '../services/ingestion/facebook-ingestion.service';
import { canonicalUrl, stableFingerprint } from '../services/ingestion/normalization';
import { validatePublicUrl } from '../services/ingestion/url-security';

const router = Router();
router.use(requireAdministrator);
const maxTrainingFileBytes = DEFAULT_MAX_TRAINING_FILE_BYTES;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxTrainingFileBytes, files: 1 } });

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
    const [business, sources, latestRun, groups, productSamples, knowledgeSamples] = await Promise.all([
        Business.findById(req.auth!.businessId).lean(), TrainingSource.find().sort({ updatedAt: -1 }).lean(),
        TrainingRun.findOne().sort({ createdAt: -1 }).lean(),
        TrainingCandidate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Product.find({ isActive: true }).limit(3).select('name variants').lean(), Knowledge.find({ status: 'active' }).limit(5).select('title type').lean(),
    ]);
    const candidateCounts = Object.fromEntries(groups.map((group: any) => [group._id, group.count]));
    const suggestedQuestions = [
        ...productSamples.map((product: any) => `${product.name} stock e ache?`),
        ...knowledgeSamples.map((entry: any) => entry.type === 'POLICY' ? `${entry.title} ki?` : entry.title),
    ].slice(0, 4);
    const missing: string[] = [];
    if (!business?.phone) missing.push('What number should customers contact for support?');
    if (!knowledgeSamples.some((entry: any) => /delivery/i.test(entry.title))) missing.push('Inside and outside Dhaka delivery charge?');
    if (!knowledgeSamples.some((entry: any) => /return|exchange/i.test(entry.title))) missing.push('How many days can customers request a return or exchange?');
    res.json({ training: business?.training || { status: 'not_started' }, sources, latestRun, candidateCounts, suggestedQuestions, missing });
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
    const pageId = String(req.body?.pageId || '').trim();
    if (!pageId) return res.status(400).json({ error: 'Choose an authorized Facebook Page' });
    const channel = await BusinessChannel.findOne({ businessId: req.auth!.businessId, platform: 'facebook', externalId: pageId, status: 'active' }).lean();
    if (!channel) return res.status(409).json({ error: 'Facebook import requires an authorized Page connection' });
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
        try { await stageCandidates(req.auth!.businessId, source._id.toString(), run._id.toString(), await importAuthorizedFacebookPage(pageId)); }
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

router.get('/candidates', async (req, res) => {
    const query: Record<string, unknown> = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.kind) query.kind = req.query.kind;
    res.json(await TrainingCandidate.find(query).sort({ status: 1, createdAt: -1 }).limit(500).lean());
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
    const candidates = await TrainingCandidate.find({ status: 'ready' }).sort({ createdAt: 1 });
    let approved = 0; const errors: Array<{ id: string; error: string }> = [];
    for (const candidate of candidates) {
        try { await approveCandidate(req.auth!.businessId, candidate._id.toString(), req.auth!.userId); approved += 1; }
        catch (error) { errors.push({ id: candidate._id.toString(), error: error instanceof Error ? error.message : 'Approval failed' }); }
    }
    res.json({ approved, errors });
});

router.use((error: any, _req: any, res: any, _next: any) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? `File is too large. The maximum size is ${Math.floor(maxTrainingFileBytes / 1_000_000)} MB.` : 'The file upload could not be processed' });
    if (error instanceof FileIngestionError) return res.status(400).json({ error: error.message });
    const status = error?.name === 'UnsafeUrlError' ? 400 : 500;
    if (status === 500) console.error('Business ingestion request failed:', error instanceof Error ? error.message : String(error));
    res.status(status).json({ error: status === 400 ? error.message : 'Business ingestion failed safely' });
});

export default router;
