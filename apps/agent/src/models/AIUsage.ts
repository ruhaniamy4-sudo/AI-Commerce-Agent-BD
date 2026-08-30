import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../tenancy/plugin';

export type AIOperationType = 'chat' | 'summary' | 'rag-assisted-chat' | 'vision' | 'embedding';

export interface IAIUsage {
    businessId: mongoose.Types.ObjectId;
    conversationId: string;
    eventIdentifier: string;
    model: string;
    provider?: 'groq'|'openai';
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    estimatedCost: number | null;
    operationType: AIOperationType;
    createdAt: Date;
}

const AIUsageSchema = new Schema<IAIUsage>({
    conversationId: { type: String, required: true },
    eventIdentifier: { type: String, required: true },
    model: { type: String, required: true },
    provider: { type: String, enum: ['groq','openai'], index: true },
    inputTokens: { type: Number, default: null, min: 0 },
    outputTokens: { type: Number, default: null, min: 0 },
    totalTokens: { type: Number, default: null, min: 0 },
    estimatedCost: { type: Number, default: null, min: 0 },
    operationType: {
        type: String,
        enum: ['chat', 'summary', 'rag-assisted-chat', 'vision', 'embedding'],
        required: true,
    },
}, { timestamps: true });

AIUsageSchema.plugin(tenantPlugin);
AIUsageSchema.index({ businessId: 1, createdAt: -1 });
AIUsageSchema.index({ provider: 1, model: 1, createdAt: -1 });
AIUsageSchema.index({ businessId: 1, conversationId: 1, createdAt: -1 });
AIUsageSchema.index({ businessId: 1, eventIdentifier: 1, operationType: 1 }, { unique: true });

export const AIUsage = mongoose.model<IAIUsage>('AIUsage', AIUsageSchema);
