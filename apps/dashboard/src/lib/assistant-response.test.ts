import { describe, expect, it } from 'vitest';
import { customerFacingText } from './assistant-response';

describe('customer-facing Test AI rendering', () => {
  it('extracts normal, fenced, and double-encoded assistant text', () => {
    expect(customerFacingText('{"message_text":"hello"}')).toBe('hello');
    expect(customerFacingText('```json\n{"message_text":"welcome"}\n```')).toBe('welcome');
    expect(customerFacingText(JSON.stringify(JSON.stringify({ message_text: 'nested' })))).toBe('nested');
  });

  it('does not render malformed raw structured output and uses natural fallback', () => {
    const text = customerFacingText('{"unknown_key":"broken"');
    expect(text).not.toContain('unknown_key');
    expect(text).not.toContain('{');
    expect(text).toMatch(/sorry|couldn't format/i);
  });

  it('loosely recovers readable message text from unparseable raw JSON', () => {
    const text = customerFacingText('{"message_text":"Hello! How can I help you today?", unclosed');
    expect(text).toBe('Hello! How can I help you today?');
  });
});
