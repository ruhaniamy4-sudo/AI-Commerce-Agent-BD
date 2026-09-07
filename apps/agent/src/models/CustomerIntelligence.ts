import mongoose,{Schema} from 'mongoose';
import {tenantPlugin} from '../tenancy/plugin';
const schema=new Schema({customerId:{type:Schema.Types.ObjectId,required:true},version:String,snapshot:Schema.Types.Mixed,calculatedAt:Date},{timestamps:true});schema.plugin(tenantPlugin);schema.index({businessId:1,customerId:1},{unique:true});
export const CustomerIntelligence=mongoose.model('CustomerIntelligence',schema);
