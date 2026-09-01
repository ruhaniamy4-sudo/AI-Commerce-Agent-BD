export function customerFacingText(value: unknown): string {
  let current: unknown = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (typeof current !== 'string') break;
    const trimmed = current.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    if (!trimmed) return '';
    if (!/^[\[{\"]/.test(trimmed)) return trimmed;
    try { current = JSON.parse(trimmed); } catch { return /^[\[{]/.test(trimmed) ? 'The assistant response could not be displayed safely.' : trimmed; }
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
  return 'The assistant response could not be displayed safely.';
}
