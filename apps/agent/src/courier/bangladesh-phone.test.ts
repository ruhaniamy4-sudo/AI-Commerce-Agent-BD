import { describe, expect, it } from 'vitest';
import { normalizeBangladeshPhone } from './bangladesh-phone';

describe('Bangladesh phone normalization', () => {
    it.each([
        ['01712345678', '01712345678'],
        ['+8801712345678', '01712345678'],
        ['8801712345678', '01712345678'],
        ['01712-345 678', '01712345678'],
    ])('normalizes %s', (input, expected) => {
        expect(normalizeBangladeshPhone(input)).toBe(expected);
    });

    it.each(['', '12345', '01212345678', '+8802012345678', '017123456789'])('rejects invalid number %s', (input) => {
        expect(() => normalizeBangladeshPhone(input)).toThrow('valid Bangladesh');
    });
});
