import {Router} from 'express';
import axios from 'axios';
import {BusinessChannel} from '../models/BusinessChannel';
import {requireTenantContext} from '../tenancy/context';
import {AuthenticatedRequest,requireAdministrator} from '../auth/middleware';
import {decryptMetaAccessToken,encryptMetaAccessToken} from '../services/meta-credentials.service';
import {getWhatsAppConfig} from '../services/meta-config.service';
import {MetaGraphError} from '../services/meta-graph.service';
import {completeWhatsAppEmbeddedSignup,confirmWhatsAppSignupNumber,confirmWhatsAppSubscription,publicWhatsAppConnection,releaseWhatsAppAccount,resubscribeWhatsAppConnection,whatsappSetupOptions} from '../services/whatsapp-connection.service';
import {webhookQueue} from '../services/queue.service';
import {validMetaSignature,whatsappMessages} from '../intelligence/whatsapp-payload';
export const whatsappPublicRouter=Router();
whatsappPublicRouter.get('/',(req,res)=>{const {verifyToken}=getWhatsAppConfig();if(req.query['hub.mode']==='subscribe'&&verifyToken&&req.query['hub.verify_token']===verifyToken)return res.send(req.query['hub.challenge']);res.sendStatus(403);});
whatsappPublicRouter.post('/',async(req,res)=>{
 if(!validMetaSignature((req as any).rawBody,req.headers['x-hub-signature-256'],getWhatsAppConfig().appSecret))return res.sendStatus(403);
 for(const message of whatsappMessages(req.body)){
  const channel=await BusinessChannel.findOne({platform:'whatsapp',externalId:message.phoneNumberId,status:'active',connectionStatus:'CONNECTED'});
  if(!channel)continue;
  await webhookQueue.add('process-whatsapp-event',{...message,businessId:String(channel.businessId)},{attempts:4,backoff:{type:'exponential',delay:5000},removeOnComplete:1000});
 }res.sendStatus(200);
});
const router=Router();

function sendSignupError(res: any, error: unknown) {
    const message = error instanceof MetaGraphError
        ? `Meta rejected the WhatsApp setup: ${error.message}`
        : error instanceof Error ? error.message : 'WhatsApp setup failed';
    const status = error instanceof MetaGraphError && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : /already connected to another business/i.test(message) ? 409
        : /unavailable|not found/i.test(message) ? 404 : 400;
    res.status(status).json({ error: message, code: error instanceof MetaGraphError ? error.category : 'whatsapp_setup_failed' });
}

/** Everything the Integrations page needs to show a WhatsApp connection honestly. */
router.get('/integrations/whatsapp', requireAdministrator, async (_req, res) => {
    const channels = await BusinessChannel.find({ businessId: requireTenantContext().businessId, platform: 'whatsapp' })
        .select('externalId wabaId name displayPhoneNumber qualityRating platformType setupMode status connectionStatus subscription connectedAt lastEventAt lastInboundAt lastOutboundAt lastVerifiedAt lastErrorCode reauthorizationRequired')
        .sort({ updatedAt: -1 })
        .lean();
    res.json({ channels: channels.map(publicWhatsAppConnection) });
});

/**
 * Guided setup is only offered when this deployment can actually complete it, so
 * the merchant never meets a Connect button that leads nowhere.
 */
router.get('/integrations/whatsapp/setup', requireAdministrator, async (_req, res) => {
    res.json(whatsappSetupOptions());
});

/**
 * The merchant authorizes inside Meta's own dialog and the browser returns a
 * one-time code. Everything after that — token, account, webhooks, number
 * registration — happens here, so nothing is ever copied by hand.
 */
router.post('/integrations/whatsapp/connect', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try {
        res.json(await completeWhatsAppEmbeddedSignup(req.auth!.businessId, req.auth!.userId, {
            code: String(req.body?.code || ''),
            wabaId: req.body?.wabaId ? String(req.body.wabaId) : undefined,
            phoneNumberId: req.body?.phoneNumberId ? String(req.body.phoneNumberId) : undefined,
            coexistence: req.body?.coexistence === true,
        }));
    } catch (error) { sendSignupError(res, error); }
});

/** Only reached when the authorized account holds more than one number. */
router.post('/integrations/whatsapp/connect/confirm', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try {
        res.json({ connection: await confirmWhatsAppSignupNumber(req.auth!.businessId, req.auth!.userId, String(req.body?.sessionId || ''), String(req.body?.choiceId || '')) });
    } catch (error) { sendSignupError(res, error); }
});

/** Repairs a lapsed webhook subscription without a new authorization. */
router.post('/integrations/whatsapp/:id/resubscribe', requireAdministrator, async (req: AuthenticatedRequest, res) => {
    try {
        res.json(await resubscribeWhatsAppConnection(req.auth!.businessId, String(req.params.id)));
    } catch (error) { sendSignupError(res, error); }
});
router.post('/integrations/whatsapp',requireAdministrator,async(req,res)=>{
 const {phoneNumberId,accessToken}=req.body||{};const version=getWhatsAppConfig().graphVersion;
 if(!/^\d{5,30}$/.test(phoneNumberId||'')||typeof accessToken!=='string'||!version||!/^v\d+\.\d+$/.test(version))return res.status(400).json({error:'Phone number ID, access token and configured Graph version required'});
 const {businessId}=requireTenantContext();const existing=await BusinessChannel.findOne({platform:'whatsapp',externalId:phoneNumberId});
 if(existing&&String(existing.businessId)!==businessId)return res.status(409).json({error:'Channel already connected'});
 const verified=await axios.get(`https://graph.facebook.com/${version}/${phoneNumberId}`,{timeout:15000,headers:{Authorization:`Bearer ${accessToken}`},params:{fields:'id,display_phone_number,verified_name'}});
 if(String(verified.data.id)!==phoneNumberId)return res.status(400).json({error:'Channel verification failed'});
 await BusinessChannel.findOneAndUpdate({platform:'whatsapp',externalId:phoneNumberId,businessId},{$set:{businessId,name:verified.data.verified_name||'WhatsApp',displayPhoneNumber:verified.data.display_phone_number,setupMode:'manual',encryptedAccessToken:encryptMetaAccessToken(accessToken),status:'active',connectionStatus:'CONNECTED',lastVerifiedAt:new Date()}},{upsert:true,runValidators:true});
 res.json({connected:true});
});
/** Re-checks the stored token with Meta, so the merchant sees the truth, not a stale badge. */
router.post('/integrations/whatsapp/:id/verify', requireAdministrator, async (req, res) => {
    const { businessId } = requireTenantContext();
    const channel = await BusinessChannel.findOne({ _id: req.params.id, businessId, platform: 'whatsapp' }).select('+encryptedAccessToken');
    if (!channel?.encryptedAccessToken) return res.status(404).json({ error: 'WhatsApp connection not found' });
    const version = getWhatsAppConfig().graphVersion;
    if (!version || !/^v\d+\.\d+$/.test(version)) return res.status(500).json({ error: 'Graph API version is not configured' });
    try {
        const verified = await axios.get(`https://graph.facebook.com/${version}/${channel.externalId}`, {
            timeout: 15000,
            headers: { Authorization: `Bearer ${decryptMetaAccessToken(channel.encryptedAccessToken)}` },
            params: { fields: 'id,display_phone_number,verified_name' },
        });
        channel.name = verified.data.verified_name || channel.name;
        channel.displayPhoneNumber = verified.data.display_phone_number || channel.displayPhoneNumber;
        channel.reauthorizationRequired = false;
        channel.lastVerifiedAt = new Date();
        channel.lastErrorCode = undefined;
        // A guided connection owns its account, so the webhook subscription can be
        // confirmed rather than assumed. A pasted token cannot read it at all.
        let subscribed = true;
        if (channel.wabaId) {
            try {
                const subscription = await confirmWhatsAppSubscription(channel, decryptMetaAccessToken(channel.encryptedAccessToken));
                subscribed = Boolean(subscription?.subscribed);
                channel.subscription = subscription;
            } catch { subscribed = false; }
            if (!subscribed) channel.lastErrorCode = 'SUBSCRIPTION_MISSING';
        }
        channel.connectionStatus = subscribed ? 'CONNECTED' : 'NEEDS_ATTENTION';
        await channel.save();
        res.json({ verified: true, subscribed, name: channel.name, displayPhoneNumber: verified.data.display_phone_number });
    } catch (error: any) {
        channel.connectionStatus = 'NEEDS_ATTENTION';
        channel.reauthorizationRequired = true;
        channel.lastErrorCode = String(error?.response?.data?.error?.code || 'verification_failed');
        await channel.save();
        res.status(502).json({ error: 'Meta could not verify this number. The access token may have expired.' });
    }
});

/** Pause or resume automated replies without losing the connection. */
router.patch('/integrations/whatsapp/:id/ai', requireAdministrator, async (req, res) => {
    const { businessId } = requireTenantContext();
    const enabled = req.body?.enabled === true;
    const channel = await BusinessChannel.findOne({ _id: req.params.id, businessId, platform: 'whatsapp' });
    if (!channel) return res.status(404).json({ error: 'WhatsApp connection not found' });
    if (enabled && channel.connectionStatus !== 'CONNECTED') {
        return res.status(409).json({ error: 'Verify this WhatsApp number before enabling AI replies' });
    }
    channel.status = enabled ? 'active' : 'disabled';
    await channel.save();
    res.json({ aiEnabled: channel.status === 'active' });
});

/** Disconnecting removes the stored token; nothing is sent or received afterwards. */
router.delete('/integrations/whatsapp/:id', requireAdministrator, async (req, res) => {
    const { businessId } = requireTenantContext();
    // The pre-update document still carries the token, which is the only way to
    // tell Meta to stop sending webhooks before the token stops existing here.
    const channel = await BusinessChannel.findOneAndUpdate(
        { _id: req.params.id, businessId, platform: 'whatsapp' },
        { $set: { connectionStatus: 'DISCONNECTED', status: 'disabled' }, $unset: { encryptedAccessToken: '', encryptedTwoStepPin: '' } },
        { returnDocument: 'before', projection: '+encryptedAccessToken' },
    );
    if (!channel) return res.status(404).json({ error: 'WhatsApp connection not found' });
    if (channel.wabaId && channel.encryptedAccessToken) {
        try { await releaseWhatsAppAccount(businessId, channel, decryptMetaAccessToken(channel.encryptedAccessToken)); } catch { /* Already unreachable is already disconnected. */ }
    }
    res.json({ disconnected: true });
});

export default router;
