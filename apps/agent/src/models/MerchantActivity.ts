import mongoose,{Document,Schema} from 'mongoose';
export interface IMerchantActivity extends Document {businessId:mongoose.Types.ObjectId;userId:mongoose.Types.ObjectId;sessionStartedAt:Date;lastSeenAt:Date;createdAt:Date;updatedAt:Date}
const MerchantActivitySchema=new Schema<IMerchantActivity>({businessId:{type:Schema.Types.ObjectId,ref:'Business',required:true},userId:{type:Schema.Types.ObjectId,ref:'User',required:true},sessionStartedAt:{type:Date,required:true},lastSeenAt:{type:Date,required:true,index:true}},{timestamps:true});
MerchantActivitySchema.index({businessId:1,userId:1},{unique:true}); MerchantActivitySchema.index({lastSeenAt:-1,businessId:1}); MerchantActivitySchema.index({businessId:1,lastSeenAt:-1});
export const MerchantActivity=mongoose.model<IMerchantActivity>('MerchantActivity',MerchantActivitySchema);
