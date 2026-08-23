import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthenticatedRequest, authorize, requireAdministrator } from '../auth/middleware';
import { hashPassword, verifyPassword } from '../auth/password';
import { signAccessToken } from '../auth/token';
import { Business } from '../models/Business';
import { BusinessMember } from '../models/BusinessMember';
import { User } from '../models/User';
import { BusinessChannel } from '../models/BusinessChannel';
import { BUSINESS_ROLES } from '../tenancy/context';

const router = Router();

router.post('/login', async (req, res) => {
    const { email, password, businessId } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: String(email).toLowerCase(), status: 'active' }).select('+passwordHash');
    if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const membershipQuery: Record<string, unknown> = { userId: user._id, status: 'active' };
    if (businessId) membershipQuery.businessId = businessId;
    const memberships = await BusinessMember.find(membershipQuery).limit(2).lean();
    if (!businessId && memberships.length > 1) {
        return res.status(409).json({ error: 'businessId is required for users with multiple memberships' });
    }
    const membership = memberships[0];
    if (!membership) return res.status(403).json({ error: 'No active business membership' });

    const business = await Business.findOne({ _id: membership.businessId, status: 'active' }).lean();
    if (!business) return res.status(403).json({ error: 'Business is not active' });

    const accessToken = signAccessToken({
        sub: user._id.toString(),
        businessId: membership.businessId.toString(),
        membershipId: membership._id.toString(),
        role: membership.role,
    });
    res.json({
        accessToken,
        user: { id: user._id, name: user.name, email: user.email },
        business: { id: business._id, name: business.name, slug: business.slug },
        role: membership.role,
    });
});

router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
    res.json(req.auth);
});

router.get('/business', authenticate, async (req: AuthenticatedRequest, res) => {
    const business = await Business.findById(req.auth!.businessId).lean();
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(business);
});

router.patch('/business', authenticate, authorize('Owner'), async (req: AuthenticatedRequest, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Business name is required' });
    const business = await Business.findByIdAndUpdate(
        req.auth!.businessId,
        { $set: { name: String(name).trim() } },
        { new: true, runValidators: true }
    );
    res.json(business);
});

router.get('/members', authenticate, requireAdministrator, async (req: AuthenticatedRequest, res) => {
    const members = await BusinessMember.find({ businessId: req.auth!.businessId })
        .populate('userId', 'name email status')
        .sort({ createdAt: 1 })
        .lean();
    res.json(members);
});

router.post('/members', authenticate, authorize('Owner'), async (req: AuthenticatedRequest, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password || !BUSINESS_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Name, email, password, and a valid role are required' });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        user = await User.create({
            name,
            email: normalizedEmail,
            passwordHash: await hashPassword(String(password)),
            status: 'active',
        });
    }
    const membership = await BusinessMember.findOneAndUpdate(
        { businessId: req.auth!.businessId, userId: user._id },
        { $set: { role, status: 'active' } },
        { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(membership);
});

router.patch('/members/:id', authenticate, authorize('Owner'), async (req: AuthenticatedRequest, res) => {
    const updates: Record<string, unknown> = {};
    if (req.body.role) {
        if (!BUSINESS_ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
        updates.role = req.body.role;
    }
    if (req.body.status) {
        if (!['active', 'disabled'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
        updates.status = req.body.status;
    }
    const current = await BusinessMember.findOne({
        _id: req.params.id,
        businessId: req.auth!.businessId,
    }).lean();
    if (!current) return res.status(404).json({ error: 'Membership not found' });
    const removesOwner = current.role === 'Owner' &&
        (updates.role && updates.role !== 'Owner' || updates.status === 'disabled');
    if (removesOwner) {
        const ownerCount = await BusinessMember.countDocuments({
            businessId: req.auth!.businessId,
            role: 'Owner',
            status: 'active',
        });
        if (ownerCount <= 1) return res.status(409).json({ error: 'A business must retain an active Owner' });
    }
    const membership = await BusinessMember.findOneAndUpdate(
        { _id: req.params.id, businessId: req.auth!.businessId },
        { $set: updates },
        { new: true, runValidators: true }
    );
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    res.json(membership);
});

router.get('/channels', authenticate, requireAdministrator, async (req: AuthenticatedRequest, res) => {
    const channels = await BusinessChannel.find({ businessId: req.auth!.businessId }).sort({ createdAt: 1 }).lean();
    res.json(channels);
});

router.post('/channels', authenticate, requireAdministrator, async (req: AuthenticatedRequest, res) => {
    const { platform, externalId, name } = req.body || {};
    if (!platform || !externalId || !name) return res.status(400).json({ error: 'Platform, externalId, and name are required' });
    const channel = await BusinessChannel.create({
        businessId: new mongoose.Types.ObjectId(req.auth!.businessId),
        platform,
        externalId,
        name,
        status: 'active',
    });
    res.status(201).json(channel);
});

router.patch('/channels/:id', authenticate, requireAdministrator, async (req: AuthenticatedRequest, res) => {
    const { businessId: _ignoredBusinessId, ...updates } = req.body;
    const channel = await BusinessChannel.findOneAndUpdate(
        { _id: req.params.id, businessId: req.auth!.businessId },
        { $set: updates },
        { new: true, runValidators: true }
    );
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
});

export default router;
