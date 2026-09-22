/**
 * The security policy an operator sets in the console, enforced.
 *
 * A policy page that only records numbers is worse than none: it reads as a control
 * and behaves as a note. Each value here is read on the path that enforces it —
 * password length and symbol rules when a password is set, the allowlist and the
 * lockout counter when an administrator signs in.
 */
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { passwordValidationError } from '../auth/password';
import { settingFlag, settingNumber, settingValue } from './platform-settings.service';

/**
 * The shipped validator is the floor. A console value can make passwords stricter
 * but never weaker, so a mistaken setting cannot lower the platform's baseline.
 */
export async function platformPasswordError(password: string, identityHints: string[] = []) {
    const builtIn = passwordValidationError(password, identityHints);
    if (builtIn) return builtIn;
    const minimum = Math.max(PASSWORD_MIN_LENGTH, await settingNumber('security.password_min_length'));
    if (password.length < minimum) return `Password must be at least ${minimum} characters`;
    if (await settingFlag('security.password_requires_symbol') && !/[^A-Za-z0-9]/.test(password)) {
        return 'Password must contain at least one symbol';
    }
    return undefined;
}

/** An empty allowlist means "anywhere", which is the default for a platform still being set up. */
export async function adminAddressAllowed(address: string | undefined) {
    const allowlist = await settingValue<string[]>('security.admin_ip_allowlist');
    if (!allowlist?.length) return true;
    if (!address) return false;
    // Proxies hand over IPv4-mapped IPv6 (`::ffff:1.2.3.4`), which no operator types
    // into an allowlist, so both forms are compared.
    const candidates = new Set([address, address.replace(/^::ffff:/, '')]);
    return allowlist.some(entry => candidates.has(entry.trim()));
}

export const LOCKOUT_MINUTES = 15;

/** How many consecutive failures are allowed before an administrator is locked out. */
export async function lockoutThreshold() {
    const configured = await settingNumber('security.admin_login_lockout_attempts');
    return configured > 0 ? configured : 0;
}
