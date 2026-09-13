import {Router} from 'express';
import axios from 'axios';
import {BusinessChannel} from '../models/BusinessChannel';
import {requireTenantContext} from '../tenancy/context';
import {requireAdministrator} from '../auth/middleware';
import {decryptMetaAccessToken,encryptMetaAccessToken} from '../services/meta-credentials.service';
import {webhookQueue} from '../services/queue.service';
import {validMetaSignature,whatsappMessages} from '../intelligence/whatsapp-payload';
export const whatsappPublicRouter=Router();
whatsappPublicRouter.get('/',(req,res)=>{if(req.query['hub.mode']==='subscribe'&&process.env.WHATSAPP_VERIFY_TOKEN&&req.query['hub.verify_token']===process.env.WHATSAPP_VERIFY_TOKEN)return res.send(req.query['hub.challenge']);res.sendStatus(403);});
whatsappPublicRouter.post('/',async(req,res)=>{
 if(!validMetaSignature((req as any).rawBody,req.headers['x-hub-signature-256'],process.env.WHATSAPP_APP_SECRET))return res.sendStatus(403);
 for(const message of whatsappMessages(req.body)){
  const channel=await BusinessChannel.findOne({platform:'whatsapp',externalId:message.phoneNumberId,status:'active',connectionStatus:'CONNECTED'});
  if(!channel)continue;
  await webhookQueue.add('process-whatsapp-event',{...message,businessId:String(channel.businessId)},{attempts:4,backoff:{type:'exponential',delay:5000},removeOnComplete:1000});
 }res.sendStatus(200);
});
const router=Router();
/** Everything the Integrations page needs to show a WhatsApp connection honestly. */
router.get('/integrations/whatsapp', requireAdministrator, async (_req, res) => {
    const channels = await BusinessChannel.find({ businessId: requireTenantContext().businessId, platform: 'whatsapp' })
        .select('externalId name status connectionStatus lastEventAt lastInboundAt lastOutboundAt lastVerifiedAt lastErrorCode reauthorizationRequired')
        .sort({ updatedAt: -1 })
        .lean();
    res.json({
        channels: channels.map((channel: any) => ({
            id: String(channel._id),
            phoneNumberId: channel.externalId,
            name: channel.name,
            connectionStatus: channel.connectionStatus,
            aiEnabled: channel.status === 'active',
            lastEventAt: channel.lastEventAt,
            lastInboundAt: channel.lastInboundAt,
            lastOutboundAt: channel.lastOutboundAt,
            lastVerifiedAt: channel.lastVerifiedAt,
            lastErrorCode: channel.lastErrorCode,
            reauthorizationRequired: Boolean(channel.reauthorizationRequired),
        })),
    });
});
router.post('/integrations/whatsapp',requireAdministrator,async(req,res)=>{
 const {phoneNumberId,accessToken}=req.body||{};const version=process.env.META_GRAPH_API_VERSION;
 if(!/^\d{5,30}$/.test(phoneNumberId||'')||typeof accessToken!=='string'||!version||!/^v\d+\.\d+$/.test(version))return res.status(400).json({error:'Phone number ID, access token and configured Graph version required'});
 const {businessId}=requireTenantContext();const existing=await BusinessChannel.findOne({platform:'whatsapp',externalId:phoneNumberId});
 if(existing&&String(existing.businessId)!==businessId)return res.status(409).json({error:'Channel already connected'});
 const verified=await axios.get(`https://graph.facebook.com/${version}/${phoneNumberId}`,{timeout:15000,headers:{Authorization:`Bearer ${accessToken}`},params:{fields:'id,display_phone_number,verified_name'}});
 if(String(verified.data.id)!==phoneNumberId)return res.status(400).json({error:'Channel verification failed'});
 await BusinessChannel.findOneAndUpdate({platform:'whatsapp',externalId:phoneNumberId,businessId},{$set:{businessId,name:verified.data.verified_name||'WhatsApp',encryptedAccessToken:encryptMetaAccessToken(accessToken),status:'active',connectionStatus:'CONNECTED',lastVerifiedAt:new Date()}},{upsert:true,runValidators:true});
 res.json({connected:true});
});
/** Re-checks the stored token with Meta, so the merchant sees the truth, not a stale badge. */
router.post('/integrations/whatsapp/:id/verify', requireAdministrator, async (req, res) => {
    const { businessId } = requireTenantContext();
    const channel = await BusinessChannel.findOne({ _id: req.params.id, businessId, platform: 'whatsapp' }).select('+encryptedAccessToken');
    if (!channel?.encryptedAccessToken) return res.status(404).json({ error: 'WhatsApp connection not found' });
    const version = process.env.META_GRAPH_API_VERSION;
    if (!version || !/^v\d+\.\d+$/.test(version)) return res.status(500).json({ error: 'Graph API version is not configured' });
    try {
        const verified = await axios.get(`https://graph.facebook.com/${version}/${channel.externalId}`, {
            timeout: 15000,
            headers: { Authorization: `Bearer ${decryptMetaAccessToken(channel.encryptedAccessToken)}` },
            params: { fields: 'id,display_phone_number,verified_name' },
        });
        channel.name = verified.data.verified_name || channel.name;
        channel.connectionStatus = 'CONNECTED';
        channel.reauthorizationRequired = false;
        channel.lastVerifiedAt = new Date();
        channel.lastErrorCode = undefined;
        await channel.save();
        res.json({ verified: true, name: channel.name, displayPhoneNumber: verified.data.display_phone_number });
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
    const channel = await BusinessChannel.findOneAndUpdate(
        { _id: req.params.id, businessId, platform: 'whatsapp' },
        { $set: { connectionStatus: 'DISCONNECTED', status: 'disabled' }, $unset: { encryptedAccessToken: '' } },
        { new: true },
    );
    if (!channel) return res.status(404).json({ error: 'WhatsApp connection not found' });
    res.json({ disconnected: true });
});

export default router;
