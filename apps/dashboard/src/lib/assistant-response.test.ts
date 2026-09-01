import { describe, expect, it } from 'vitest';
import { customerFacingText } from './assistant-response';

describe('customer-facing Test AI rendering', () => {
  it('extracts normal, fenced, and double-encoded assistant text', () => {
    expect(customerFacingText('{"message_text":"hello"}')).toBe('hello');
    expect(customerFacingText('```json\n{"message_text":"welcome"}\n```')).toBe('welcome');
    expect(customerFacingText(JSON.stringify(JSON.stringify({ message_text: 'nested' })))).toBe('nested');
  });

  it('does not render malformed raw structured output', () => {
    const text = customerFacingText('{"message_text":"broken"');
    expect(text).not.toContain('message_text');
    expect(text).not.toContain('{');
  });
});
