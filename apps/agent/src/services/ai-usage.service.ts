import { AIUsage, AIOperationType } from '../models/AIUsage';
import { getAIModel, getModelPricing } from './ai-config';

export function extractUsage(response: any) {
    const usage = response?.usage_metadata || response?.usage || response?.response_metadata?.usage || response?.response_metadata?.tokenUsage;
    if (!usage) return { inputTokens: null, outputTokens: null, totalTokens: null };
    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? null;
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? null;
    const totalTokens = usage.total_tokens ?? usage.totalTokens ??
        (typeof inputTokens === 'number' && typeof outputTokens === 'number' ? inputTokens + outputTokens : null);
    return { inputTokens, outputTokens, totalTokens };
}

export async function recordAIUsage(params: {
    conversationId: string;
    eventIdentifier: string;
    operationType: AIOperationType;
    response: unknown;
    model?: string;
}) {
    const { response, model: suppliedModel, ...identity } = params;
    const model = suppliedModel || getAIModel();
    const usage = extractUsage(response);
    const pricing = getModelPricing(model);
    const estimatedCost = pricing && usage.inputTokens !== null && usage.outputTokens !== null
        ? (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000
        : null;
    return AIUsage.findOneAndUpdate(
        { eventIdentifier: identity.eventIdentifier, operationType: identity.operationType },
        { $setOnInsert: { ...identity, model, ...usage, estimatedCost } },
        { upsert: true, new: true }
    );
}
