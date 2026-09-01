import crypto from 'node:crypto';
import axios from 'axios';
import { cloudinaryPublicIdFromUrl, getCloudinaryImage, isCloudinaryConfigured, uploadImageBuffer } from '../cloudinary.service';
import { Resolver, validatePublicUrl } from './url-security';

const MAX_IMAGE_BYTES = 8_000_000;
const IMAGE_TIMEOUT_MS = 10_000;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

export interface ProductImageImport {
    sourceUrl: string;
    managedUrl?: string;
    status: 'managed' | 'mirrored' | 'external_fallback';
    errorCode?: 'INVALID_URL' | 'UNAVAILABLE' | 'UNSUPPORTED_TYPE' | 'TOO_LARGE';
    provider?: 'cloudinary';
    providerAssetId?: string;
    resourceType?: 'image';
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    source?: 'PRODUCT_UPLOAD'|'TRAINING_REVIEW'|'SCRAPED_PRODUCT';
    createdAt?: Date;
}

export class ExternalImageError extends Error {
    constructor(message: string, public code: ProductImageImport['errorCode']) { super(message); this.name = 'ExternalImageError'; }
}

function provenanceUrl(value: string) {
    try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString(); }
    catch { return value.slice(0, 2000); }
}

function hasSupportedSignature(buffer: Buffer, contentType: string) {
    if (contentType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (contentType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (contentType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
    if (contentType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (contentType === 'image/avif') return buffer.subarray(4, 12).toString('ascii').includes('ftypavif');
    return false;
}

export async function fetchPublicImage(input: string, redirects = 0, resolver?: Resolver): Promise<{ url: string; buffer: Buffer; contentType: string }> {
    if (redirects > 5) throw new ExternalImageError('Image redirected too many times', 'UNAVAILABLE');
    let safeUrl: URL;
    try { safeUrl = await validatePublicUrl(input, resolver); }
    catch { throw new ExternalImageError('Image URL is not a safe public URL', 'INVALID_URL'); }
    let response;
    try {
        response = await axios.get<ArrayBuffer>(safeUrl.toString(), {
            responseType: 'arraybuffer', timeout: IMAGE_TIMEOUT_MS, maxContentLength: MAX_IMAGE_BYTES, maxBodyLength: MAX_IMAGE_BYTES,
            maxRedirects: 0, validateStatus: (status) => status >= 200 && status < 400,
            headers: { 'User-Agent': 'SellPilotImageImporter/1.0', Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
        });
    } catch { throw new ExternalImageError('Image could not be downloaded', 'UNAVAILABLE'); }
    if (response.status >= 300) {
        const location = response.headers.location;
        if (!location) throw new ExternalImageError('Image redirect has no destination', 'UNAVAILABLE');
        return fetchPublicImage(new URL(location, safeUrl).toString(), redirects + 1, resolver);
    }
    const contentType = String(response.headers['content-type'] || '').toLowerCase().split(';')[0].trim();
    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) throw new ExternalImageError('Image type is not supported', 'UNSUPPORTED_TYPE');
    const declaredSize = Number(response.headers['content-length'] || 0);
    const buffer = Buffer.from(response.data);
    if (declaredSize > MAX_IMAGE_BYTES || buffer.length > MAX_IMAGE_BYTES) throw new ExternalImageError('Image is too large', 'TOO_LARGE');
    if (!hasSupportedSignature(buffer, contentType)) throw new ExternalImageError('Image content does not match its type', 'UNSUPPORTED_TYPE');
    return { url: safeUrl.toString(), buffer, contentType };
}

async function managedReference(value: string, businessId: string): Promise<ProductImageImport | undefined> {
    if (!isCloudinaryConfigured()) return undefined;
    const publicId = cloudinaryPublicIdFromUrl(value);
    if (!publicId?.startsWith(`sellpilot/${businessId}/`)) return undefined;
    try {
        const resource = await getCloudinaryImage(publicId);
        return { sourceUrl: provenanceUrl(value), managedUrl: resource.secure_url, status: 'managed', provider: 'cloudinary', providerAssetId: resource.public_id, resourceType: 'image', mimeType: resource.format ? `image/${resource.format === 'jpg' ? 'jpeg' : resource.format}` : undefined, size: resource.bytes, width: resource.width, height: resource.height, source: publicId.includes('/training-review/') ? 'TRAINING_REVIEW' : 'PRODUCT_UPLOAD', createdAt: resource.created_at ? new Date(resource.created_at) : new Date() };
    } catch { return undefined; }
}

export async function mirrorExternalProductImages(urls: string[], businessId: string, resolver?: Resolver): Promise<{ images: string[]; imports: ProductImageImport[] }> {
    const images: string[] = []; const imports: ProductImageImport[] = [];
    for (const sourceUrl of [...new Set(urls.filter((url) => typeof url === 'string' && url.trim()).map((url) => url.trim()))].slice(0, 12)) {
        const managed = await managedReference(sourceUrl, businessId);
        if (managed) { images.push(managed.managedUrl!); imports.push(managed); continue; }
        if (!isCloudinaryConfigured()) {
            try { images.push((await validatePublicUrl(sourceUrl, resolver)).toString()); imports.push({ sourceUrl: provenanceUrl(sourceUrl), status: 'external_fallback', errorCode: 'UNAVAILABLE' }); }
            catch { imports.push({ sourceUrl: provenanceUrl(sourceUrl), status: 'external_fallback', errorCode: 'INVALID_URL' }); }
            continue;
        }
        try {
            const downloaded = await fetchPublicImage(sourceUrl, 0, resolver);
            const publicId = crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32);
            const uploaded = await uploadImageBuffer(downloaded.buffer, `sellpilot/${businessId}/products/imported`, publicId);
            images.push(uploaded.secure_url); imports.push({ sourceUrl: provenanceUrl(sourceUrl), managedUrl: uploaded.secure_url, status: 'mirrored', provider: 'cloudinary', providerAssetId: uploaded.public_id, resourceType: 'image', mimeType: uploaded.format ? `image/${uploaded.format === 'jpg' ? 'jpeg' : uploaded.format}` : downloaded.contentType, size: uploaded.bytes, width: uploaded.width, height: uploaded.height, source: 'SCRAPED_PRODUCT', createdAt: uploaded.created_at ? new Date(uploaded.created_at) : new Date() });
        } catch (error) {
            const code = error instanceof ExternalImageError ? error.code : 'UNAVAILABLE';
            console.warn(`Product image mirroring skipped: ${code}`);
            if (code === 'UNAVAILABLE') images.push(sourceUrl);
            imports.push({ sourceUrl: provenanceUrl(sourceUrl), status: 'external_fallback', errorCode: code });
        }
    }
    return { images, imports };
}
