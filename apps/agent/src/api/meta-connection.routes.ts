import crypto from 'node:crypto';
import { Router } from 'express';
import { AuthenticatedRequest, requireAdministrator } from '../auth/middleware';
import { beginMetaConnection, completeMetaOAuthCallback, connectSelectedMetaPage, disconnectMetaConnection, getMetaOAuthSession, listMetaConnections, setMetaConnectionAI, verifyMetaConnection } from '../services/meta-connection.service';
import { getMetaConfig } from '../services/meta-config.service';
import { redactMetaSecrets } from '../services/meta-credentials.service';
import { MetaGraphError } from '../services/meta-graph.service';
import { MetaDataDeletionRequest } from '../models/MetaDataDeletionRequest';

const router = Router();

function statusFor(error: unknown) {
    if (error instanceof MetaGraphError) return error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 502;
    return /not found|unavailable/i.test(error instanceof Error ? error.message : '') ? 404 : 400;
}
function sendError(res: any, error: unknown) {
    const message = error instanceof MetaGraphError ? 'Meta rejected the Facebook operation' : error instanceof Error ? error.message : 'Facebook operation failed';
    return res.status(statusFor(error)).json({ error: message, code: error instanceof MetaGraphError ? error.category : 'facebook_operation_failed' });
}

function safeMetaOAuthLogValue(value: unknown, maxLength: number): string {
    return redactMetaSecrets(value)
        .replace(/((?:client_|app_)?secret|authorization_code|code|state)(["'\s:=]+)([^\s,"'}&]+)/gi, '$1$2[REDACTED]')
        .slice(0, maxLength);
}

router.get('/facebook/connections', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await listMetaConnections(req.auth!.businessId)); } catch (error) { sendError(res, error); }
});
router.post('/facebook/connect/start', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await beginMetaConnection(req.auth!.businessId, req.auth!.userId, req.body?.includeContent === true)); } catch (error) { sendError(res, error); }
});
router.get('/facebook/connect/session/:id', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await getMetaOAuthSession(req.auth!.businessId, req.auth!.userId, String(req.params.id))); } catch (error) { sendError(res, error); }
});
router.post('/facebook/connect/confirm', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await connectSelectedMetaPage(req.auth!.businessId, req.auth!.userId, String(req.body?.sessionId || ''), String(req.body?.choiceId || ''), req.body?.termsAccepted === true)); } catch (error) { sendError(res, error); }
});
router.post('/facebook/connections/:id/verify', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await verifyMetaConnection(req.auth!.businessId, String(req.params.id))); } catch (error) { sendError(res, error); }
});
router.patch('/facebook/connections/:id/ai', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await setMetaConnectionAI(req.auth!.businessId, String(req.params.id), req.body?.enabled === true)); } catch (error) { sendError(res, error); }
});
router.delete('/facebook/connections/:id', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try { res.json(await disconnectMetaConnection(req.auth!.businessId, String(req.params.id))); } catch (error) { sendError(res, error); }
});

export const metaPublicRouter = Router();
metaPublicRouter.get('/oauth/callback', async (req, res) => {
    const { dashboardUrl } = getMetaConfig();
    let failureStage = 'provider_authorization';
    let providerCategory: string | undefined;
    try {
        if (req.query.error) {
            providerCategory = safeMetaOAuthLogValue(req.query.error, 100);
            const providerMessage = req.query.error_description || req.query.error_reason || req.query.error;
            throw new Error(`Facebook authorization failed: ${safeMetaOAuthLogValue(providerMessage, 500)}`);
        }
        failureStage = 'callback_completion';
        const result = await completeMetaOAuthCallback(String(req.query.code || ''), String(req.query.state || ''));
        return res.redirect(303, `${dashboardUrl}/settings/integrations?facebookSession=${encodeURIComponent(result.sessionId)}`);
    } catch (error) {
        const metaError = error instanceof MetaGraphError ? error : undefined;
        console.error('[Meta OAuth] callback failed', {
            stage: failureStage,
            message: safeMetaOAuthLogValue(error, 1000),
            ...(metaError || providerCategory ? { category: metaError?.category || providerCategory } : {}),
            ...(metaError ? { status: metaError.statusCode } : {}),
        });
        return res.redirect(303, `${dashboardUrl}/settings/integrations?facebookError=authorization_failed`);
    }
});
metaPublicRouter.post('/data-deletion', async (req, res) => {
    const signedRequest = String(req.body?.signed_request || '');
    const [encodedSignature, payloadValue] = signedRequest.split('.');
    const { appSecret, publicAgentUrl } = getMetaConfig();
    if (!encodedSignature || !payloadValue || !appSecret) return res.sendStatus(403);
    const expected = crypto.createHmac('sha256', appSecret).update(payloadValue).digest();
    const supplied = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return res.sendStatus(403);
    let userId = '';
    try { userId = String(JSON.parse(Buffer.from(payloadValue, 'base64url').toString('utf8')).user_id || ''); } catch { return res.sendStatus(400); }
    if (!userId) return res.sendStatus(400);
    const confirmationCode = crypto.randomBytes(18).toString('base64url');
    await MetaDataDeletionRequest.create({
        providerUserHash: crypto.createHash('sha256').update(userId).digest('hex'),
        confirmationHash: crypto.createHash('sha256').update(confirmationCode).digest('hex'),
        status: 'NEEDS_OPERATOR_REVIEW',
    });
    res.json({ url: `${publicAgentUrl}/facebook/data-deletion/status/${confirmationCode}`, confirmation_code: confirmationCode });
});
metaPublicRouter.get('/data-deletion/status/:code', async (req, res) => {
    const confirmationHash = crypto.createHash('sha256').update(String(req.params.code)).digest('hex');
    const request = await MetaDataDeletionRequest.findOne({ confirmationHash }).select('status completedAt').lean();
    if (!request) return res.sendStatus(404);
    return res.json({ status: request.status.toLowerCase(), completedAt: request.completedAt });
});

export default router;
