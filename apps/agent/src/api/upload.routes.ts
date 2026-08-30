import { Router } from 'express';
import { generateSignature } from '../services/cloudinary.service';
import { AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// Get upload signature (Protected?)
// Ideally should be protected by admin auth
router.get('/upload/signature', (req: AuthenticatedRequest, res) => {
    try {
        const requestedFolder = String(req.query.folder || 'products').replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 60) || 'products';
        const folder = `sellpilot/${req.auth!.businessId}/${requestedFolder}`;
        const sig = generateSignature(folder);
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
