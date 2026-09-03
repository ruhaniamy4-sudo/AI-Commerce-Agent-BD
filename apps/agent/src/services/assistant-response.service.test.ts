import { describe, it, expect } from 'vitest';
import {
    normalizeAssistantResponse,
    normalizeAssistantText,
    SAFE_ASSISTANT_RESPONSE_FALLBACK,
} from './assistant-response.service';

describe('normalizeAssistantResponse', () => {
    it('handles clean standard JSON response', () => {
        const input = JSON.stringify({
            language: 'bn',
            message_text: 'Amader black polo t-shirt ache.',
            action: 'none',
            suggested_products: [{ id: 'p1', name: 'Polo T-Shirt' }],
        });
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe('Amader black polo t-shirt ache.');
        expect(result.suggested_products).toHaveLength(1);
        expect(result.quick_replies).toEqual([]);
    });

    it('handles markdown fenced JSON blocks', () => {
        const input = '```json\n{"message_text": "Ei product-ti stock-e ache."}\n```';
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe('Ei product-ti stock-e ache.');
    });

    it('handles embedded JSON surrounded by model conversational prose', () => {
        const input = 'Sure! Here is the response:\n```json\n{"message_text": "Dam 500 taka."}\n```\nHope that helps!';
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe('Dam 500 taka.');
    });

    it('handles double-encoded JSON string', () => {
        const inner = JSON.stringify({ message_text: 'Double encoded message' });
        const input = JSON.stringify(inner);
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe('Double encoded message');
    });

    it('handles malformed JSON with trailing commas and unescaped newlines', () => {
        const input = '{\n  "message_text": "Line 1\nLine 2",\n  "action": "none",\n}';
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toContain('Line 1');
    });

    it('handles malformed JSON with unescaped internal quotes via regex fallback', () => {
        const input = '{"message_text": "Amader "Polo" t-shirt ache.", "suggested_products": []}';
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe('Amader "Polo" t-shirt ache.');
    });

    it('handles plain text and Banglish responses without JSON wrapping', () => {
        const input = 'Amader black t-shirt ache. Price 450 taka.';
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe('Amader black t-shirt ache. Price 450 taka.');
    });

    it('guards against unparseable raw JSON leaking to the user', () => {
        const input = '{"message_text": ';
        const result = normalizeAssistantResponse(input);
        expect(result.message_text).toBe(SAFE_ASSISTANT_RESPONSE_FALLBACK);
    });
});
