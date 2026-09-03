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

function stripFences(value: string): string {
    let text = value.trim();
    // 1. If wrapped entirely in fences:
    const fullFence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fullFence) return fullFence[1].trim();

    // 2. If contains fenced block inside prose:
    const embeddedFence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (embeddedFence) return embeddedFence[1].trim();

    return text;
}

function repairJsonString(raw: string): string {
    let clean = raw.trim();
    // Remove trailing commas before } or ]
    clean = clean.replace(/,(\s*[}\]])/g, '$1');
    // Replace literal newlines inside strings with \n
    clean = clean.replace(/(?<=:\s*"[^"]*)\n([^"]*")/g, '\\n$1');
    return clean;
}

function extractJsonBlock(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return text.slice(start, end + 1);
    }
    return null;
}

function tryParseJson(str: string): unknown {
    try {
        return JSON.parse(str);
    } catch {
        try {
            return JSON.parse(repairJsonString(str));
        } catch {
            return undefined;
        }
    }
}

function extractFieldRegex(text: string, fieldName: string): string | undefined {
    // 1. Matches "fieldName": "..." ending before next key or closing brace
    const pattern = new RegExp(`["']${fieldName}["']\\s*:\\s*"([\\s\\S]*?)(?:"\\s*,\\s*["']|\\s*"\\s*\\}|"\\s*$)`, 'i');
    const match = text.match(pattern);
    if (match && match[1].trim()) return match[1].trim();

    // 2. Single-quoted pattern:
    const singlePattern = new RegExp(`['"]${fieldName}['"]\\s*:\\s*'([\\s\\S]*?)(?:'\\s*,\\s*['"]|\\s*'\\s*\\}|'\\s*$)`, 'i');
    const singleMatch = text.match(singlePattern);
    if (singleMatch && singleMatch[1].trim()) return singleMatch[1].trim();

    // 3. Truncated open-quote pattern:
    const openQuotePattern = new RegExp(`["']${fieldName}["']\\s*:\\s*"([\\s\\S]*)$`, 'i');
    const openMatch = text.match(openQuotePattern);
    if (openMatch && openMatch[1].trim()) return openMatch[1].replace(/["'}\]\s]+$/, '').trim();

    return undefined;
}

function parseCandidate(value: string): unknown {
    let candidate: unknown = value;
    for (let depth = 0; depth < 3 && typeof candidate === 'string'; depth += 1) {
        const stripped = stripFences(candidate);
        let parsed = tryParseJson(stripped);
        if (parsed !== undefined) {
            candidate = parsed;
            continue;
        }

        const block = extractJsonBlock(stripped);
        if (block) {
            parsed = tryParseJson(block);
            if (parsed !== undefined) {
                candidate = parsed;
                continue;
            }
        }
        break;
    }
    return candidate;
}

function safeMessageText(value: unknown): string {
    const text = contentText(value).trim();
    if (!text) return SAFE_ASSISTANT_RESPONSE_FALLBACK;

    // Handle nested parsed objects or double-encoded strings
    const nested = parseCandidate(text);
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const record = nested as Record<string, unknown>;
        const inner = record.message_text ?? record.content ?? record.text ?? record.message;
        if (inner !== undefined && inner !== null) return safeMessageText(inner);
    }
    if (typeof nested === 'string' && nested !== text) return safeMessageText(nested);

    // If candidate parsing failed, attempt regex extraction of message_text from malformed JSON
    const extracted = extractFieldRegex(text, 'message_text') ?? extractFieldRegex(text, 'content') ?? extractFieldRegex(text, 'text');
    if (extracted !== undefined && extracted.trim().length > 0) {
        return safeMessageText(extracted);
    }

    // Plain text / Banglish: strip any surrounding fences
    const clean = stripFences(text).trim();

    // Guard: only return fallback if it's unparseable raw JSON syntax that still contains raw property keys or opening braces
    if (/["'](?:message_text|action|language)["']\s*:/.test(clean) || /^\s*\{/.test(clean)) {
        return SAFE_ASSISTANT_RESPONSE_FALLBACK;
    }

    return clean || SAFE_ASSISTANT_RESPONSE_FALLBACK;
}

export function normalizeAssistantResponse(content: unknown): NormalizedAssistantResponse {
    const raw = contentText(content);
    const parsed = parseCandidate(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        return {
            language: typeof record.language === 'string' ? record.language : 'bn',
            message_text: safeMessageText(record.message_text ?? record.content ?? record.text),
            action: typeof record.action === 'string' ? record.action : 'none',
            action_payload: record.action_payload && typeof record.action_payload === 'object' && !Array.isArray(record.action_payload) ? record.action_payload as Record<string, unknown> : {},
            quick_replies: Array.isArray(record.quick_replies) ? record.quick_replies.map(String).slice(0, 10) : [],
            suggested_products: Array.isArray(record.suggested_products) ? record.suggested_products.slice(0, 10) : [],
        };
    }

    // Malformed JSON fallback
    const extractedText = extractFieldRegex(raw, 'message_text') ?? extractFieldRegex(raw, 'content') ?? extractFieldRegex(raw, 'text');
    const extractedAction = extractFieldRegex(raw, 'action');
    const extractedLang = extractFieldRegex(raw, 'language');

    let suggestedProducts: unknown[] = [];
    const productsMatch = raw.match(/["']suggested_products["']\s*:\s*(\[[^\]]*\])/);
    if (productsMatch) {
        const parsedProducts = tryParseJson(productsMatch[1]);
        if (Array.isArray(parsedProducts)) suggestedProducts = parsedProducts.slice(0, 10);
    }

    return {
        language: extractedLang || 'bn',
        message_text: safeMessageText(extractedText !== undefined ? extractedText : raw),
        action: extractedAction || 'none',
        action_payload: {},
        quick_replies: [],
        suggested_products: suggestedProducts,
    };
}

export function normalizeAssistantText(content: unknown) {
    return normalizeAssistantResponse(content).message_text;
}
