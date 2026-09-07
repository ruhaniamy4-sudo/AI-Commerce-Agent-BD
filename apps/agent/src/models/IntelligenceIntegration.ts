import mongoose,{Schema} from 'mongoose';
// Public callbacks resolve this registry, then enter a tenant context. All merchant reads are explicitly scoped.
const schema=new Schema({businessId:{type:Schema.Types.ObjectId,required:true},provider:{type:String,enum:['pathao','redx','sslcommerz','bkash','nagad','stripe'],required:true},credentials:{type:String,select:false,required:true},enabled:{type:Boolean,default:true}},{timestamps:true});
schema.index({businessId:1,provider:1},{unique:true});
export const IntelligenceIntegration=mongoose.model('IntelligenceIntegration',schema);
