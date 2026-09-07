import mongoose,{Schema} from 'mongoose';
import {tenantPlugin} from '../tenancy/plugin';
const schema=new Schema({customerId:{type:Schema.Types.ObjectId,required:true},type:String,title:String,reason:String,priority:{type:String,enum:['high','normal']},status:{type:String,enum:['open','done','dismissed'],default:'open'},dueAt:Date,closedAt:Date,closedBy:String},{timestamps:true});
schema.plugin(tenantPlugin);schema.index({businessId:1,customerId:1,type:1},{unique:true});schema.index({businessId:1,status:1,dueAt:1});
export const CustomerAction=mongoose.model('CustomerAction',schema);
