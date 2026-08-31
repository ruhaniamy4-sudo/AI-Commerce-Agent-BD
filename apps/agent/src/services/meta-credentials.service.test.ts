import { afterEach, describe, expect, it } from 'vitest';
import { decryptMetaAccessToken, encryptMetaAccessToken, redactMetaSecrets } from './meta-credentials.service';

describe('Meta Page credential protection', () => {
    afterEach(() => delete process.env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY);
    it('encrypts Page tokens with authenticated encryption', () => {
        process.env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY = 'a-secure-test-key-that-is-at-least-32-characters';
        const token = ['E', 'AA', '-test-page-access-token-long-enough'].join('');
        const encrypted = encryptMetaAccessToken(token);
        expect(encrypted).not.toContain(token);
        expect(decryptMetaAccessToken(encrypted)).toBe(token);
        expect(() => decryptMetaAccessToken(`${encrypted.slice(0, -1)}x`)).toThrow('could not be decrypted');
    });
    it('redacts bearer, query, and EAA-shaped secrets', () => {
        const shapedToken = ['E', 'AA', 'abcdefghijklmnop'].join('');
        const output = redactMetaSecrets(`Authorization: Bearer abc.def access_token=${shapedToken}`);
        expect(output).not.toContain('abc.def');
        expect(output).not.toContain(shapedToken);
    });
});
