import mongoose,{Schema} from 'mongoose';

/** The adapters this registry knows. One list drives the schema, the types and the request guard. */
export const INTELLIGENCE_PROVIDERS=['pathao','redx','sslcommerz','bkash','nagad','stripe'] as const;
export type IntelligenceProvider=(typeof INTELLIGENCE_PROVIDERS)[number];

/** Narrow untrusted input before it reaches a query; anything else is not a provider. */
export function intelligenceProvider(value:unknown):IntelligenceProvider|undefined{
 return INTELLIGENCE_PROVIDERS.includes(value as IntelligenceProvider)?value as IntelligenceProvider:undefined;
}

// Public callbacks resolve this registry, then enter a tenant context. All merchant reads are explicitly scoped.
const schema=new Schema({businessId:{type:Schema.Types.ObjectId,required:true},provider:{type:String,enum:[...INTELLIGENCE_PROVIDERS],required:true},credentials:{type:String,select:false,required:true},enabled:{type:Boolean,default:true}},{timestamps:true});
schema.index({businessId:1,provider:1},{unique:true});
export const IntelligenceIntegration=mongoose.model('IntelligenceIntegration',schema);
