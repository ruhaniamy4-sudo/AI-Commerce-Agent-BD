import {Router,urlencoded} from 'express';
import mongoose from 'mongoose';
import {requireAdministrator} from '../auth/middleware';
import {IntelligenceIntegration} from '../models/IntelligenceIntegration';
import {withTenantContext} from '../tenancy/context';
import {verifyCustomerPayment} from '../intelligence/payments';
import {authRateLimit} from '../auth/rate-limit';
import {validStripeSignature} from '../intelligence/stripe-signature';
import {decryptMetaAccessToken} from '../services/meta-credentials.service';
const router=Router();
router.post('/intelligence/payments/:provider/verify',requireAdministrator,authRateLimit({limit:20,windowMs:60000}),async(req,res)=>{
 try{res.json(await verifyCustomerPayment(String(req.params.provider),String(req.body?.reference||'')));}catch{res.status(422).json({error:'Provider verification failed; no unverified payment was applied'});}
});
export const paymentPublicRouter=Router();
paymentPublicRouter.use(urlencoded({extended:false,limit:'32kb'}),authRateLimit({limit:30,windowMs:60000}));
paymentPublicRouter.post('/stripe/:integrationId',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.integrationId))return res.sendStatus(404);
 const integration=await IntelligenceIntegration.findOne({_id:req.params.integrationId,provider:'stripe',enabled:true}).select('+credentials');if(!integration)return res.sendStatus(404);
 const credentials=JSON.parse(decryptMetaAccessToken(integration.credentials));
 if(!validStripeSignature((req as any).rawBody,req.headers['stripe-signature'],credentials.webhookSecret))return res.sendStatus(403);
 const object=req.body?.data?.object;const reference=req.body?.type?.startsWith('payment_intent.')?object?.id:req.body?.type==='charge.refunded'?object?.payment_intent:null;if(!reference)return res.status(200).json({ignored:true});
 try{return await withTenantContext({businessId:String(integration.businessId),userId:'stripe',membershipId:'stripe',role:'Staff'},async()=>{await verifyCustomerPayment('stripe',String(reference));return res.status(200).json({accepted:true});});}catch{return res.sendStatus(422);}
});
paymentPublicRouter.post('/sslcommerz/:integrationId',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.integrationId))return res.sendStatus(404);
 const integration=await IntelligenceIntegration.findOne({_id:req.params.integrationId,provider:'sslcommerz',enabled:true});if(!integration)return res.sendStatus(404);
 // IPN contents are not trusted: always re-query the provider using merchant credentials.
 try{return await withTenantContext({businessId:String(integration.businessId),userId:'payment-provider',membershipId:'payment-provider',role:'Staff'},async()=>{await verifyCustomerPayment('sslcommerz',String(req.body?.val_id||''));return res.status(200).json({accepted:true});});}catch{return res.sendStatus(422);}
});
export default router;
