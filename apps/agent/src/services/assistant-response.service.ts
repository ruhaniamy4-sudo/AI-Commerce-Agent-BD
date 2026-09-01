export interface NormalizedAssistantResponse {
    message_text: string;
    action?: string;
    action_payload?: Record<string, unknown>;
    quick_replies?: string[];
    suggested_products?: unknown[];
    [key: string]: unknown;
}

export const SAFE_ASSISTANT_RESPONSE_FALLBACK = 'I could not format that response safely. Please try again.';

function contentText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content
        .map((part) => typeof part === 'string' ? part : part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text || '') : '')
        .filter(Boolean)
        .join('\n');
    if (content && typeof content === 'object') return JSON.stringify(content);
    return String(content ?? '');
}

function stripFences(value: string) {
    return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseCandidate(value: string): unknown {
    let candidate: unknown = value;
    for (let depth = 0; depth < 3 && typeof candidate === 'string'; depth += 1) {
        const clean = stripFences(candidate);
        try {
            candidate = JSON.parse(clean);
        } catch {
            const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try { return JSON.parse(clean.slice(start, end + 1)); } catch { return undefined; }
            }
            return undefined;
        }
    }
    return candidate;
}

function safeMessageText(value: unknown): string {
    const text = contentText(value).trim();
    if (!text) return SAFE_ASSISTANT_RESPONSE_FALLBACK;
    const nested = parseCandidate(text);
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const record = nested as Record<string, unknown>;
        return safeMessageText(record.message_text ?? record.content ?? record.text);
    }
    if (typeof nested === 'string' && nested !== text) return safeMessageText(nested);
    if (/^[\[{]/.test(text) || /["']message_text["']\s*:/.test(text)) return SAFE_ASSISTANT_RESPONSE_FALLBACK;
    return text;
}

export function normalizeAssistantResponse(content: unknown): NormalizedAssistantResponse {
    const raw = contentText(content);
    const parsed = parseCandidate(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        return {
            ...record,
            message_text: safeMessageText(record.message_text ?? record.content ?? record.text),
            action: typeof record.action === 'string' ? record.action : 'none',
            action_payload: record.action_payload && typeof record.action_payload === 'object' && !Array.isArray(record.action_payload) ? record.action_payload as Record<string, unknown> : {},
            quick_replies: Array.isArray(record.quick_replies) ? record.quick_replies.map(String).slice(0, 10) : [],
            suggested_products: Array.isArray(record.suggested_products) ? record.suggested_products.slice(0, 10) : [],
        };
    }
    return { message_text: safeMessageText(raw), action: 'none', action_payload: {}, quick_replies: [], suggested_products: [] };
}

export function normalizeAssistantText(content: unknown) {
    return normalizeAssistantResponse(content).message_text;
}
