import {Router} from 'express';
import {requireAdministrator} from '../auth/middleware';
import {requireTenantContext} from '../tenancy/context';
import {IntelligenceIntegration} from '../models/IntelligenceIntegration';
import {encryptMetaAccessToken} from '../services/meta-credentials.service';
const router=Router();
export const integrationCapabilities={pathao:{supported:true,fields:['webhookSecret']},redx:{supported:true,fields:['accessToken']},sslcommerz:{supported:true,fields:['storeId','storePassword']},stripe:{supported:true,fields:['secretKey','webhookSecret']},bkash:{supported:false,fields:[],via:'sslcommerz'},nagad:{supported:false,fields:[],via:'sslcommerz'}};
router.post('/intelligence/courier/redx/sync',requireAdministrator,async(req,res)=>{try{res.json(await (await import('../intelligence/redx')).syncRedx(String(req.body?.orderId||''),String(req.body?.reference||'')));}catch{res.status(422).json({error:'RedX verification failed; confirm the tracking reference and merchant order match'});}});
router.get('/intelligence/integrations',requireAdministrator,async(_req,res)=>{
 const rows=await IntelligenceIntegration.find({businessId:requireTenantContext().businessId}).select('provider enabled').lean();
 res.json({data:Object.entries(integrationCapabilities).map(([provider,capability])=>({provider,...capability,integrationId:String(rows.find(r=>r.provider===provider)?._id||''),configured:rows.some(r=>r.provider===provider&&r.enabled)}))});
});
router.put('/intelligence/integrations/:provider',requireAdministrator,async(req,res)=>{
 const provider=req.params.provider as keyof typeof integrationCapabilities;const capability=integrationCapabilities[provider];
 if(!capability?.supported)return res.status(409).json({error:'Provider contract and credentials must be verified before enabling this adapter'});
 const credentials:Record<string,string>={};for(const key of capability.fields){const value=req.body?.[key];if(typeof value!=='string'||value.length<8||value.length>4000)return res.status(400).json({error:`Valid ${key} required`});credentials[key]=value;}
 credentials.environment=req.body?.environment==='live'?'live':'sandbox';
 const row=await IntelligenceIntegration.findOneAndUpdate({businessId:requireTenantContext().businessId,provider},{$set:{credentials:encryptMetaAccessToken(JSON.stringify(credentials)),enabled:true}},{upsert:true,new:true,runValidators:true});
 res.json({integrationId:String(row!._id),configured:true});
});
router.delete('/intelligence/integrations/:provider',requireAdministrator,async(req,res)=>{await IntelligenceIntegration.deleteOne({businessId:requireTenantContext().businessId,provider:req.params.provider});res.json({disconnected:true});});
export default router;
