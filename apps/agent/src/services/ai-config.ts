function boundedInteger(name: string, fallback: number, min: number, max: number) {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export const getAIRecentMessageLimit = () => boundedInteger('AI_RECENT_MESSAGE_LIMIT', 12, 4, 50);
export const getAISummaryThreshold = () => boundedInteger('AI_SUMMARY_THRESHOLD', 20, 10, 200);
export const getRagTopK = () => boundedInteger('RAG_TOP_K', 3, 1, 10);
export const getAIMaxOutputTokens = () => boundedInteger('AI_MAX_OUTPUT_TOKENS', 500, 100, 2000);
export const getAIModel = () => process.env.OPENAI_MODEL || 'gpt-5.2';

export function getModelPricing(model: string): { input: number; output: number } | undefined {
    try {
        const map = JSON.parse(process.env.AI_MODEL_PRICING_JSON || '{}');
        const pricing = map[model];
        return typeof pricing?.input === 'number' && typeof pricing?.output === 'number' ? pricing : undefined;
    } catch {
        return undefined;
    }
}
