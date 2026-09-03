import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../auth.routes';
import { clearAuthRateLimitsForTests } from '../../auth/rate-limit';
import { hashPassword } from '../../auth/password';
import { User } from '../../models/User';
import { Business } from '../../models/Business';
import { BusinessMember } from '../../models/BusinessMember';
import { signAccessToken, signAccountToken } from '../../auth/token';
import { MerchantActivity } from '../../models/MerchantActivity';
import { AuthSession } from '../../models/AuthSession';
import { AuthActionToken } from '../../models/AuthActionToken';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../auth/mail';

vi.mock('../../auth/mail', () => ({
    sendPasswordResetEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
}));

const app = express().use(express.json()).use('/auth', authRoutes);
const userId = new mongoose.Types.ObjectId();
const businessId = new mongoose.Types.ObjectId();
const membershipId = new mongoose.Types.ObjectId();

describe('merchant account and business onboarding', () => {
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'; process.env.AUTH_REQUIRE_VERIFIED_EMAIL = 'true';
        clearAuthRateLimitsForTests(); vi.restoreAllMocks();
        vi.mocked(sendVerificationEmail).mockReset().mockResolvedValue(true);
        vi.mocked(sendPasswordResetEmail).mockReset().mockResolvedValue(true);
        vi.spyOn(AuthSession, 'create').mockImplementation(async (data: any) => ({ _id: new mongoose.Types.ObjectId(), ...data }) as any);
        vi.spyOn(AuthActionToken, 'updateMany').mockResolvedValue({ acknowledged: true } as any);
        vi.spyOn(AuthActionToken, 'create').mockImplementation(async (data: any) => ({ _id: new mongoose.Types.ObjectId(), ...data }) as any);
        vi.spyOn(User, 'updateOne').mockResolvedValue({ acknowledged: true } as any);
    });

    it('normalizes signup email, hashes the password, and never returns the hash', async () => {
        const create = vi.spyOn(User, 'create').mockImplementation(async (data: any) => ({ _id: userId, ...data }) as any);
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: ' OWNER@Example.COM ', password: 'S3curePass!' }).expect(201);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: 'owner@example.com' }));
        const saved = create.mock.calls[0][0] as any;
        expect(saved.passwordHash).not.toContain('S3curePass!');
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body.needsOnboarding).toBe(true);
        expect(response.body).toMatchObject({ verificationRequired: true, verificationEmailSent: true });
        expect(response.body).not.toHaveProperty('accountToken');
        expect(response.body).not.toHaveProperty('refreshToken');
        expect(sendVerificationEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
    });

    it('rejects merchant signup passwords shorter than the configured minimum', async () => {
        const create = vi.spyOn(User, 'create');
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: 'owner@example.com', password: 'Short1!' }).expect(400);
        expect(response.body.error).toContain('at least 10 characters');
        expect(create).not.toHaveBeenCalled();
    });

    it('rejects duplicate email without exposing account data', async () => {
        vi.spyOn(User, 'create').mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: 'owner@example.com', password: 'S3curePass!' }).expect(409);
        expect(response.body).toEqual({ error: 'An account with this email already exists' });
    });

    it('logs in with the correct password and rejects the wrong password', async () => {
        const passwordHash = await hashPassword('correct password');
        const user = { _id: userId, name: 'Merchant', email: 'owner@example.com', passwordHash, status: 'active', emailVerified: true };
        vi.spyOn(User, 'findOne').mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as any);
        vi.spyOn(BusinessMember, 'find').mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as any);
        const success = await request(app).post('/auth/login').send({ email: 'OWNER@example.com', password: 'correct password' }).expect(200);
        expect(success.body.accountToken).toBeTruthy(); expect(success.body.needsOnboarding).toBe(true);
        await request(app).post('/auth/login').send({ email: 'owner@example.com', password: 'wrong password' }).expect(401);
    });

    it('creates the business and Owner membership using the account identity', async () => {
        const user = { _id: userId, name: 'Merchant', email: 'owner@example.com', status: 'active', emailVerified: true };
        vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as any);
        const createBusiness = vi.spyOn(Business, 'create').mockImplementation(async (data: any) => ({ _id: businessId, ...data }) as any);
        const createMembership = vi.spyOn(BusinessMember, 'create').mockResolvedValue({ _id: membershipId, businessId, role: 'Owner' } as any);
        const response = await request(app).post('/auth/business').set('authorization', `Bearer ${signAccountToken(userId.toString())}`).send({ name: 'My Shop', businessType: 'Fashion', phone: '01700000000', preferredLanguage: 'bn' }).expect(201);
        expect(createBusiness).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Shop', currency: 'BDT' }));
        expect(createMembership).toHaveBeenCalledWith(expect.objectContaining({ businessId, userId, role: 'Owner' }));
        expect(response.body.accessToken).toBeTruthy(); expect(response.body.role).toBe('Owner');
    });

    it('updates only the authenticated tenant brand voice with validated controls', async () => {
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId, status: 'active' }) } as any);
        vi.spyOn(User,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:userId})})} as any);vi.spyOn(Business,'findOne').mockReturnValue({select:()=>({lean:()=>Promise.resolve({_id:businessId})})} as any);vi.spyOn(MerchantActivity,'updateOne').mockResolvedValue({} as any);vi.spyOn(User,'updateOne').mockResolvedValue({} as any);
        const update = vi.spyOn(Business, 'findByIdAndUpdate').mockResolvedValue({ _id: businessId, brandVoice: { tone: 'casual' } } as any);
        const token = signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Owner' });
        await request(app).patch('/auth/business/brand-voice').set('authorization', `Bearer ${token}`).send({ tone: 'casual', language: 'banglish', examples: ['Ji, kon size lagbe?'] }).expect(200);
        expect(update).toHaveBeenCalledWith(businessId.toString(), { $set: expect.objectContaining({ 'brandVoice.tone': 'casual', 'brandVoice.language': 'banglish', 'brandVoice.examples': ['Ji, kon size lagbe?'] }) }, expect.objectContaining({ new: true }));
        await request(app).patch('/auth/business/brand-voice').set('authorization', `Bearer ${token}`).send({ tone: 'unsafe' }).expect(400);
    });

    it('requires email verification before issuing any login session', async () => {
        vi.spyOn(User, 'create').mockImplementation(async (data: any) => ({ _id: userId, ...data }) as any);
        const response = await request(app).post('/auth/signup').send({ name: 'Merchant', email: 'owner@example.com', password: 'S3curePass!' }).expect(201);
        expect(response.body).toMatchObject({ verificationRequired: true, needsOnboarding: true });
        expect(response.body).not.toHaveProperty('refreshToken');

        const passwordHash = await hashPassword('S3curePass!');
        vi.spyOn(User, 'findOne').mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: userId, name: 'Merchant', email: 'owner@example.com', passwordHash, status: 'active', emailVerified: false }) } as any);
        const login = await request(app).post('/auth/login').send({ email: 'owner@example.com', password: 'S3curePass!' }).expect(200);
        expect(login.body).toMatchObject({ verificationRequired: true });
        expect(login.body).not.toHaveProperty('accountToken');
        expect(login.body).not.toHaveProperty('accessToken');
        expect(login.body).not.toHaveProperty('refreshToken');
    });

    it('rotates an account refresh token and rejects reuse of the previous token', async () => {
        const oldSessionId = new mongoose.Types.ObjectId();
        const oldSession = { _id: oldSessionId, userId, type: 'account', expiresAt: new Date(Date.now() + 60_000) };
        const rotate = vi.spyOn(AuthSession, 'findOneAndUpdate').mockResolvedValueOnce(oldSession as any).mockResolvedValueOnce(null);
        vi.spyOn(AuthSession, 'findOne').mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) } as any);
        vi.spyOn(AuthSession, 'updateOne').mockResolvedValue({ acknowledged: true } as any);
        vi.spyOn(User, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: userId, name: 'Merchant', email: 'owner@example.com', status: 'active', emailVerified: true }) } as any);
        const first = await request(app).post('/auth/refresh').send({ refreshToken: 'valid-old-refresh-token' }).expect(200);
        expect(first.body.accountToken).toBeTruthy();
        expect(first.body.refreshToken).toBeTruthy();
        expect(first.body.refreshToken).not.toBe('valid-old-refresh-token');
        await request(app).post('/auth/refresh').send({ refreshToken: 'valid-old-refresh-token' }).expect(401);
        expect(rotate).toHaveBeenCalledTimes(2);
    });

    it('keeps password reset requests enumeration-safe and revokes sessions after reset', async () => {
        vi.spyOn(User, 'findOne').mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) } as any);
        const requestResponse = await request(app).post('/auth/password-reset/request').send({ email: 'missing@example.com' }).expect(202);
        expect(requestResponse.body.message).not.toContain('not found');
        vi.spyOn(AuthActionToken, 'findOneAndUpdate').mockResolvedValue({ userId } as any);
        const revoke = vi.spyOn(AuthSession, 'updateMany').mockResolvedValue({ acknowledged: true } as any);
        await request(app).post('/auth/password-reset/confirm').send({ token: 'one-time-reset-token', password: 'N3wSecurePass!' }).expect(200, { passwordReset: true });
        expect(revoke).toHaveBeenCalledWith(expect.objectContaining({ userId, revokedAt: null }), expect.anything());
        expect(vi.mocked(User.updateOne).mock.calls.some(([, update]: any[]) => update?.$set?.emailVerified !== undefined)).toBe(false);
    });

    it('sends password reset only for an active verified account', async () => {
        const find = vi.spyOn(User, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({ _id: userId, email: 'owner@example.com', status: 'active', emailVerified: true }),
        } as any);
        await request(app).post('/auth/password-reset/request').send({ email: 'owner@example.com' }).expect(202);
        expect(find).toHaveBeenCalledWith({ email: 'owner@example.com', status: 'active', emailVerified: true });
        expect(sendPasswordResetEmail).toHaveBeenCalledWith('owner@example.com', expect.any(String));
        expect(User.updateOne).toHaveBeenCalledWith({ _id: userId }, { $set: { passwordResetEmailLastSentAt: expect.any(Date) } });
    });

    it('confirms a one-time email verification token', async () => {
        vi.spyOn(AuthActionToken, 'findOneAndUpdate').mockResolvedValue({ userId } as any);
        const update = vi.mocked(User.updateOne);
        const response = await request(app).post('/auth/email-verification/confirm').send({ token: 'verification-token' }).expect(200);
        expect(response.body).toMatchObject({ verified: true, emailVerifiedAt: expect.any(String) });
        expect(update).toHaveBeenCalledWith(
            { _id: userId, status: 'active' },
            { $set: { emailVerified: true, emailVerifiedAt: expect.any(Date), emailVerificationMethod: 'email_link' } }
        );
    });

    describe('OAuth exchange (Google & Facebook)', () => {
        const oauthSecret = 'test-oauth-internal-secret-at-least-thirty-two-chars';

        beforeEach(() => {
            process.env.OAUTH_INTERNAL_SECRET = oauthSecret;
        });

        it('rejects exchange when x-oauth-internal-secret header is missing or incorrect', async () => {
            await request(app)
                .post('/auth/oauth/exchange')
                .send({ provider: 'google', accountId: 'g-123', email: 'merchant@example.com', name: 'Merchant' })
                .expect(401, { error: 'OAuth exchange is not authorized' });

            await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', 'wrong-secret-that-does-not-match-at-all-32')
                .send({ provider: 'google', accountId: 'g-123', email: 'merchant@example.com', name: 'Merchant' })
                .expect(401, { error: 'OAuth exchange is not authorized' });
        });

        it('authorizes a valid Google merchant with active business and returns merchant session', async () => {
            const user = { _id: userId, name: 'Merchant', email: 'merchant@example.com', status: 'active', emailVerified: true };
            vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
            vi.spyOn(BusinessMember, 'find').mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue([{ _id: membershipId, businessId, role: 'Owner', status: 'active' }]),
                }),
            } as any);
            vi.spyOn(Business, 'findOne').mockReturnValue({
                lean: vi.fn().mockResolvedValue({ _id: businessId, name: 'My Store', slug: 'my-store', status: 'active' }),
            } as any);

            const res = await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', oauthSecret)
                .send({ provider: 'google', accountId: 'g-123', email: 'merchant@example.com', name: 'Merchant' })
                .expect(200);

            expect(res.body.needsOnboarding).toBe(false);
            expect(res.body.accessToken).toBeTruthy();
            expect(res.body.business).toMatchObject({ id: businessId.toString(), name: 'My Store' });
            expect(res.body.role).toBe('Owner');
        });

        it('authorizes a valid Facebook merchant and gracefully falls back to email prefix if name is omitted', async () => {
            const user = { _id: userId, name: 'fbuser', email: 'fbuser@example.com', status: 'active', emailVerified: true };
            vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
            vi.spyOn(BusinessMember, 'find').mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue([{ _id: membershipId, businessId, role: 'Owner', status: 'active' }]),
                }),
            } as any);
            vi.spyOn(Business, 'findOne').mockReturnValue({
                lean: vi.fn().mockResolvedValue({ _id: businessId, name: 'FB Shop', slug: 'fb-shop', status: 'active' }),
            } as any);

            const res = await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', oauthSecret)
                .send({ provider: 'facebook', accountId: 'fb-456', email: 'fbuser@example.com' })
                .expect(200);

            expect(res.body.needsOnboarding).toBe(false);
            expect(res.body.accessToken).toBeTruthy();
            expect(res.body.role).toBe('Owner');
        });

        it('returns account session requiring onboarding when user has no business membership', async () => {
            const user = { _id: userId, name: 'New OAuth User', email: 'new@example.com', status: 'active', emailVerified: true };
            vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
            vi.spyOn(BusinessMember, 'find').mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue([]),
                }),
            } as any);

            const res = await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', oauthSecret)
                .send({ provider: 'google', accountId: 'g-999', email: 'new@example.com', name: 'New OAuth User' })
                .expect(200);

            expect(res.body.needsOnboarding).toBe(true);
            expect(res.body.accountToken).toBeTruthy();
            expect(res.body.accessToken).toBeUndefined();
        });

        it('rejects exchange when user account is suspended/disabled', async () => {
            const user = { _id: userId, name: 'Suspended', email: 'suspended@example.com', status: 'disabled', emailVerified: true };
            vi.spyOn(User, 'findOne').mockResolvedValue(user as any);

            await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', oauthSecret)
                .send({ provider: 'google', accountId: 'g-suspended', email: 'suspended@example.com', name: 'Suspended' })
                .expect(403, { error: 'Account is unavailable' });
        });

        it('rejects exchange when business account is not active', async () => {
            const user = { _id: userId, name: 'Merchant', email: 'merchant@example.com', status: 'active', emailVerified: true };
            vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
            vi.spyOn(BusinessMember, 'find').mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue([{ _id: membershipId, businessId, role: 'Owner', status: 'active' }]),
                }),
            } as any);
            vi.spyOn(Business, 'findOne').mockReturnValue({
                lean: vi.fn().mockResolvedValue(null),
            } as any);

            await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', oauthSecret)
                .send({ provider: 'google', accountId: 'g-biz-inactive', email: 'merchant@example.com', name: 'Merchant' })
                .expect(403, { error: 'Business is not active' });
        });

        it('rejects exchange with 409 when user belongs to multiple businesses', async () => {
            const user = { _id: userId, name: 'Multi', email: 'multi@example.com', status: 'active', emailVerified: true };
            vi.spyOn(User, 'findOne').mockResolvedValue(user as any);
            vi.spyOn(BusinessMember, 'find').mockReturnValue({
                limit: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue([
                        { _id: membershipId, businessId, role: 'Owner', status: 'active' },
                        { _id: new mongoose.Types.ObjectId(), businessId: new mongoose.Types.ObjectId(), role: 'Staff', status: 'active' },
                    ]),
                }),
            } as any);

            await request(app)
                .post('/auth/oauth/exchange')
                .set('x-oauth-internal-secret', oauthSecret)
                .send({ provider: 'google', accountId: 'g-multi', email: 'multi@example.com', name: 'Multi' })
                .expect(409, { error: 'Choose a business using email sign in' });
        });
    });
});
