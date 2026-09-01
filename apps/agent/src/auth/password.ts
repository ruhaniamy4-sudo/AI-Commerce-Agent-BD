import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';

const scrypt = promisify(crypto.scrypt);
const commonPasswords = new Set([
    '1234567890', 'qwerty12345', 'password123', 'password1234', 'admin12345',
    'letmein123', 'welcome123', 'sellpilot123',
]);

export function passwordValidationError(password: string, identityHints: string[] = []): string | undefined {
    if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    if (password.length > 200) return 'Password must be at most 200 characters';
    const normalized = password.toLowerCase();
    if (commonPasswords.has(normalized) || /^(.)\1+$/.test(password)) return 'Choose a less common password';
    if (identityHints.some((hint) => hint.length >= 4 && normalized.includes(hint.toLowerCase()))) {
        return 'Password must not contain your name or email address';
    }
    return undefined;
}

export async function hashPassword(password: string): Promise<string> {
    const error = passwordValidationError(password);
    if (error) throw new Error(error);
    const salt = crypto.randomBytes(16);
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
    const [algorithm, saltValue, hashValue] = encoded.split('$');
    if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = (await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length)) as Buffer;
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
