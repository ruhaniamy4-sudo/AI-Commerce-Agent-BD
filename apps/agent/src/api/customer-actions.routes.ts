import {Router} from 'express';
import mongoose from 'mongoose';
import {CustomerAction} from '../models/CustomerAction';
import {CustomerIntelligence} from '../models/CustomerIntelligence';
import {requireTenantContext} from '../tenancy/context';
import {Customer} from '../models/Customer';
import {refreshCustomerIntelligence} from '../intelligence/customer-intelligence';
import {requireAdministrator} from '../auth/middleware';
const router=Router();
router.get('/intelligence/operations',async(_req,res)=>{
 const [actions,profiles]=await Promise.all([CustomerAction.find({status:'open'}).sort({dueAt:1}).limit(100).lean(),CustomerIntelligence.find().sort({calculatedAt:-1}).limit(100).lean()]);
 res.json({actions,profiles});
});
router.post('/intelligence/refresh',requireAdministrator,async(_req,res)=>{
 const customers=await Customer.find({optedOut:{$ne:true}}).select('_id').limit(100);for(const customer of customers)await refreshCustomerIntelligence(String(customer._id));res.json({refreshed:customers.length});
});
router.patch('/intelligence/actions/:id',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id)||!['open','done','dismissed'].includes(req.body?.status))return res.status(400).json({error:'Invalid action update'});
 const status=req.body.status;const action=await CustomerAction.findOneAndUpdate({_id:req.params.id},{$set:{status,...(status==='open'?{closedAt:null,closedBy:null}:{closedAt:new Date(),closedBy:requireTenantContext().userId})}},{new:true});
 if(!action)return res.status(404).json({error:'Action not found'});res.json(action);
});
export default router;
