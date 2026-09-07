import { Router } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { customerTimeline } from '../intelligence/event-store';
import {reconcileCustomerMessages,reconcileCustomerOrders} from '../intelligence/reconcile';
const router = Router();
import {refreshCustomerIntelligence} from '../intelligence/customer-intelligence';
import {Conversation} from '../models/Conversation';
router.get('/customers/:id/intelligence',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid customer'});
 const result=await refreshCustomerIntelligence(req.params.id);if(!result)return res.status(404).json({error:'Customer not found'});res.json(result);
});
router.get('/conversations/:id/intelligence',async(req,res)=>{
 const conversation=await Conversation.findOne(mongoose.isValidObjectId(req.params.id)?{_id:req.params.id}:{conversationId:req.params.id});
 if(!conversation?.customerId)return res.status(404).json({error:'Conversation customer not found'});
 if(conversation.platform==='manual'||/^test[_-]/.test(conversation.conversationId))return res.json({intelligence:null,sandbox:true});
 res.json(await refreshCustomerIntelligence(String(conversation.customerId)));
});
router.get('/customers/:id/timeline', async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Invalid customer'});
  if (!await Customer.exists({_id:req.params.id})) return res.status(404).json({error:'Customer not found'});
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;
  if (before && !Number.isFinite(before.getTime())) return res.status(400).json({error:'Invalid cursor'});
  await reconcileCustomerMessages(req.params.id);
  await reconcileCustomerOrders(req.params.id);
  res.json({data:await customerTimeline(req.params.id,before)});
});
export default router;
