import dns from 'node:dns/promises';
import net from 'node:net';

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export type WebsiteAddressErrorCode = 'INVALID_INPUT' | 'UNSAFE_ADDRESS' | 'UNREACHABLE';

export class UnsafeUrlError extends Error {
    constructor(message: string, public readonly code: WebsiteAddressErrorCode = 'UNSAFE_ADDRESS') { super(message); this.name = 'UnsafeUrlError'; }
}

/**
 * Turns the way a merchant normally pastes an address into one parseable URL.
 * Security decisions intentionally do not live here; validatePublicUrl owns them.
 */
export function normalizeMerchantUrl(input: unknown): URL {
    let value = String(input ?? '').trim();
    if (!value) throw new UnsafeUrlError('Please enter a website address.', 'INVALID_INPUT');
    // Copying from chat often includes a harmless matching quote/bracket pair.
    const wrappers: Array<[string, string]> = [['"', '"'], ["'", "'"], ['<', '>'], ['(', ')'], ['[', ']']];
    for (const [open, close] of wrappers) {
        if (value.startsWith(open) && value.endsWith(close)) value = value.slice(1, -1).trim();
    }
    if (!value) throw new UnsafeUrlError('Please enter a website address.', 'INVALID_INPUT');
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;
    let url: URL;
    try { url = new URL(value); } catch { throw new UnsafeUrlError('Please enter a valid website address.', 'INVALID_INPUT'); }
    if (!url.hostname || (!url.hostname.includes('.') && !net.isIP(url.hostname))) {
        throw new UnsafeUrlError('Please enter a valid website address.', 'INVALID_INPUT');
    }
    url.hash = '';
    return url;
}

export function isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase().split('%')[0];
    if (net.isIPv4(normalized)) {
        const [a, b] = normalized.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19));
    }
    if (net.isIPv6(normalized)) {
        return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
            normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') ||
            normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.');
    }
    return true;
}

const defaultResolver: Resolver = async (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

export async function validatePublicUrl(input: string, resolver: Resolver = defaultResolver): Promise<URL> {
    const url = normalizeMerchantUrl(input);
    if (!['http:', 'https:'].includes(url.protocol)) throw new UnsafeUrlError("This address can't be imported.");
    if (url.username || url.password) throw new UnsafeUrlError("This address can't be imported.");
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
        throw new UnsafeUrlError("This address can't be imported.");
    }
    let literal: Array<{ address: string; family: number }>;
    try { literal = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await resolver(hostname); }
    catch { throw new UnsafeUrlError("We couldn't reach this website. Check the link and try again.", 'UNREACHABLE'); }
    if (!literal.length || literal.some(({ address }) => isPrivateAddress(address))) {
        throw new UnsafeUrlError("This address can't be imported.");
    }
    url.hash = '';
    return url;
}
