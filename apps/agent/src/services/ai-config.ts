function boundedInteger(name: string, fallback: number, min: number, max: number) {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export const getAIRecentMessageLimit = () => boundedInteger('AI_RECENT_MESSAGE_LIMIT', 4, 2, 12);
export const getAISummaryThreshold = () => boundedInteger('AI_SUMMARY_THRESHOLD', 20, 10, 200);
export const getRagTopK = () => boundedInteger('RAG_TOP_K', 2, 1, 3);
// Recent-turn history is re-sent on every LLM call. 1800 characters (~450 tokens)
// covers three or four real turns; the running summary and entity memory carry
// anything older, so a larger window buys repetition rather than recall.
export const getAIHistoryCharBudget = () => boundedInteger('AI_HISTORY_CHAR_BUDGET', 1800, 600, 6000);
export const getAIMaxOutputTokens = () => boundedInteger('AI_MAX_OUTPUT_TOKENS', 500, 100, 2000);
export type ResponseComplexity = 'simple' | 'normal' | 'recommendation' | 'complex';
export function getTurnOutputTokenLimit(complexity: ResponseComplexity) {
    // Every reply is wrapped in a structured JSON envelope (language, message_text,
    // action, action_payload, quick_replies, suggested_products), which costs a
    // fixed ~50-70 tokens before any actual reply content. 96 was too tight for
    // that overhead plus a real sentence in Bangla/Banglish and caused the model's
    // JSON to get cut off mid-string, which the response parser cannot recover
    // from usefully — the customer saw a generic "couldn't generate a response"
    // fallback for ordinary small talk instead of an answer.
    const defaults = { simple: 160, normal: 192, recommendation: 300, complex: 500 } as const;
    return Math.min(getAIMaxOutputTokens(), boundedInteger(`AI_${complexity.toUpperCase()}_OUTPUT_TOKENS`, defaults[complexity], 64, 500));
}
export const getAIModel = () => getAIConfiguration().model;

export function getModelPricing(model: string): { input: number; output: number } | undefined {
    try {
        const map = JSON.parse(process.env.AI_MODEL_PRICING_JSON || '{}');
        const pricing = map[model];
        return typeof pricing?.input === 'number' && typeof pricing?.output === 'number' ? pricing : undefined;
    } catch {
        return undefined;
    }
}
import { getAIConfiguration } from '../config/runtime';
