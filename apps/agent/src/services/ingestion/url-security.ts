import dns from 'node:dns/promises';
import net from 'node:net';

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export class UnsafeUrlError extends Error {
    constructor(message: string) { super(message); this.name = 'UnsafeUrlError'; }
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
    let url: URL;
    try { url = new URL(input); } catch { throw new UnsafeUrlError('Enter a valid website URL'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new UnsafeUrlError('Only HTTP and HTTPS websites are supported');
    if (url.username || url.password) throw new UnsafeUrlError('Website URLs cannot contain credentials');
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
        throw new UnsafeUrlError('Private or internal websites cannot be imported');
    }
    const literal = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await resolver(hostname);
    if (!literal.length || literal.some(({ address }) => isPrivateAddress(address))) {
        throw new UnsafeUrlError('Private or internal website addresses cannot be imported');
    }
    url.hash = '';
    return url;
}
