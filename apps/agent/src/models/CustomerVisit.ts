import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';
const schema = new Schema({tokenHash:{type:String,required:true},visitorId:{type:String,required:true},sessionId:{type:String,required:true},customerId:Schema.Types.ObjectId,lastSeenAt:Date,checkoutAt:Date,purchasedAt:Date,expiresAt:{type:Date,required:true}},{timestamps:true});
schema.plugin(tenantPlugin);
schema.index({businessId:1,tokenHash:1},{unique:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export const CustomerVisit=mongoose.model('CustomerVisit',schema);
