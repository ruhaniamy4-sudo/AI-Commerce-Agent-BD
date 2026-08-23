import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIUsage } from '../models/AIUsage';
import { extractUsage, recordAIUsage } from './ai-usage.service';

describe('AI usage accounting', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.AI_MODEL_PRICING_JSON;
    });

    it('uses actual provider token metadata', () => {
        expect(extractUsage({ usage_metadata: {
            input_tokens: 100, output_tokens: 25, total_tokens: 125,
        } })).toEqual({ inputTokens: 100, outputTokens: 25, totalTokens: 125 });
    });

    it('records usage for the supplied conversation and event without guessing price', async () => {
        const update = vi.spyOn(AIUsage, 'findOneAndUpdate').mockResolvedValue({} as never);
        await recordAIUsage({
            conversationId: 'conversation-a',
            eventIdentifier: 'event-a',
            operationType: 'chat',
            response: { usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } },
        });
        expect(update.mock.calls[0][1]).toMatchObject({ $setOnInsert: {
            conversationId: 'conversation-a', inputTokens: 10, outputTokens: 5,
            totalTokens: 15, estimatedCost: null,
        } });
    });
});
