import { Router } from 'express';
import { generateSignature } from '../services/cloudinary.service';

const router = Router();

// Get upload signature (Protected?)
// Ideally should be protected by admin auth
router.get('/upload/signature', (req, res) => {
    try {
        const { folder } = req.query;
        const sig = generateSignature(folder as string || 'edutechs');
        res.json(sig);
    } catch (error) {
        console.error('Error generating signature:', error);
        const unavailable = error instanceof Error && error.message === 'Cloudinary is not configured';
        res.status(unavailable ? 503 : 500).json({
            error: unavailable ? 'Image uploads are not configured' : 'Failed to generate signature',
        });
    }
});

export default router;
