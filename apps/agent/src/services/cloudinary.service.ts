import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import type { UploadApiResponse } from 'cloudinary';

dotenv.config();

const getCloudinaryConfig = () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary is not configured');
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    return { cloudName, apiKey, apiSecret };
};

export const isCloudinaryConfigured = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export const uploadImageBuffer = async (buffer: Buffer, folder: string, publicId: string) => {
    getCloudinaryConfig();
    return new Promise<Pick<UploadApiResponse, 'secure_url'|'public_id'|'resource_type'|'format'|'bytes'|'width'|'height'|'created_at'>>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, public_id: publicId, overwrite: true, resource_type: 'image', invalidate: true },
            (error, result) => {
                if (error || !result?.secure_url) return reject(error || new Error('Managed image upload failed'));
                resolve({ secure_url: result.secure_url, public_id: result.public_id, resource_type: result.resource_type, format: result.format, bytes: result.bytes, width: result.width, height: result.height, created_at: result.created_at });
            }
        );
        stream.end(buffer);
    });
};

export function cloudinaryPublicIdFromUrl(value: string) {
    const { cloudName } = getCloudinaryConfig();
    let url: URL;
    try { url = new URL(value); } catch { return undefined; }
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return undefined;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== cloudName || parts[1] !== 'image' || parts[2] !== 'upload') return undefined;
    let assetParts = parts.slice(3);
    if (assetParts[0] && /^v\d+$/.test(assetParts[0])) assetParts = assetParts.slice(1);
    if (!assetParts.length) return undefined;
    const last = assetParts.pop()!;
    assetParts.push(last.replace(/\.[a-z0-9]+$/i, ''));
    return decodeURIComponent(assetParts.join('/'));
}

export async function getCloudinaryImage(publicId: string) {
    getCloudinaryConfig();
    return cloudinary.api.resource(publicId, { resource_type: 'image' });
}

export async function deleteCloudinaryImage(publicId: string) {
    getCloudinaryConfig();
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
}

export async function listCloudinaryImages(prefix: string, nextCursor?: string) {
    getCloudinaryConfig();
    return cloudinary.api.resources({ resource_type: 'image', type: 'upload', prefix, max_results: 500, ...(nextCursor ? { next_cursor: nextCursor } : {}) });
}
