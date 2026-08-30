import { describe, expect, it } from 'vitest';
import { UnsafeUrlError, isPrivateAddress, validatePublicUrl } from './url-security';

describe('website ingestion SSRF protection', () => {
    const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];
    it('accepts a public HTTP or HTTPS website', async () => {
        await expect(validatePublicUrl('https://example.com/shop', publicResolver)).resolves.toMatchObject({ hostname: 'example.com' });
    });
    it.each(['http://localhost:3000', 'http://127.0.0.1', 'file:///etc/passwd', 'http://metadata.google.internal/latest'])('rejects %s', async (url) => {
        await expect(validatePublicUrl(url, publicResolver)).rejects.toBeInstanceOf(UnsafeUrlError);
    });
    it.each(['10.0.0.1', '172.16.0.2', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1'])('classifies private address %s', (address) => {
        expect(isPrivateAddress(address)).toBe(true);
    });
    it('rejects a public hostname resolving to a private address', async () => {
        await expect(validatePublicUrl('https://store.example', async () => [{ address: '10.1.2.3', family: 4 }])).rejects.toThrow('Private');
    });
});
