function boundedInteger(name: string, fallback: number, min: number, max: number) {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export const getAIRecentMessageLimit = () => boundedInteger('AI_RECENT_MESSAGE_LIMIT', 4, 2, 12);
// The transcript summary is free (no LLM call), so it starts as soon as messages
// fall out of the recent window rather than twenty messages later, when the
// conversation had already lost them.
export const getAISummaryThreshold = () => boundedInteger('AI_SUMMARY_THRESHOLD', 6, 2, 200);
export const getRagTopK = () => boundedInteger('RAG_TOP_K', 2, 1, 3);
// Recent-turn history is re-sent on every LLM call. 1800 characters (~450 tokens)
// covers three or four real turns; the running summary and entity memory carry
// anything older, so a larger window buys repetition rather than recall.
export const getAIHistoryCharBudget = () => boundedInteger('AI_HISTORY_CHAR_BUDGET', 1800, 600, 6000);
// Per-message ceiling inside that budget. A single catalog listing runs to about
// nine hundred characters and used to consume the entire window by itself,
// leaving the model one exchange of context. Capping each turn at ~100 tokens
// fits six to eight real turns into the same budget, which is the difference the
// customer feels when they say "1 please" three messages after seeing a product.
export const getAIHistoryMessageCharCap = () => boundedInteger('AI_HISTORY_MESSAGE_CHAR_CAP', 400, 120, 2000);
export const getAIMaxOutputTokens = () => {
    // An operator ceiling wins when one is set; 0 means "use whatever this
    // deployment was configured with", which is also what a cold cache reads.
    const override = Number(cachedSetting<number>('ai.max_output_tokens'));
    if (Number.isFinite(override) && override > 0) return Math.min(2000, Math.max(100, Math.round(override)));
    return boundedInteger('AI_MAX_OUTPUT_TOKENS', 500, 100, 2000);
};
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
/**
 * The console can name a different model on the same provider — the API key and
 * base URL stay with the deployment, so switching provider remains a deploy-time
 * decision while switching model does not.
 */
export const getAIModel = () => String(cachedSetting<string>('ai.primary_model') || '').trim() || getAIConfiguration().model;

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
import { cachedSetting } from './platform-settings.service';
