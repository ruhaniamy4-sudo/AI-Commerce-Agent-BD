import {Router} from 'express';
import axios from 'axios';
import {BusinessChannel} from '../models/BusinessChannel';
import {requireTenantContext} from '../tenancy/context';
import {requireAdministrator} from '../auth/middleware';
import {encryptMetaAccessToken} from '../services/meta-credentials.service';
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
router.get('/integrations/whatsapp',requireAdministrator,async(_req,res)=>{res.json({channels:await BusinessChannel.find({businessId:requireTenantContext().businessId,platform:'whatsapp'}).select('externalId name status connectionStatus lastEventAt').lean()});});
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
export default router;
