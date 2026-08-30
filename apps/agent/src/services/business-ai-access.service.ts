import { AIUsage } from '../models/AIUsage';
import { Business } from '../models/Business';
import { Subscription } from '../models/Subscription';
import { assertTenantBusinessId } from '../tenancy/context';

export type AIAccessDecision={allowed:boolean;reason?:'BUSINESS_SUSPENDED'|'PLATFORM_SUSPENDED'|'SUBSCRIPTION_INACTIVE'|'MERCHANT_DISABLED'|'REQUEST_LIMIT_REACHED'|'TOKEN_LIMIT_REACHED';usage?:{requests:number;tokens:number}};
const startOfMonth=(date=new Date())=>new Date(date.getFullYear(),date.getMonth(),1);

export async function evaluateBusinessAIAccess(businessId:string, now=new Date()):Promise<AIAccessDecision>{
    assertTenantBusinessId(businessId,'ai-access.evaluate');
    const business=await Business.findById(businessId).select('status aiAccess').lean();
    if(!business||business.status!=='active') return {allowed:false,reason:'BUSINESS_SUSPENDED'};
    const state=business.aiAccess?.status||'ENABLED';
    if(state==='SUSPENDED_BY_PLATFORM') return {allowed:false,reason:'PLATFORM_SUSPENDED'};
    if(state==='SUSPENDED_BY_SUBSCRIPTION') return {allowed:false,reason:'SUBSCRIPTION_INACTIVE'};
    if(state==='DISABLED_BY_MERCHANT') return {allowed:false,reason:'MERCHANT_DISABLED'};
    if(/^true$/i.test(process.env.AI_SUBSCRIPTION_ENFORCEMENT||'')){
        const subscription=await Subscription.findOne({businessId}).lean();
        if(!subscription||!['ACTIVE','TRIAL'].includes(subscription.status)||(subscription.currentPeriodEnd&&subscription.currentPeriodEnd<now)||(subscription.trialEndsAt&&subscription.status==='TRIAL'&&subscription.trialEndsAt<now)) return {allowed:false,reason:'SUBSCRIPTION_INACTIVE'};
    }
    const requestLimit=business.aiAccess?.monthlyRequestLimit; const tokenLimit=business.aiAccess?.monthlyTokenLimit;
    if(requestLimit||tokenLimit){
        const [usage]=await AIUsage.aggregate([{$match:{createdAt:{$gte:startOfMonth(now)}}},{$group:{_id:null,requests:{$sum:1},tokens:{$sum:{$ifNull:['$totalTokens',0]}}}}]);
        const totals={requests:usage?.requests||0,tokens:usage?.tokens||0};
        if(requestLimit&&totals.requests>=requestLimit)return {allowed:false,reason:'REQUEST_LIMIT_REACHED',usage:totals};
        if(tokenLimit&&totals.tokens>=tokenLimit)return {allowed:false,reason:'TOKEN_LIMIT_REACHED',usage:totals};
        return {allowed:true,usage:totals};
    }
    return {allowed:true};
}
