import { Router } from 'express';
import multer from 'multer';
import { AuthenticatedRequest } from '../auth/middleware';
import { MAX_IMAGE_BYTES, MediaSource, MediaStorageError, storeUploadedImage, SUPPORTED_IMAGE_TYPES } from '../services/media-storage.service';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_req, file, done) => done(null, SUPPORTED_IMAGE_TYPES.has(file.mimetype)),
});

const purposes: Record<string, MediaSource> = {
    products: 'PRODUCT_UPLOAD', product: 'PRODUCT_UPLOAD',
    'training-review': 'TRAINING_REVIEW',
    'test-ai': 'TEST_AI', 'chat-tests': 'TEST_AI',
};

router.post('/upload/image', upload.single('file'), async (req: AuthenticatedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a supported JPG, PNG, WebP, GIF, or AVIF image' });
    const source = purposes[String(req.body?.purpose || 'products')];
    if (!source) return res.status(400).json({ error: 'This image upload purpose is not supported' });
    try {
        const media = await storeUploadedImage({ businessId: req.auth!.businessId, buffer: req.file.buffer, mimeType: req.file.mimetype, filename: req.file.originalname, source });
        res.status(201).json({ url: media.secureUrl, media });
    } catch (error) {
        const status = error instanceof MediaStorageError && error.code === 'NOT_CONFIGURED' ? 503 : error instanceof MediaStorageError && error.code === 'INVALID_IMAGE' ? 400 : 502;
        res.status(status).json({ error: error instanceof Error ? error.message : 'The image could not be stored' });
    }
});

router.use((error: unknown, _req: AuthenticatedRequest, res: any, next: (error?: unknown) => void) => {
    if (!(error instanceof multer.MulterError)) return next(error);
    res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 8 MB or smaller' : 'The image upload could not be processed' });
});

export default router;
