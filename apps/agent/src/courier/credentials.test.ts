import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptCourierCredentials, encryptCourierCredentials } from './credentials';
import { serializeCourierIntegration } from './courier.service';

describe('courier credential safety', () => {
    const originalKey = process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY;
    beforeEach(() => { process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY = 'test-only-courier-key-with-32-characters'; });
    afterEach(() => {
        if (originalKey === undefined) delete process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY;
        else process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY = originalKey;
    });

    it('encrypts credentials at rest and decrypts only server-side', () => {
        const encrypted = encryptCourierCredentials({ apiKey: 'api-secret-value', secretKey: 'secret-secret-value' });
        expect(encrypted).not.toContain('api-secret-value');
        expect(encrypted).not.toContain('secret-secret-value');
        expect(decryptCourierCredentials(encrypted)).toEqual({ apiKey: 'api-secret-value', secretKey: 'secret-secret-value' });
    });

    it('never includes stored credentials in dashboard metadata', () => {
        const result = serializeCourierIntegration({
            provider: 'steadfast', status: 'connected', credentialsEncrypted: 'sensitive', settings: { deliveryType: 0 },
        });
        expect(result).toMatchObject({ provider: 'steadfast', connected: true, configured: true });
        expect(JSON.stringify(result)).not.toContain('sensitive');
        expect(result).not.toHaveProperty('credentialsEncrypted');
    });
});
