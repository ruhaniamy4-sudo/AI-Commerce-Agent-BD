import crypto from 'node:crypto';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Product } from '../models/Product';
import { assertTenantBusinessId } from '../tenancy/context';
import { cloudinaryPublicIdFromUrl, deleteCloudinaryImage, getCloudinaryImage, isCloudinaryConfigured, listCloudinaryImages, uploadImageBuffer } from './cloudinary.service';
import { fetchPublicImage } from './ingestion/external-image.service';

export const MAX_IMAGE_BYTES = 8_000_000;
export const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
export type MediaSource = 'PRODUCT_UPLOAD'|'TRAINING_REVIEW'|'TEST_AI'|'WEB_CHAT'|'FACEBOOK'|'SCRAPED_PRODUCT';

export interface StoredMediaReference {
    provider: 'cloudinary';
    providerAssetId: string;
    secureUrl: string;
    resourceType: 'image';
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    source: MediaSource;
    originalUrl?: string;
    originalFilename?: string;
    conversationId?: string;
    messageId?: string;
    createdAt: Date;
    retention: 'persistent'|'temporary';
    expiresAt?: Date;
    retentionStatus: 'active'|'deleted';
}

export class MediaStorageError extends Error {
    constructor(message: string, public code: 'NOT_CONFIGURED'|'INVALID_IMAGE'|'UNSAFE_URL'|'UPLOAD_FAILED') { super(message); this.name = 'MediaStorageError'; }
}

export function safeImageFilename(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'image';
}

export function hasSupportedImageSignature(buffer: Buffer, contentType: string) {
    if (contentType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (contentType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (contentType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
    if (contentType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (contentType === 'image/avif') return buffer.length >= 12 && buffer.subarray(4, 12).toString('ascii').includes('ftypavif');
    return false;
}

function requireStorage() {
    if (!isCloudinaryConfigured()) throw new MediaStorageError('Image storage is not configured', 'NOT_CONFIGURED');
}

function retention(source: MediaSource) {
    const temporary = ['TEST_AI','WEB_CHAT','FACEBOOK'].includes(source);
    const days = Math.max(1, Number.parseInt(process.env.CUSTOMER_MEDIA_RETENTION_DAYS || '30', 10) || 30);
    return { retention: temporary ? 'temporary' as const : 'persistent' as const, ...(temporary ? { expiresAt: new Date(Date.now() + days * 86_400_000) } : {}) };
}

function safeOriginalUrl(value?: string) {
    if (!value) return undefined;
    try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString(); }
    catch { return undefined; }
}

function fromCloudinary(result: any, params: { source: MediaSource; originalUrl?: string; originalFilename?: string; conversationId?: string; messageId?: string }): StoredMediaReference {
    return {
        provider: 'cloudinary', providerAssetId: result.public_id, secureUrl: result.secure_url,
        resourceType: 'image', mimeType: result.format ? `image/${result.format === 'jpg' ? 'jpeg' : result.format}` : undefined,
        size: result.bytes, width: result.width, height: result.height, source: params.source,
        originalUrl: safeOriginalUrl(params.originalUrl), originalFilename: params.originalFilename,
        conversationId: params.conversationId, messageId: params.messageId,
        createdAt: result.created_at ? new Date(result.created_at) : new Date(), ...retention(params.source), retentionStatus: 'active',
    };
}

export async function storeUploadedImage(params: { businessId: string; buffer: Buffer; mimeType: string; filename: string; source: MediaSource; conversationId?: string; messageId?: string }) {
    const businessId = assertTenantBusinessId(params.businessId, 'media.upload');
    requireStorage();
    if (!SUPPORTED_IMAGE_TYPES.has(params.mimeType) || params.buffer.length > MAX_IMAGE_BYTES || !hasSupportedImageSignature(params.buffer, params.mimeType)) throw new MediaStorageError('The uploaded file is not a supported image', 'INVALID_IMAGE');
    const scope = params.source === 'TRAINING_REVIEW' ? 'products/training-review'
        : params.source === 'PRODUCT_UPLOAD' || params.source === 'SCRAPED_PRODUCT' ? 'products/uploads'
        : `customers/${params.source.toLowerCase().replace('_', '-')}`;
    const publicId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    try {
        const result = await uploadImageBuffer(params.buffer, `sellpilot/${businessId}/${scope}`, publicId);
        return fromCloudinary(result, { source: params.source, originalFilename: safeImageFilename(params.filename), conversationId: params.conversationId, messageId: params.messageId });
    } catch (error) {
        if (error instanceof MediaStorageError) throw error;
        throw new MediaStorageError('The image could not be stored', 'UPLOAD_FAILED');
    }
}

export async function resolveOwnedMediaUrl(params: { businessId: string; url: string; source: MediaSource; conversationId?: string; messageId?: string }) {
    const businessId = assertTenantBusinessId(params.businessId, 'media.resolve');
    requireStorage();
    const publicId = cloudinaryPublicIdFromUrl(params.url);
    if (!publicId || !publicId.startsWith(`sellpilot/${businessId}/`)) return undefined;
    try {
        return fromCloudinary(await getCloudinaryImage(publicId), { source: params.source, originalUrl: params.url, conversationId: params.conversationId, messageId: params.messageId });
    } catch { throw new MediaStorageError('The stored image could not be verified', 'UPLOAD_FAILED'); }
}

export async function persistConversationImage(params: { businessId: string; url: string; source: 'TEST_AI'|'WEB_CHAT'|'FACEBOOK'; conversationId: string; messageId: string }) {
    const owned = await resolveOwnedMediaUrl(params);
    if (owned) return owned;
    let downloaded;
    try { downloaded = await fetchPublicImage(params.url); }
    catch { throw new MediaStorageError('The image URL is not a safe, supported public image', 'UNSAFE_URL'); }
    const stored = await storeUploadedImage({ businessId: params.businessId, buffer: downloaded.buffer, mimeType: downloaded.contentType, filename: new URL(downloaded.url).pathname.split('/').pop() || 'image', source: params.source, conversationId: params.conversationId, messageId: params.messageId });
    stored.originalUrl = safeOriginalUrl(downloaded.url);
    return stored;
}

export async function cleanupExpiredCustomerMedia(businessIdValue: string, now = new Date()) {
    const businessId = assertTenantBusinessId(businessIdValue, 'media.cleanup');
    const messages = await Message.find({ 'attachments.expiresAt': { $lte: now }, 'attachments.retentionStatus': { $ne: 'deleted' } }).limit(200);
    let deleted = 0; let skipped = 0;
    for (const message of messages) {
        const activeConversation = await Conversation.exists({ conversationId: message.conversationId, status: 'active' });
        if (activeConversation) { skipped += 1; continue; }
        for (const attachment of (message.attachments || []) as any[]) {
            if (!attachment.providerAssetId || !attachment.expiresAt || new Date(attachment.expiresAt) > now || attachment.retentionStatus === 'deleted') continue;
            const referencedProduct = await Product.exists({ $or: [{ images: attachment.url }, { 'imageImports.providerAssetId': attachment.providerAssetId }] });
            if (referencedProduct) { skipped += 1; continue; }
            await deleteCloudinaryImage(attachment.providerAssetId);
            attachment.url = undefined; attachment.retentionStatus = 'deleted'; deleted += 1;
        }
        await message.save();
    }
    const days = Math.max(1, Number.parseInt(process.env.CUSTOMER_MEDIA_RETENTION_DAYS || '30', 10) || 30);
    const orphanCutoff = new Date(now.getTime() - days * 86_400_000);
    let cursor: string | undefined;
    do {
        const page = await listCloudinaryImages(`sellpilot/${businessId}/customers`, cursor);
        for (const resource of page.resources || []) {
            if (!resource.public_id || !resource.created_at || new Date(resource.created_at) > orphanCutoff) continue;
            const [messageReference, productReference, conversationReference] = await Promise.all([
                Message.exists({ attachments: { $elemMatch: { providerAssetId: resource.public_id, retentionStatus: { $ne: 'deleted' } } } }),
                Product.exists({ 'imageImports.providerAssetId': resource.public_id }),
                Conversation.exists({ 'imageContext.media.providerAssetId': resource.public_id, 'imageContext.media.retentionStatus': { $ne: 'deleted' } }),
            ]);
            if (messageReference || productReference || conversationReference) { skipped += 1; continue; }
            await deleteCloudinaryImage(resource.public_id); deleted += 1;
        }
        cursor = page.next_cursor;
    } while (cursor);
    return { deleted, skipped };
}

export async function cleanupDetachedProductMedia(businessIdValue: string, productId: string, removedAssets: Array<{ providerAssetId?: string }>) {
    const businessId = assertTenantBusinessId(businessIdValue, 'media.productCleanup');
    let deleted = 0;
    for (const asset of removedAssets) {
        if (!asset.providerAssetId?.startsWith(`sellpilot/${businessId}/products/`)) continue;
        const [productReference, messageReference, conversationReference] = await Promise.all([
            Product.exists({ _id: { $ne: productId }, 'imageImports.providerAssetId': asset.providerAssetId }),
            Message.exists({ attachments: { $elemMatch: { providerAssetId: asset.providerAssetId, retentionStatus: { $ne: 'deleted' } } } }),
            Conversation.exists({ 'imageContext.media.providerAssetId': asset.providerAssetId, 'imageContext.media.retentionStatus': { $ne: 'deleted' } }),
        ]);
        if (productReference || messageReference || conversationReference) continue;
        await deleteCloudinaryImage(asset.providerAssetId); deleted += 1;
    }
    return { deleted };
}
