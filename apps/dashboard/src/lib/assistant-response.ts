export function customerFacingText(value: unknown): string {
  let current: unknown = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (typeof current !== 'string') break;
    const trimmed = current.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    if (!trimmed) return '';
    if (!/^[\[{\"]/.test(trimmed)) return trimmed;
    try {
      current = JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/"(?:message_text|content|text|message)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      if (match && match[1]) {
        return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
      return /^[\[{]/.test(trimmed) ? "I'm sorry, I couldn't format that response properly. Could you please try again?" : trimmed;
    }
  }
  if (typeof current === 'string') return current.trim();
  if (Array.isArray(current)) return current.map(customerFacingText).filter(Boolean).join('\n');
  if (current && typeof current === 'object') {
    const record = current as Record<string, unknown>;
    for (const key of ['message_text', 'content', 'text', 'message']) {
      if (record[key] === undefined || record[key] === null) continue;
      const candidate = customerFacingText(record[key]);
      if (candidate) return candidate;
    }
  }
  return "I'm sorry, I couldn't format that response properly. Could you please try again?";
}
