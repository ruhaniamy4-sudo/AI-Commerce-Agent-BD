import { Router } from 'express';
import { authRateLimit } from '../auth/rate-limit';
import { verifyPassword } from '../auth/password';
import { signPlatformAdminToken, verifyPlatformAdminToken } from '../auth/token';
import { PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS, PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS } from '@edutechs/shared';
import { PlatformAdmin } from '../models/PlatformAdmin';
import { writePlatformAudit } from '../services/platform-audit.service';

const router = Router();
router.post('/login', authRateLimit({ limit: 10 }), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password || password.length > 200) return res.status(400).json({ error: 'Email and password are required' });
    const admin = await PlatformAdmin.findOne({ email, status: 'active' }).select('+passwordHash');
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
    admin.lastLoginAt = new Date();
    await admin.save();
    await writePlatformAudit({ platformAdminId: admin._id.toString(), action: 'ADMIN_LOGIN', targetType: 'platform_admin', targetId: admin._id.toString(), previousValue: null, newValue: { lastLoginAt: admin.lastLoginAt }, reason: 'Successful platform administrator login' });
    res.json({
        platformToken: signPlatformAdminToken(admin._id.toString()),
        expiresInSeconds: PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS,
        admin: { id: admin._id, name: admin.name, email: admin.email },
    });
});

/**
 * Slides an active admin's token forward so working through the day does not end
 * in a surprise sign-out. The original sign-in time rides along in the token, so
 * renewal cannot extend a session past the absolute cap, and a disabled admin is
 * refused here just as they are on every other request.
 */
router.post('/renew', authRateLimit({ limit: 60 }), async (req, res) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Platform administrator authentication required' });

    let payload;
    try {
        payload = verifyPlatformAdminToken(token);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired platform administrator session' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - payload.sst >= PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS) {
        return res.status(401).json({ error: 'Platform administrator session has reached its maximum age. Sign in again.', code: 'SESSION_MAX_AGE' });
    }
    const admin = await PlatformAdmin.findOne({ _id: payload.sub, status: 'active' }).select('_id name email').lean();
    if (!admin) return res.status(401).json({ error: 'Platform administrator session is unavailable' });

    // Never hand back a token that outlives the cap.
    const remaining = payload.sst + PLATFORM_ADMIN_SESSION_MAX_AGE_SECONDS - now;
    const ttlSeconds = Math.min(PLATFORM_ADMIN_TOKEN_MAX_AGE_SECONDS, remaining);
    res.json({
        platformToken: signPlatformAdminToken(admin._id.toString(), { ttlSeconds, sessionStartedAt: payload.sst }),
        expiresInSeconds: ttlSeconds,
        admin: { id: admin._id, name: admin.name, email: admin.email },
    });
});

export default router;
