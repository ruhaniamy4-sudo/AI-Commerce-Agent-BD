import { AIUsage } from '../models/AIUsage';
import { Business } from '../models/Business';
import { Subscription } from '../models/Subscription';
import { assertTenantBusinessId } from '../tenancy/context';
import { capOf, overrideOf, resolvePlanForSubscription } from './entitlement.service';

export type AIAccessReason='BUSINESS_SUSPENDED'|'PLATFORM_SUSPENDED'|'SUBSCRIPTION_INACTIVE'|'MERCHANT_DISABLED'|'REQUEST_LIMIT_REACHED'|'TOKEN_LIMIT_REACHED';
export type AIAccessUsage={requests:number;tokens:number};
export type AIAccessLimits={requests:number|null;tokens:number|null;source:'plan'|'override'|'mixed'|'none';plan?:string};
export type AIAccessDecision={
    allowed:boolean;
    reason?:AIAccessReason;
    usage?:AIAccessUsage;
    limits?:AIAccessLimits;
    /** Fraction of the tightest limit consumed, 0-1+, or null when nothing is capped. */
    consumed?:number|null;
    /** The merchant's own holding message, carried here so a blocked turn needs no second query. */
    pausedReply?:string;
    /** Consumption at which the merchant asked to be warned, 0-1. */
    warnAt?:number;
};

const startOfMonth=(date=new Date())=>new Date(date.getFullYear(),date.getMonth(),1);
/**
 * A plan sells "messages", so the counter is customer-facing replies — not every
 * AI call. Counting summaries, vision and embedding rows too would burn a
 * merchant's allowance two or three times faster than the plan promises.
 */
const REPLY_OPERATIONS=['chat','rag-assisted-chat'];

// Plan resolution and the catalog cache live in the shared entitlement service,
// so the AI gate and the seat/channel gates read the same limits.
export { clearPlanCacheForTests, resolvePlanForSubscription } from './entitlement.service';

/** Plan allowance first, per-business override on top — the override always wins. */
export function mergeLimits(planLimits:{messages?:number;tokens?:number}|undefined,override:{monthlyRequestLimit?:number;monthlyTokenLimit?:number}|undefined,planName?:string):AIAccessLimits{
    const planRequests=capOf(planLimits?.messages);
    const planTokens=capOf(planLimits?.tokens);
    const overrideRequests=overrideOf(override?.monthlyRequestLimit);
    const overrideTokens=overrideOf(override?.monthlyTokenLimit);
    const requests=overrideRequests??planRequests;
    const tokens=overrideTokens??planTokens;
    const overridden=(overrideRequests!==null?1:0)+(overrideTokens!==null?1:0);
    const source:AIAccessLimits['source']=requests===null&&tokens===null?'none'
        :overridden===0?'plan'
        :overridden===2||(planRequests===null&&planTokens===null)?'override'
        :'mixed';
    return {requests,tokens,source,...(planName?{plan:planName}:{})};
}

export async function readMonthlyUsage(now=new Date()):Promise<AIAccessUsage>{
    const [usage]=await AIUsage.aggregate([
        {$match:{createdAt:{$gte:startOfMonth(now)}}},
        {$group:{
            _id:null,
            requests:{$sum:{$cond:[{$in:['$operationType',REPLY_OPERATIONS]},1,0]}},
            tokens:{$sum:{$ifNull:['$totalTokens',0]}},
        }},
    ]);
    return {requests:usage?.requests||0,tokens:usage?.tokens||0};
}

/** How much of the tightest configured limit is used, for warning banners. */
export function consumedFraction(usage:AIAccessUsage,limits:AIAccessLimits){
    const ratios=[
        limits.requests!==null?usage.requests/Math.max(limits.requests,1):null,
        limits.tokens!==null?usage.tokens/Math.max(limits.tokens,1):null,
    ].filter((value):value is number=>value!==null);
    return ratios.length?Math.max(...ratios):null;
}

export async function evaluateBusinessAIAccess(businessId:string, now=new Date()):Promise<AIAccessDecision>{
    assertTenantBusinessId(businessId,'ai-access.evaluate');
    const business=await Business.findById(businessId).select('status aiAccess').lean();
    if(!business||business.status!=='active') return {allowed:false,reason:'BUSINESS_SUSPENDED'};
    const state=business.aiAccess?.status||'ENABLED';
    const pausedReply=business.aiAccess?.pausedReply;
    if(state==='SUSPENDED_BY_PLATFORM') return {allowed:false,reason:'PLATFORM_SUSPENDED',pausedReply};
    if(state==='SUSPENDED_BY_SUBSCRIPTION') return {allowed:false,reason:'SUBSCRIPTION_INACTIVE',pausedReply};
    if(state==='DISABLED_BY_MERCHANT') return {allowed:false,reason:'MERCHANT_DISABLED',pausedReply};

    const subscription=await Subscription.findOne({businessId}).lean();
    if(/^true$/i.test(process.env.AI_SUBSCRIPTION_ENFORCEMENT||'')){
        if(!subscription||!['ACTIVE','TRIAL'].includes(subscription.status)||(subscription.currentPeriodEnd&&subscription.currentPeriodEnd<now)||(subscription.trialEndsAt&&subscription.status==='TRIAL'&&subscription.trialEndsAt<now)) return {allowed:false,reason:'SUBSCRIPTION_INACTIVE',pausedReply};
    }

    // The plan the merchant pays for sets the allowance; a platform-admin override
    // replaces it. Before this, plan limits were decorative and only overrides bit.
    const plan=await resolvePlanForSubscription(subscription);
    const limits=mergeLimits(plan?.limits,business.aiAccess,plan?.name);
    if(limits.requests===null&&limits.tokens===null) return {allowed:true,limits};

    const usage=await readMonthlyUsage(now);
    const consumed=consumedFraction(usage,limits);
    const warnAt=Math.min(100,Math.max(1,business.aiAccess?.warningThresholdPercent||80))/100;
    if(limits.requests!==null&&usage.requests>=limits.requests) return {allowed:false,reason:'REQUEST_LIMIT_REACHED',usage,limits,consumed,pausedReply,warnAt};
    if(limits.tokens!==null&&usage.tokens>=limits.tokens) return {allowed:false,reason:'TOKEN_LIMIT_REACHED',usage,limits,consumed,pausedReply,warnAt};
    return {allowed:true,usage,limits,consumed,warnAt};
}
