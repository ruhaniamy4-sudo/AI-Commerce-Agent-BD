import { Router } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { customerTimeline } from '../intelligence/event-store';
import {reconcileCustomerMessages} from '../intelligence/reconcile';
const router = Router();
router.get('/customers/:id/timeline', async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Invalid customer'});
  if (!await Customer.exists({_id:req.params.id})) return res.status(404).json({error:'Customer not found'});
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;
  if (before && !Number.isFinite(before.getTime())) return res.status(400).json({error:'Invalid cursor'});
  await reconcileCustomerMessages(req.params.id);
  res.json({data:await customerTimeline(req.params.id,before)});
});
export default router;
