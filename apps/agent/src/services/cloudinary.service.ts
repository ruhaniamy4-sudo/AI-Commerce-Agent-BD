import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

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

export const generateSignature = (folder: string = 'edutechs') => {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
        {
            timestamp,
            folder,
        },
        apiSecret
    );
    return { timestamp, signature, apiKey, cloudName, folder };
};

export const uploadImage = async (filePath: string, folder: string = 'edutechs') => {
    getCloudinaryConfig();
    return await cloudinary.uploader.upload(filePath, {
        folder,
    });
};

export const uploadImageBuffer = async (buffer: Buffer, folder: string, publicId: string) => {
    getCloudinaryConfig();
    return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, public_id: publicId, overwrite: true, resource_type: 'image' },
            (error, result) => {
                if (error || !result?.secure_url) return reject(error || new Error('Managed image upload failed'));
                resolve({ secure_url: result.secure_url, public_id: result.public_id });
            }
        );
        stream.end(buffer);
    });
};
