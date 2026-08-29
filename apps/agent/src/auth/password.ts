import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password: string): Promise<string> {
    if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
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
