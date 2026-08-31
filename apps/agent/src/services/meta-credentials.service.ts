import crypto from 'node:crypto';

const VERSION = 'v1';

function encryptionKey() {
    const material = process.env.FACEBOOK_CREDENTIALS_ENCRYPTION_KEY || process.env.COURIER_CREDENTIALS_ENCRYPTION_KEY;
    if (!material || material.length < 32) throw new Error('Facebook credential encryption is not configured');
    return crypto.createHash('sha256').update(material, 'utf8').digest();
}

export function encryptMetaAccessToken(accessToken: string) {
    if (!accessToken || accessToken.length < 20) throw new Error('Meta access token is invalid');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(accessToken, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptMetaAccessToken(value: string) {
    const [version, ivValue, tagValue, ciphertextValue] = String(value || '').split('.');
    if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) throw new Error('Stored Facebook credentials are invalid');
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
        throw new Error('Stored Facebook credentials could not be decrypted');
    }
}

export function redactMetaSecrets(input: unknown): string {
    const value = input instanceof Error ? input.message : typeof input === 'string' ? input : JSON.stringify(input || {});
    return value
        .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
        .replace(/(access_token|appsecret_proof|authorization)(["'\s:=]+)([^\s,"'}&]+)/gi, '$1$2[REDACTED]')
        .replace(/EAA[A-Za-z0-9_-]{10,}/g, '[REDACTED_META_TOKEN]');
}
