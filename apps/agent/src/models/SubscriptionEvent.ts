import mongoose, { Document, Schema } from 'mongoose';
export type SubscriptionEventType = 'START'|'NEW_SUBSCRIPTION'|'RENEWAL'|'UPGRADE'|'DOWNGRADE'|'EXPIRY'|'CANCELLATION'|'REACTIVATION'|'STATUS_CHANGE';
// Not every transition has a human behind it: trials are provisioned at signup and
// renewals/expiries will be moved by the scheduler, so the actor has to be recorded.
export type SubscriptionEventSource = 'system'|'platform_admin'|'merchant';
export interface ISubscriptionEvent extends Document { businessId:mongoose.Types.ObjectId;subscriptionId:mongoose.Types.ObjectId;type:SubscriptionEventType;source:SubscriptionEventSource;previousValue?:unknown;newValue?:unknown;reason:string;platformAdminId?:mongoose.Types.ObjectId;createdAt:Date }
const SubscriptionEventSchema=new Schema<ISubscriptionEvent>({businessId:{type:Schema.Types.ObjectId,ref:'Business',required:true,index:true},subscriptionId:{type:Schema.Types.ObjectId,ref:'Subscription',required:true,index:true},type:{type:String,enum:['START','NEW_SUBSCRIPTION','RENEWAL','UPGRADE','DOWNGRADE','EXPIRY','CANCELLATION','REACTIVATION','STATUS_CHANGE'],required:true,index:true},source:{type:String,enum:['system','platform_admin','merchant'],required:true,index:true},previousValue:Schema.Types.Mixed,newValue:Schema.Types.Mixed,reason:{type:String,required:true,maxlength:500},platformAdminId:{type:Schema.Types.ObjectId,ref:'PlatformAdmin',required:function(this:ISubscriptionEvent){return this.source==='platform_admin';}}}, {timestamps:{createdAt:true,updatedAt:false}});
SubscriptionEventSchema.index({businessId:1,createdAt:-1}); SubscriptionEventSchema.index({subscriptionId:1,createdAt:-1});
export const SubscriptionEvent=mongoose.model<ISubscriptionEvent>('SubscriptionEvent',SubscriptionEventSchema);
