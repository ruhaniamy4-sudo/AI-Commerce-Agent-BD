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
    return { timestamp, signature, apiKey, cloudName };
};

export const uploadImage = async (filePath: string, folder: string = 'edutechs') => {
    getCloudinaryConfig();
    return await cloudinary.uploader.upload(filePath, {
        folder,
    });
};
