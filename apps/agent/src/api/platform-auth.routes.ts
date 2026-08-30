import { Router } from 'express';
import { authRateLimit } from '../auth/rate-limit';
import { verifyPassword } from '../auth/password';
import { signPlatformAdminToken } from '../auth/token';
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
    res.json({ platformToken: signPlatformAdminToken(admin._id.toString()), admin: { id: admin._id, name: admin.name, email: admin.email } });
});
export default router;
