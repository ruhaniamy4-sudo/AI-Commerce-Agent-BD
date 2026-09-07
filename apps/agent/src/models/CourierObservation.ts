import mongoose,{Schema} from 'mongoose';
import {tenantPlugin} from '../tenancy/plugin';
const schema=new Schema({orderId:{type:Schema.Types.ObjectId,required:true},provider:{type:String,enum:['redx'],required:true},reference:{type:String,required:true},status:String,lastSyncedAt:Date},{timestamps:true});schema.plugin(tenantPlugin);schema.index({businessId:1,provider:1,reference:1},{unique:true});export const CourierObservation=mongoose.model('CourierObservation',schema);
