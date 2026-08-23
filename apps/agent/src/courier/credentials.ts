import crypto from 'node:crypto';
import { CourierCredentials } from './types';

const VERSION = 'v1';

function encryptionKey() {
    const material = process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY;
    if (!material || material.length < 32) {
        throw new Error('Courier credential encryption is not configured');
    }
    return crypto.createHash('sha256').update(material, 'utf8').digest();
}

export function encryptCourierCredentials(credentials: CourierCredentials): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptCourierCredentials(value: string): CourierCredentials {
    const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
    if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) {
        throw new Error('Stored courier credentials are invalid');
    }
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(ciphertextValue, 'base64url')),
            decipher.final(),
        ]).toString('utf8');
        const parsed = JSON.parse(plaintext) as CourierCredentials;
        if (!parsed.apiKey || !parsed.secretKey) throw new Error('Missing courier credentials');
        return parsed;
    } catch {
        throw new Error('Stored courier credentials could not be decrypted');
    }
}
