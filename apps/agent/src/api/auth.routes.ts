import { Request, Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, authenticateAccount, AccountAuthenticatedRequest, AuthenticatedRequest, authorize, requireAdministrator } from '../auth/middleware';
import { hashPassword, passwordValidationError, verifyPassword } from '../auth/password';
import { signAccessToken, signAccountToken } from '../auth/token';
import { Business } from '../models/Business';
import { BusinessMember } from '../models/BusinessMember';
import { User } from '../models/User';
import { BusinessChannel } from '../models/BusinessChannel';
import { BUSINESS_ROLES } from '../tenancy/context';
import { authRateLimit } from '../auth/rate-limit';
import crypto from 'node:crypto';
import { PASSWORD_MIN_LENGTH } from '@edutechs/shared';
import { normalizeBusinessType } from '../services/adaptive-training.service';
import { createAuthSession, revokeAllUserSessions, revokeRefreshToken, rotateAuthSession, SessionMetadata } from '../auth/session';
import { issueAuthActionToken, consumeAuthActionToken } from '../auth/action-token';
import { sendPasswordResetEmail, sendVerificationEmail } from '../auth/mail';
import { ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS, MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS } from '@edutechs/shared';
import { AuthSession } from '../models/AuthSession';
import { getEmailConfiguration } from '../services/notification.service';

const router = Router();

const limited = authRateLimit();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown) { return String(value || '').trim().toLowerCase(); }
function requestMetadata(req: Request): SessionMetadata {
    return { userAgent: String(req.headers['user-agent'] || ''), ip: req.ip || req.socket.remoteAddress };
}
function verificationIsRequired() { return String(process.env.AUTH_REQUIRE_VERIFIED_EMAIL || 'true').toLowerCase() !== 'false'; }
function accessExpiry(ttlSeconds: number) { return new Date(Date.now() + ttlSeconds * 1000).toISOString(); }
function publicUser(user: { _id: unknown; name: string; email: string; emailVerified?: boolean; emailVerifiedAt?: Date }) {
    return { id: user._id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerified), emailVerifiedAt: user.emailVerifiedAt || null };
}

async function accountSession(user: { _id: mongoose.Types.ObjectId; name: string; email: string; emailVerified?: boolean }, metadata: SessionMetadata) {
    const issued = await createAuthSession({ userId: user._id.toString(), type: 'account' }, metadata);
    return {
        needsOnboarding: true as const,
        accountToken: signAccountToken(user._id.toString(), issued.session._id.toString()),
        refreshToken: issued.refreshToken,
        accessTokenExpiresAt: accessExpiry(ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS),
        refreshTokenExpiresAt: issued.expiresAt.toISOString(),
        user: publicUser(user),
    };
}

async function merchantSession(
    user: { _id: mongoose.Types.ObjectId; name: string; email: string; emailVerified?: boolean },
    membership: { _id: mongoose.Types.ObjectId; businessId: mongoose.Types.ObjectId; role: typeof BUSINESS_ROLES[number] },
    business: { _id: mongoose.Types.ObjectId; name: string; slug: string; onboarding?: { completedAt?: Date } },
    metadata: SessionMetadata,
) {
    const issued = await createAuthSession({
        userId: user._id.toString(), type: 'merchant', businessId: membership.businessId.toString(),
        membershipId: membership._id.toString(), role: membership.role,
    }, metadata);
    return {
        needsOnboarding: false as const,
        accessToken: signAccessToken({
            sub: user._id.toString(), businessId: membership.businessId.toString(),
            membershipId: membership._id.toString(), role: membership.role, sid: issued.session._id.toString(),
        }),
        refreshToken: issued.refreshToken,
        accessTokenExpiresAt: accessExpiry(MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS),
        refreshTokenExpiresAt: issued.expiresAt.toISOString(),
        user: publicUser(user),
        business: { id: business._id, name: business.name, slug: business.slug, onboardingComplete: Boolean(business.onboarding?.completedAt) },
        role: membership.role,
    };
}

async function sessionForUser(user: { _id: mongoose.Types.ObjectId; name: string; email: string; emailVerified?: boolean }, metadata: SessionMetadata, requestedBusinessId?: string) {
    if (verificationIsRequired() && !user.emailVerified) return { verificationRequired: true as const, user: publicUser(user) };
    const membershipQuery: Record<string, unknown> = { userId: user._id, status: 'active' };
    if (requestedBusinessId) membershipQuery.businessId = requestedBusinessId;
    const memberships = await BusinessMember.find(membershipQuery).limit(2).lean();
    if (!requestedBusinessId && memberships.length > 1) return { conflict: true as const };
    const membership = memberships[0];
    if (!membership) return accountSession(user, metadata);
    const business = await Business.findOne({ _id: membership.businessId, status: 'active' }).lean();
    if (!business) return { forbidden: true as const };
    return merchantSession(user, membership as any, business as any, metadata);
}

router.post('/signup', limited, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const passwordError = passwordValidationError(password, [name, email.split('@')[0]]);
    if (name.length < 2 || name.length > 120 || !emailPattern.test(email) || passwordError) {
        return res.status(400).json({ error: passwordError || `Enter a valid name, email, and password of at least ${PASSWORD_MIN_LENGTH} characters` });
    }
    try {
        const user = await User.create({ name, email, passwordHash: await hashPassword(password), status: 'active', emailVerified: false });
        const verification = await issueAuthActionToken(user._id.toString(), 'email_verification');
        const verificationEmailSent = await sendVerificationEmail(user.email, verification.token);
        if (verificationEmailSent) await User.updateOne({ _id: user._id }, { $set: { verificationEmailLastSentAt: new Date() } });
        if (verificationIsRequired()) return res.status(201).json({ needsOnboarding: true, verificationRequired: true, verificationEmailSent, user: publicUser(user) });
        return res.status(201).json({ ...(await accountSession(user, requestMetadata(req))), verificationEmailSent });
    } catch (error: any) {
        if (error?.code === 11000) return res.status(409).json({ error: 'An account with this email already exists' });
        throw error;
    }
});

router.post('/login', limited, async (req, res) => {
    const { email, password, businessId } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail, status: 'active' }).select('+passwordHash +failedLoginAttempts +lockedUntil');
    const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
    const dummyHash = 'scrypt$AQEBAQEBAQEBAQEBAQEBAQ$iXsU78TTkxXslqQiAizBFyhJ8xpNZx6zZmeVM50aAxhqonxpkVTsT1yPDY7DiLQLcXYj5JARkwzOdbrzKB5_Uw';
    const passwordMatches = await verifyPassword(String(password), user?.passwordHash || dummyHash);
    if (!user || locked || !user.passwordHash || !passwordMatches) {
        if (user && !locked) {
            const failures = (user.failedLoginAttempts || 0) + 1;
            await User.updateOne(
                { _id: user._id },
                { $set: { failedLoginAttempts: failures, ...(failures >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}) } }
            );
        }
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.failedLoginAttempts || user.lockedUntil) await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } });
    const result = await sessionForUser(user, requestMetadata(req), businessId);
    if ('conflict' in result) {
        return res.status(409).json({ error: 'businessId is required for users with multiple memberships' });
    }
    if ('forbidden' in result) return res.status(403).json({ error: 'Business is not active' });
    return res.json(result);
});

router.post('/oauth/exchange', limited, async (req, res) => {
    const configured = process.env.OAUTH_INTERNAL_SECRET || '';
    const supplied = String(req.headers['x-oauth-internal-secret'] || '');
    const validSecret = configured.length >= 32 && supplied.length === configured.length &&
        crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
    if (!validSecret) return res.status(401).json({ error: 'OAuth exchange is not authorized' });
    const provider = req.body?.provider as 'google' | 'facebook';
    const accountId = String(req.body?.accountId || '').trim();
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '').trim();
    if (!['google', 'facebook'].includes(provider) || !accountId || !emailPattern.test(email) || !name) {
        return res.status(400).json({ error: 'Valid OAuth identity is required' });
    }
    let user = await User.findOne({ providerAccounts: { $elemMatch: { provider, accountId } } });
    if (!user) {
        user = await User.findOneAndUpdate(
            { email },
            { $setOnInsert: { name, email, status: 'active' }, $set: { emailVerified: true }, $addToSet: { providerAccounts: { provider, accountId } } },
            { upsert: true, new: true, runValidators: true }
        );
    }
    if (!user || user.status !== 'active') return res.status(403).json({ error: 'Account is unavailable' });
    if (!user.emailVerifiedAt) {
        const verifiedAt = new Date();
        await User.updateOne(
            { _id: user._id, emailVerifiedAt: null },
            { $set: { emailVerified: true, emailVerifiedAt: verifiedAt, emailVerificationMethod: 'oauth' } }
        );
        user.emailVerified = true;
        user.emailVerifiedAt = verifiedAt;
        user.emailVerificationMethod = 'oauth';
    }
    const result = await sessionForUser(user, requestMetadata(req));
    if ('conflict' in result) return res.status(409).json({ error: 'Choose a business using email sign in' });
    if ('forbidden' in result) return res.status(403).json({ error: 'Business is not active' });
    return res.json(result);
});

router.post('/refresh', authRateLimit({ limit: 40, windowMs: 15 * 60 * 1000 }), async (req, res) => {
    const refreshToken = String(req.body?.refreshToken || '');
    if (!refreshToken || refreshToken.length > 200) return res.status(401).json({ error: 'Refresh token is invalid or expired' });
    const rotated = await rotateAuthSession(refreshToken, requestMetadata(req));
    if (!rotated) return res.status(401).json({ error: 'Refresh token is invalid or expired' });
    const user = await User.findOne({ _id: rotated.session.userId, status: 'active' }).lean();
    if (!user || verificationIsRequired() && !user.emailVerified) {
        await revokeRefreshToken(rotated.refreshToken, 'account_unavailable');
        return res.status(401).json({ error: 'Account is unavailable' });
    }
    const base = {
        refreshToken: rotated.refreshToken,
        refreshTokenExpiresAt: rotated.expiresAt.toISOString(),
        user: publicUser(user),
    };
    if (rotated.session.type === 'account') {
        return res.json({
            ...base,
            needsOnboarding: true,
            accountToken: signAccountToken(user._id.toString(), rotated.session._id.toString()),
            accessTokenExpiresAt: accessExpiry(ACCOUNT_ACCESS_TOKEN_MAX_AGE_SECONDS),
        });
    }
    const membership = await BusinessMember.findOne({
        _id: rotated.session.membershipId,
        userId: user._id,
        businessId: rotated.session.businessId,
        role: rotated.session.role,
        status: 'active',
    }).lean();
    const business = membership ? await Business.findOne({ _id: membership.businessId, status: 'active' }).lean() : null;
    if (!membership || !business) {
        await revokeRefreshToken(rotated.refreshToken, 'membership_unavailable');
        return res.status(401).json({ error: 'Session is no longer available' });
    }
    return res.json({
        ...base,
        needsOnboarding: false,
        accessToken: signAccessToken({
            sub: user._id.toString(), businessId: membership.businessId.toString(),
            membershipId: membership._id.toString(), role: membership.role, sid: rotated.session._id.toString(),
        }),
        accessTokenExpiresAt: accessExpiry(MERCHANT_ACCESS_TOKEN_MAX_AGE_SECONDS),
        business: { id: business._id, name: business.name, slug: business.slug, onboardingComplete: Boolean(business.onboarding?.completedAt) },
        role: membership.role,
    });
});

router.post('/logout', async (req, res) => {
    await revokeRefreshToken(String(req.body?.refreshToken || ''), 'logout');
    return res.status(204).send();
});

router.post('/email-verification/request', limited, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const user = emailPattern.test(email) ? await User.findOne({ email, status: 'active' }).lean() : null;
    if (user && !user.emailVerified) {
        const issued = await issueAuthActionToken(user._id.toString(), 'email_verification');
        if (await sendVerificationEmail(user.email, issued.token)) {
            await User.updateOne({ _id: user._id }, { $set: { verificationEmailLastSentAt: new Date() } });
        }
    }
    return res.status(202).json({
        message: 'If verification is available for this account, an email has been sent.',
        emailDeliveryConfigured: getEmailConfiguration().configured,
    });
});

router.post('/email-verification/confirm', limited, async (req, res) => {
    const record = await consumeAuthActionToken(String(req.body?.token || ''), 'email_verification');
    if (!record) return res.status(400).json({ error: 'Verification link is invalid or expired' });
    const emailVerifiedAt = new Date();
    const update = await User.updateOne(
        { _id: record.userId, status: 'active' },
        { $set: { emailVerified: true, emailVerifiedAt, emailVerificationMethod: 'email_link' } }
    );
    if (update.matchedCount === 0) return res.status(400).json({ error: 'Verification link is invalid or expired' });
    return res.json({ verified: true, emailVerifiedAt: emailVerifiedAt.toISOString() });
});

router.post('/password-reset/request', limited, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const user = emailPattern.test(email) ? await User.findOne({ email, status: 'active', emailVerified: true }).lean() : null;
    if (user) {
        const issued = await issueAuthActionToken(user._id.toString(), 'password_reset');
        if (await sendPasswordResetEmail(user.email, issued.token)) {
            await User.updateOne({ _id: user._id }, { $set: { passwordResetEmailLastSentAt: new Date() } });
        }
    }
    return res.status(202).json({
        message: 'If an account exists for this verified email, a reset link has been sent.',
        emailDeliveryConfigured: getEmailConfiguration().configured,
    });
});

router.post('/password-reset/confirm', limited, async (req, res) => {
    const password = String(req.body?.password || '');
    const passwordError = passwordValidationError(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const record = await consumeAuthActionToken(String(req.body?.token || ''), 'password_reset');
    if (!record) return res.status(400).json({ error: 'Password reset link is invalid or expired' });
    await User.updateOne(
        { _id: record.userId, status: 'active' },
        { $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } }
    );
    await revokeAllUserSessions(record.userId.toString(), 'password_reset');
    return res.json({ passwordReset: true });
});

router.post('/password/change', authenticate, async (req: AuthenticatedRequest, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const user = await User.findOne({ _id: req.auth!.userId, status: 'active' }).select('+passwordHash');
    if (!user?.passwordHash || !await verifyPassword(currentPassword, user.passwordHash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const error = passwordValidationError(newPassword, [user.name, user.email.split('@')[0]]);
    if (error) return res.status(400).json({ error });
    if (await verifyPassword(newPassword, user.passwordHash)) return res.status(400).json({ error: 'New password must be different from the current password' });
    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();
    await revokeAllUserSessions(user._id.toString(), 'password_changed');
    return res.json({ passwordChanged: true, allSessionsRevoked: true });
});

router.get('/sessions', authenticate, async (req: AuthenticatedRequest, res) => {
    const sessions = await AuthSession.find({ userId: req.auth!.userId, expiresAt: { $gt: new Date() } })
        .select('type businessId userAgent createdAt lastUsedAt expiresAt revokedAt revokeReason')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    return res.json(sessions.map((session) => ({
        id: session._id,
        type: session.type,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        current: session._id.toString() === req.auth!.sessionId,
    })));
});

router.delete('/sessions/:id', authenticate, async (req: AuthenticatedRequest, res) => {
    const sessionId = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return res.status(404).json({ error: 'Session not found' });
    const result = await AuthSession.updateOne(
        { _id: sessionId, userId: req.auth!.userId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: 'user_revoked' } }
    );
    if (!result.modifiedCount) return res.status(404).json({ error: 'Session not found' });
    return res.status(204).send();
});

router.post('/business', authenticateAccount, async (req: AccountAuthenticatedRequest, res) => {
    const user = await User.findOne({ _id: req.account!.userId, status: 'active' });
    if (!user) return res.status(401).json({ error: 'Account is unavailable' });
    if (verificationIsRequired() && !user.emailVerified) return res.status(403).json({ error: 'Verify your email before creating a business' });
    const existingMembership = await BusinessMember.findOne({ userId: user._id, status: 'active' }).lean();
    if (existingMembership) {
        const result = await sessionForUser(user, requestMetadata(req), existingMembership.businessId.toString());
        return res.json(result);
    }
    const name = String(req.body?.name || '').trim();
    const businessType = normalizeBusinessType(req.body?.businessType);
    const description = String(req.body?.description || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const website = String(req.body?.website || '').trim();
    const preferredLanguage = req.body?.preferredLanguage === 'en' ? 'en' : 'bn';
    if (name.length < 2 || name.length > 160 || !businessType || (phone.length > 0 && phone.length < 7) || phone.length > 30 || website.length > 300 || description.length > 1000) {
        return res.status(400).json({ error: 'Valid business name and type are required' });
    }
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) || 'business';
    const slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    let business: InstanceType<typeof Business> | undefined;
    try {
        business = await Business.create({ name, slug, businessType, businessTypeStatus: 'confirmed', description: description || undefined, phone: phone || undefined, website: website || undefined, preferredLanguage, currency: 'BDT', status: 'active' });
        const membership = await BusinessMember.create({ businessId: business._id, userId: user._id, role: 'Owner', status: 'active' });
        return res.status(201).json(await merchantSession(user, membership as any, business as any, requestMetadata(req)));
    } catch (error) {
        if (business?._id) await Business.deleteOne({ _id: business._id });
        throw error;
    }
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
    const allowed = ['name', 'businessType', 'phone', 'website', 'preferredLanguage'] as const;
    const updates: Record<string, string> = {};
    for (const field of allowed) if (req.body?.[field] !== undefined) updates[field] = String(req.body[field]).trim();
    if (!updates.name || updates.name.length < 2 || updates.name.length > 160) return res.status(400).json({ error: 'A valid business name is required' });
    if (updates.businessType && updates.businessType.length > 120 || updates.phone && updates.phone.length > 30 || updates.website && updates.website.length > 300) return res.status(400).json({ error: 'Business profile fields are too long' });
    if (updates.preferredLanguage && !['bn', 'en'].includes(updates.preferredLanguage)) return res.status(400).json({ error: 'Preferred language must be bn or en' });
    if (updates.businessType) {
        const normalized = normalizeBusinessType(updates.businessType);
        if (!normalized) return res.status(400).json({ error: 'Choose a supported business type' });
        updates.businessType = normalized;
    }
    const business = await Business.findByIdAndUpdate(
        req.auth!.businessId,
        { $set: { ...updates, ...(updates.businessType ? { businessTypeStatus: 'confirmed' } : {}) } },
        { new: true, runValidators: true }
    );
    res.json(business);
});

router.patch('/business/brand-voice', authenticate, authorize('Owner'), async (req: AuthenticatedRequest, res) => {
    const input = req.body || {};
    const allowed = {
        tone: ['friendly', 'professional', 'casual', 'premium', 'custom'],
        replyLength: ['short', 'balanced', 'detailed'],
        language: ['auto', 'bn', 'en', 'banglish'],
        salesBehavior: ['helpful', 'balanced', 'sales_focused'],
        emoji: ['none', 'light', 'normal'],
    } as const;
    const updates: Record<string, unknown> = {};
    for (const [field, values] of Object.entries(allowed)) {
        if (input[field] !== undefined) {
            if (!(values as readonly string[]).includes(String(input[field]))) return res.status(400).json({ error: `Invalid ${field} setting` });
            updates[`brandVoice.${field}`] = input[field];
        }
    }
    if (input.customTone !== undefined) updates['brandVoice.customTone'] = String(input.customTone).trim().slice(0, 300);
    if (input.examples !== undefined) {
        if (!Array.isArray(input.examples)) return res.status(400).json({ error: 'Examples must be a list' });
        updates['brandVoice.examples'] = input.examples.map((example: unknown) => String(example).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-10).map((example: string) => example.slice(0, 1000));
    }
    const business = await Business.findByIdAndUpdate(req.auth!.businessId, { $set: updates }, { new: true, runValidators: true });
    if (!business) return res.status(404).json({ error: 'Business not found' });
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
    const normalizedName = String(name || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const memberPasswordError = passwordValidationError(String(password || ''), [normalizedName, normalizedEmail.split('@')[0]]);
    if (normalizedName.length < 2 || normalizedName.length > 120 || !emailPattern.test(normalizedEmail) || memberPasswordError || !BUSINESS_ROLES.includes(role)) {
        return res.status(400).json({ error: memberPasswordError || `Valid name, email, password of at least ${PASSWORD_MIN_LENGTH} characters, and role are required` });
    }
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        user = await User.create({
            name: normalizedName,
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
    if (platform === 'facebook') return res.status(400).json({ error: 'Facebook Pages must be connected through Meta authorization' });
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
    const current = await BusinessChannel.findOne({ _id: req.params.id, businessId: req.auth!.businessId }).select('platform').lean();
    if (!current) return res.status(404).json({ error: 'Channel not found' });
    const updates: Record<string, unknown> = {};
    if (req.body?.name !== undefined) updates.name = String(req.body.name).trim().slice(0, 160);
    if (req.body?.status !== undefined) {
        if (!['active', 'disabled'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid channel status' });
        updates.status = req.body.status;
    }
    const channel = await BusinessChannel.findOneAndUpdate(
        { _id: req.params.id, businessId: req.auth!.businessId },
        { $set: updates },
        { new: true, runValidators: true }
    );
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
});

export default router;
