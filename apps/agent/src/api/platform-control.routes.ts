/**
 * Platform control plane.
 *
 * The original platform router answers "what is happening" — overviews, ledgers,
 * tenant detail. This one answers "change it": the admin team, merchant broadcasts,
 * feature rollout, discounts, AI configuration, prompts, queues, compliance,
 * cross-tenant oversight, exports, and the settings registry. Both mount on
 * `/platform-admin`, so the console proxy and session renewal are unchanged.
 *
 * Every mutation here goes through `requirePlatformPermission` and lands in the
 * platform audit log with a reason, before and after values.
 */
import { Router } from 'express';
import mongoose from 'mongoose';
import type { PlatformAdminAuthenticatedRequest } from '../auth/middleware';
import { hashPassword } from '../auth/password';
import { revokeAllUserSessions } from '../auth/session';
import { Activity } from '../models/Activity';
import { AIUsage } from '../models/AIUsage';
import { AuthSession } from '../models/AuthSession';
import { BusinessAwareness } from '../models/BusinessAwareness';
import { Category } from '../models/Category';
import { CourierObservation } from '../models/CourierObservation';
import { CustomerAction } from '../models/CustomerAction';
import { CustomerEvent } from '../models/CustomerEvent';
import { CustomerIntelligence } from '../models/CustomerIntelligence';
import { CustomerVisit } from '../models/CustomerVisit';
import { IntelligenceIntegration } from '../models/IntelligenceIntegration';
import { Meeting } from '../models/Meeting';
import { MerchantActivity } from '../models/MerchantActivity';
import { MetaOAuthSession } from '../models/MetaOAuthSession';
import { Note } from '../models/Note';
import { Offering } from '../models/Offering';
import { SubscriptionEvent } from '../models/SubscriptionEvent';
import { TrainingCandidate } from '../models/TrainingCandidate';
import { TrainingRun } from '../models/TrainingRun';
import { WebhookEvent } from '../models/WebhookEvent';
import { WhatsAppSignupSession } from '../models/WhatsAppSignupSession';
import { BillingTransaction } from '../models/BillingTransaction';
import { Business } from '../models/Business';
import { BusinessChannel } from '../models/BusinessChannel';
import { BusinessMember } from '../models/BusinessMember';
import { Conversation } from '../models/Conversation';
import { Coupon, COUPON_TYPES, couponRejection } from '../models/Coupon';
import { CourierIntegration } from '../models/CourierIntegration';
import { Customer } from '../models/Customer';
import { ErrorLog } from '../models/ErrorLog';
import { FeatureFlag } from '../models/FeatureFlag';
import { Knowledge } from '../models/Knowledge';
import { MetaDataDeletionRequest } from '../models/MetaDataDeletionRequest';
import { Message } from '../models/Message';
import { NOTIFICATION_EVENTS, NOTIFICATION_VARIABLES, NotificationTemplate } from '../models/NotificationTemplate';
import { Order } from '../models/Order';
import { PlatformAdmin } from '../models/PlatformAdmin';
import { PlatformAnnouncement, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_SEVERITIES } from '../models/PlatformAnnouncement';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { PlatformSetting } from '../models/PlatformSetting';
import { Product } from '../models/Product';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { SystemPrompt } from '../models/SystemPrompt';
import { TrainingSource } from '../models/TrainingSource';
import { User } from '../models/User';
import { BUSINESS_ROLES } from '../tenancy/context';
import { clearFeatureFlagCache, ensureDefaultFeatureFlags } from '../services/feature-flag.service';
import { clearNotificationTemplateCache, ensureDefaultNotificationTemplates } from '../services/notification-template.service';
import { expireLapsedAnnouncements } from '../services/platform-announcement.service';
import { writePlatformAudit } from '../services/platform-audit.service';
import { csvFilename, EXPORT_ROW_CAP, toCsv } from '../services/platform-export.service';
import { PLATFORM_ADMIN_ROLES, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS, hasPermission, isPlatformRole, permissionsFor, requirePlatformPermission } from '../services/platform-permissions';
import { getAIMaxOutputTokens, getAIModel } from '../services/ai-config';
import { getAIConfiguration } from '../config/runtime';
import { platformPasswordError } from '../services/platform-security.service';
import { clearSettingCache, effectiveSettings, REGISTRY_BY_KEY, settingFlag, settingNumber, validateSettingWrite, warmSettingCache } from '../services/platform-settings.service';
import { invalidatePromptCache } from '../services/systemPrompt.service';
import { boolOf, dateOf, objectId, objectIdList, pageOf, range, reason, safeRegex, stringList } from './platform-request';

const router = Router();
const admin = (req: PlatformAdminAuthenticatedRequest) => req.platformAdmin!;
/** The signed-in admin's id as an ObjectId — authentication already proved it resolves. */
const adminId = (req: PlatformAdminAuthenticatedRequest) => new mongoose.Types.ObjectId(admin(req).id);
const audit = (req: PlatformAdminAuthenticatedRequest, params: Omit<Parameters<typeof writePlatformAudit>[0], 'platformAdminId'>) => writePlatformAudit({ ...params, platformAdminId: admin(req).id });
const badRequest = (res: any, message: string) => res.status(400).json({ error: message });

// ---------------------------------------------------------------------------
// Admin team and roles
// ---------------------------------------------------------------------------

router.get('/roles', requirePlatformPermission('team.view'), (_req, res) => res.json(
    PLATFORM_ADMIN_ROLES.map(role => ({ role, description: ROLE_DESCRIPTIONS[role], permissions: ROLE_PERMISSIONS[role] })),
));

router.get('/team', requirePlatformPermission('team.view'), async (_req, res) => {
    const admins = await PlatformAdmin.collection.find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: 1 }).toArray();
    res.json(admins.map(row => ({ ...row, effectivePermissions: permissionsFor(row.role, row.permissions || []) })));
});

router.post('/team', requirePlatformPermission('team.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 120);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || '');
    const why = reason(req.body?.reason);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isPlatformRole(role) || !why) return badRequest(res, 'Name, a valid email, a role, and a reason are required');
    const invalidPassword = await platformPasswordError(password, [name, email]);
    if (invalidPassword) return badRequest(res, invalidPassword);
    try {
        const created = await PlatformAdmin.create({
            name, email, role,
            passwordHash: await hashPassword(password),
            permissions: stringList(req.body?.permissions, 30),
            notes: String(req.body?.notes || '').slice(0, 500),
            mustChangePassword: true,
            createdBy: adminId(req),
        });
        await audit(req, { action: 'PLATFORM_ADMIN_CREATED', targetType: 'platform_admin', targetId: created._id.toString(), previousValue: null, newValue: { name, email, role }, reason: why });
        res.status(201).json({ id: created._id, name, email, role, status: created.status });
    } catch (error: any) {
        res.status(error?.code === 11000 ? 409 : 400).json({ error: error?.code === 11000 ? 'An administrator with that email already exists' : 'Unable to create administrator' });
    }
});

router.patch('/team/:id', requirePlatformPermission('team.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid administrator and a reason are required');
    const previous = await PlatformAdmin.collection.findOne({ _id: id }, { projection: { passwordHash: 0 } });
    if (!previous) return res.status(404).json({ error: 'Administrator not found' });
    const update: Record<string, unknown> = {};
    if (req.body?.role !== undefined) {
        if (!isPlatformRole(req.body.role)) return badRequest(res, 'Unknown platform role');
        update.role = req.body.role;
    }
    if (req.body?.permissions !== undefined) update.permissions = stringList(req.body.permissions, 30);
    if (req.body?.status !== undefined) {
        if (!['active', 'disabled'].includes(String(req.body.status))) return badRequest(res, 'Status must be active or disabled');
        update.status = String(req.body.status);
    }
    if (req.body?.notes !== undefined) update.notes = String(req.body.notes).slice(0, 500);
    if (!Object.keys(update).length) return badRequest(res, 'Nothing to change');
    // Locking yourself out, or removing the last owner, leaves nobody able to put it
    // back — so both are refused here rather than discovered at the next sign-in.
    if (id.toString() === admin(req).id && (update.status === 'disabled' || (update.role && update.role !== 'OWNER'))) return badRequest(res, 'You cannot downgrade or disable your own administrator account');
    if (previous.role === 'OWNER' && (update.role && update.role !== 'OWNER' || update.status === 'disabled')) {
        if (await PlatformAdmin.collection.countDocuments({ role: 'OWNER', status: 'active', _id: { $ne: id } }) === 0) return badRequest(res, 'At least one active owner must remain');
    }
    await PlatformAdmin.collection.updateOne({ _id: id }, { $set: { ...update, updatedAt: new Date() } });
    await audit(req, { action: 'PLATFORM_ADMIN_UPDATED', targetType: 'platform_admin', targetId: id.toString(), previousValue: { role: previous.role, status: previous.status, permissions: previous.permissions }, newValue: update, reason: why });
    res.json({ ...previous, ...update });
});

router.post('/team/:id/password', requirePlatformPermission('team.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const password = String(req.body?.password || '');
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid administrator and a reason are required');
    const target = await PlatformAdmin.collection.findOne({ _id: id }, { projection: { name: 1, email: 1 } });
    if (!target) return res.status(404).json({ error: 'Administrator not found' });
    const invalid = await platformPasswordError(password, [String(target.name), String(target.email)]);
    if (invalid) return badRequest(res, invalid);
    await PlatformAdmin.collection.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password), mustChangePassword: true, updatedAt: new Date() } });
    await audit(req, { action: 'PLATFORM_ADMIN_PASSWORD_RESET', targetType: 'platform_admin', targetId: id.toString(), previousValue: null, newValue: { mustChangePassword: true }, reason: why });
    res.json({ id, mustChangePassword: true });
});

// ---------------------------------------------------------------------------
// Merchant broadcasts
// ---------------------------------------------------------------------------

function announcementPayload(body: any) {
    const title = String(body?.title || '').trim().slice(0, 140);
    const content = String(body?.body || '').trim().slice(0, 2000);
    const severity = ANNOUNCEMENT_SEVERITIES.find(value => value === body?.severity) || 'info';
    const audience = ANNOUNCEMENT_AUDIENCES.find(value => value === body?.audience) || 'all';
    if (!title || !content) return null;
    const payload: Record<string, unknown> = {
        title, body: content, severity, audience,
        planSlugs: audience === 'plan' ? stringList(body?.planSlugs, 20) : [],
        subscriptionStatuses: audience === 'status' ? stringList(body?.subscriptionStatuses, 10) : [],
        businessIds: audience === 'business' ? objectIdList(body?.businessIds, 100) : [],
        dismissible: body?.dismissible === undefined ? true : boolOf(body.dismissible),
        emailDelivery: boolOf(body?.emailDelivery),
        startsAt: dateOf(body?.startsAt),
        endsAt: dateOf(body?.endsAt),
    };
    // A targeted announcement with an empty target list would quietly reach nobody.
    if (audience !== 'all' && !(payload.planSlugs as unknown[]).length && !(payload.subscriptionStatuses as unknown[]).length && !(payload.businessIds as unknown[]).length) return null;
    return payload;
}

router.get('/announcements', requirePlatformPermission('dashboard.view'), async (_req, res) => {
    await expireLapsedAnnouncements();
    const rows = await PlatformAnnouncement.collection.aggregate([
        { $sort: { createdAt: -1 } }, { $limit: 100 },
        { $lookup: { from: 'platformadmins', localField: 'createdBy', foreignField: '_id', as: 'author' } },
        { $addFields: { authorName: { $arrayElemAt: ['$author.name', 0] } } },
        { $project: { author: 0 } },
    ]).toArray();
    res.json(rows);
});

router.post('/announcements', requirePlatformPermission('announcements.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const payload = announcementPayload(req.body);
    if (!payload) return badRequest(res, 'A title, a message, and at least one recipient are required');
    const created = await PlatformAnnouncement.create({ ...payload, status: 'draft', createdBy: adminId(req) });
    await audit(req, { action: 'ANNOUNCEMENT_CREATED', targetType: 'announcement', targetId: created._id.toString(), previousValue: null, newValue: payload, reason: `Drafted announcement: ${payload.title}` });
    res.status(201).json(created);
});

router.put('/announcements/:id', requirePlatformPermission('announcements.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const payload = announcementPayload(req.body);
    if (!id || !payload) return badRequest(res, 'A title, a message, and at least one recipient are required');
    const previous = await PlatformAnnouncement.collection.findOne({ _id: id });
    if (!previous) return res.status(404).json({ error: 'Announcement not found' });
    const updated = await PlatformAnnouncement.collection.findOneAndUpdate({ _id: id }, { $set: { ...payload, updatedAt: new Date() } }, { returnDocument: 'after' });
    await audit(req, { action: 'ANNOUNCEMENT_UPDATED', targetType: 'announcement', targetId: id.toString(), previousValue: { title: previous.title, audience: previous.audience }, newValue: payload, reason: `Updated announcement: ${payload.title}` });
    res.json(updated);
});

router.post('/announcements/:id/status', requirePlatformPermission('announcements.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const status = String(req.body?.status || '');
    const why = reason(req.body?.reason) || `Announcement moved to ${status}`;
    if (!id || !['draft', 'published', 'expired'].includes(status)) return badRequest(res, 'Status must be draft, published, or expired');
    const previous = await PlatformAnnouncement.collection.findOne({ _id: id }, { projection: { title: 1, status: 1 } });
    if (!previous) return res.status(404).json({ error: 'Announcement not found' });
    const set: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === 'published') set.publishedAt = new Date();
    await PlatformAnnouncement.collection.updateOne({ _id: id }, { $set: set });
    await audit(req, { action: `ANNOUNCEMENT_${status.toUpperCase()}`, targetType: 'announcement', targetId: id.toString(), previousValue: { status: previous.status }, newValue: { status }, reason: why });
    res.json({ ...previous, status });
});

router.delete('/announcements/:id', requirePlatformPermission('announcements.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, 'A valid announcement is required');
    const previous = await PlatformAnnouncement.collection.findOne({ _id: id }, { projection: { title: 1, status: 1 } });
    if (!previous) return res.status(404).json({ error: 'Announcement not found' });
    await PlatformAnnouncement.collection.deleteOne({ _id: id });
    await audit(req, { action: 'ANNOUNCEMENT_DELETED', targetType: 'announcement', targetId: id.toString(), previousValue: previous, newValue: null, reason: `Deleted announcement: ${previous.title}` });
    res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

function flagPayload(body: any) {
    const label = String(body?.label || '').trim().slice(0, 100);
    if (!label) return null;
    const percent = Number(body?.rolloutPercent);
    return {
        label,
        description: String(body?.description || '').slice(0, 300),
        enabled: boolOf(body?.enabled),
        rolloutPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 100,
        planSlugs: stringList(body?.planSlugs, 20),
        businessIds: objectIdList(body?.businessIds, 200),
        killSwitch: boolOf(body?.killSwitch),
    };
}

router.get('/flags', requirePlatformPermission('settings.view'), async (_req, res) => {
    await ensureDefaultFeatureFlags();
    res.json(await FeatureFlag.collection.find({}).sort({ key: 1 }).toArray());
});

router.post('/flags', requirePlatformPermission('flags.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const key = String(req.body?.key || '').trim().toLowerCase();
    const payload = flagPayload(req.body);
    if (!/^[a-z0-9_.-]{2,80}$/.test(key) || !payload) return badRequest(res, 'A key of letters, numbers, dots, dashes or underscores and a label are required');
    try {
        const created = await FeatureFlag.create({ ...payload, key, updatedBy: adminId(req) });
        clearFeatureFlagCache();
        await audit(req, { action: 'FEATURE_FLAG_CREATED', targetType: 'feature_flag', targetId: key, previousValue: null, newValue: payload, reason: `Created feature flag ${key}` });
        res.status(201).json(created);
    } catch (error: any) {
        res.status(error?.code === 11000 ? 409 : 400).json({ error: error?.code === 11000 ? 'That flag key already exists' : 'Unable to create flag' });
    }
});

router.put('/flags/:id', requirePlatformPermission('flags.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const payload = flagPayload(req.body);
    if (!id || !payload) return badRequest(res, 'A valid flag and a label are required');
    const previous = await FeatureFlag.collection.findOne({ _id: id });
    if (!previous) return res.status(404).json({ error: 'Feature flag not found' });
    const updated = await FeatureFlag.collection.findOneAndUpdate({ _id: id }, { $set: { ...payload, updatedBy: adminId(req), updatedAt: new Date() } }, { returnDocument: 'after' });
    clearFeatureFlagCache();
    await audit(req, { action: 'FEATURE_FLAG_UPDATED', targetType: 'feature_flag', targetId: String(previous.key), previousValue: { enabled: previous.enabled, rolloutPercent: previous.rolloutPercent, killSwitch: previous.killSwitch, planSlugs: previous.planSlugs }, newValue: payload, reason: `Updated feature flag ${previous.key}` });
    res.json(updated);
});

router.delete('/flags/:id', requirePlatformPermission('flags.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, 'A valid flag is required');
    const previous = await FeatureFlag.collection.findOne({ _id: id }, { projection: { key: 1, enabled: 1 } });
    if (!previous) return res.status(404).json({ error: 'Feature flag not found' });
    await FeatureFlag.collection.deleteOne({ _id: id });
    clearFeatureFlagCache();
    await audit(req, { action: 'FEATURE_FLAG_DELETED', targetType: 'feature_flag', targetId: String(previous.key), previousValue: previous, newValue: null, reason: `Deleted feature flag ${previous.key}` });
    res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

function couponPayload(body: any) {
    const type = COUPON_TYPES.find(value => value === body?.type);
    const value = Number(body?.value);
    if (!type || !Number.isFinite(value) || value < 0) return null;
    if (type === 'PERCENT' && value > 100) return null;
    const max = Number(body?.maxRedemptions);
    const recurring = Number(body?.recurringPeriods);
    return {
        description: String(body?.description || '').slice(0, 240),
        type, value,
        currency: String(body?.currency || 'BDT').slice(0, 8),
        planSlugs: stringList(body?.planSlugs, 20),
        maxRedemptions: Number.isFinite(max) && max > 0 ? Math.round(max) : 0,
        recurringPeriods: Number.isFinite(recurring) && recurring > 0 ? Math.min(36, Math.round(recurring)) : 0,
        validFrom: dateOf(body?.validFrom),
        validUntil: dateOf(body?.validUntil),
        enabled: body?.enabled === undefined ? true : boolOf(body.enabled),
    };
}

router.get('/coupons', requirePlatformPermission('billing.view'), async (_req, res) => {
    const coupons = await Coupon.collection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(coupons.map(coupon => ({ ...coupon, rejection: couponRejection(coupon as any) })));
});

router.post('/coupons', requirePlatformPermission('coupons.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const payload = couponPayload(req.body);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !payload) return badRequest(res, 'A code of 3–40 letters, numbers, dashes or underscores and a valid discount are required');
    try {
        const created = await Coupon.create({ ...payload, code, createdBy: adminId(req) });
        await audit(req, { action: 'COUPON_CREATED', targetType: 'coupon', targetId: code, previousValue: null, newValue: payload, reason: `Created discount code ${code}` });
        res.status(201).json(created);
    } catch (error: any) {
        res.status(error?.code === 11000 ? 409 : 400).json({ error: error?.code === 11000 ? 'That code already exists' : 'Unable to create code' });
    }
});

router.put('/coupons/:id', requirePlatformPermission('coupons.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const payload = couponPayload(req.body);
    if (!id || !payload) return badRequest(res, 'A valid code and discount are required');
    const previous = await Coupon.collection.findOne({ _id: id });
    if (!previous) return res.status(404).json({ error: 'Discount code not found' });
    const updated = await Coupon.collection.findOneAndUpdate({ _id: id }, { $set: { ...payload, updatedAt: new Date() } }, { returnDocument: 'after' });
    await audit(req, { action: 'COUPON_UPDATED', targetType: 'coupon', targetId: String(previous.code), previousValue: { type: previous.type, value: previous.value, enabled: previous.enabled }, newValue: payload, reason: `Updated discount code ${previous.code}` });
    res.json(updated);
});

router.delete('/coupons/:id', requirePlatformPermission('coupons.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, 'A valid code is required');
    const previous = await Coupon.collection.findOne({ _id: id }, { projection: { code: 1, redemptions: 1 } });
    if (!previous) return res.status(404).json({ error: 'Discount code not found' });
    // A redeemed code stays on the record so historical discounts remain explainable;
    // only an unused code is actually removed.
    if (Number(previous.redemptions || 0) > 0) {
        await Coupon.collection.updateOne({ _id: id }, { $set: { enabled: false, updatedAt: new Date() } });
        await audit(req, { action: 'COUPON_DISABLED', targetType: 'coupon', targetId: String(previous.code), previousValue: { enabled: true }, newValue: { enabled: false }, reason: `Disabled redeemed code ${previous.code}` });
        return res.json({ disabled: true });
    }
    await Coupon.collection.deleteOne({ _id: id });
    await audit(req, { action: 'COUPON_DELETED', targetType: 'coupon', targetId: String(previous.code), previousValue: previous, newValue: null, reason: `Deleted unused code ${previous.code}` });
    res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// Settings registry
// ---------------------------------------------------------------------------

router.get('/settings/registry', requirePlatformPermission('settings.view'), async (_req, res) => res.json(await effectiveSettings()));

router.put('/settings/registry/:key', requirePlatformPermission('settings.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const key = String(req.params.key || '');
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'value')) return badRequest(res, 'A value is required');
    const checked = validateSettingWrite(key, req.body.value);
    if (!checked.ok) return badRequest(res, checked.error);
    const previous = await PlatformSetting.collection.findOne({ key }, { projection: { value: 1 } });
    const setting = await PlatformSetting.collection.findOneAndUpdate(
        { key },
        { $set: { value: checked.value, category: checked.definition.category, description: checked.definition.description, updatedBy: adminId(req), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: 'after' },
    );
    await warmSettingCache();
    await audit(req, { action: 'PLATFORM_SETTING_UPDATED', targetType: 'platform_setting', targetId: key, previousValue: previous ? previous.value : checked.definition.default, newValue: checked.value, reason: `Updated ${checked.definition.label}` });
    res.json(setting);
});

router.post('/settings/registry/:key/reset', requirePlatformPermission('settings.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const key = String(req.params.key || '');
    const definition = REGISTRY_BY_KEY.get(key);
    if (!definition) return badRequest(res, 'Unknown setting key');
    const previous = await PlatformSetting.collection.findOne({ key }, { projection: { value: 1 } });
    await PlatformSetting.collection.deleteOne({ key });
    await warmSettingCache();
    await audit(req, { action: 'PLATFORM_SETTING_RESET', targetType: 'platform_setting', targetId: key, previousValue: previous?.value, newValue: definition.default, reason: `Reset ${definition.label} to its default` });
    res.json({ key, value: definition.default, isDefault: true });
});

// ---------------------------------------------------------------------------
// AI configuration, quotas, and the prompt library
// ---------------------------------------------------------------------------

router.get('/ai/overview', requirePlatformPermission('ai.view'), async (_req, res) => {
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [month, byModel, top, states, ceiling, warn] = await Promise.all([
        AIUsage.collection.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: null, requests: { $sum: 1 }, totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, knownCost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } }]).toArray(),
        AIUsage.collection.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { provider: { $ifNull: ['$provider', 'unknown'] }, model: '$model' }, requests: { $sum: 1 }, tokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, cost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } }, { $sort: { cost: -1 } }, { $limit: 20 }]).toArray(),
        AIUsage.collection.aggregate([
            { $match: { createdAt: { $gte: from } } },
            { $group: { _id: '$businessId', requests: { $sum: 1 }, tokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, cost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } },
            { $sort: { cost: -1 } }, { $limit: 10 },
            { $lookup: { from: Business.collection.name, localField: '_id', foreignField: '_id', as: 'business' } },
            { $project: { requests: 1, tokens: 1, cost: 1, businessName: { $ifNull: [{ $arrayElemAt: ['$business.name', 0] }, 'Deleted workspace'] } } },
        ]).toArray(),
        Business.collection.aggregate([{ $group: { _id: { $ifNull: ['$aiAccess.status', 'ENABLED'] }, count: { $sum: 1 } } }]).toArray(),
        settingNumber('ai.monthly_cost_ceiling_usd'),
        settingNumber('ai.usage_warning_percent'),
    ]);
    const spend = month[0]?.knownCost || 0;
    res.json({
        month: month[0] || { requests: 0, totalTokens: 0, knownCost: 0 },
        byModel, topBusinesses: top,
        states: Object.fromEntries(states.map(row => [String(row._id), row.count])),
        ceiling: { limit: ceiling, spend, percent: ceiling ? Math.round((spend / ceiling) * 100) : null, warnAt: warn },
        runtime: { provider: getAIConfiguration().provider, deploymentModel: getAIConfiguration().model, effectiveModel: getAIModel(), maxOutputTokens: getAIMaxOutputTokens(), groqConfigured: Boolean(process.env.GROQ_API_KEY), openAiConfigured: Boolean(process.env.OPENAI_API_KEY) },
    });
});

router.patch('/businesses/:id/ai-limits', requirePlatformPermission('ai.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid workspace and a reason are required');
    const numeric = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null; };
    const requests = numeric(req.body?.monthlyRequestLimit);
    const tokens = numeric(req.body?.monthlyTokenLimit);
    const threshold = numeric(req.body?.warningThresholdPercent);
    if (requests === null && tokens === null && threshold === null && req.body?.pausedReply === undefined) return badRequest(res, 'Nothing to change');
    const previous = await Business.collection.findOne({ _id: id }, { projection: { name: 1, aiAccess: 1 } });
    if (!previous) return res.status(404).json({ error: 'Workspace not found' });
    const set: Record<string, unknown> = { updatedAt: new Date() };
    // 0 clears an override and hands the tenant back to the plan allowance.
    if (requests !== null) set['aiAccess.monthlyRequestLimit'] = requests || undefined;
    if (tokens !== null) set['aiAccess.monthlyTokenLimit'] = tokens || undefined;
    if (threshold !== null) set['aiAccess.warningThresholdPercent'] = Math.min(100, threshold) || undefined;
    if (req.body?.pausedReply !== undefined) set['aiAccess.pausedReply'] = String(req.body.pausedReply).slice(0, 500) || undefined;
    await Business.collection.updateOne({ _id: id }, { $set: set });
    await audit(req, { action: 'AI_LIMITS_UPDATED', targetType: 'business_ai', targetId: id.toString(), businessId: id.toString(), previousValue: previous.aiAccess, newValue: set, reason: why });
    res.json({ businessId: id, aiAccess: { ...previous.aiAccess, monthlyRequestLimit: requests ?? previous.aiAccess?.monthlyRequestLimit, monthlyTokenLimit: tokens ?? previous.aiAccess?.monthlyTokenLimit } });
});

router.get('/prompts', requirePlatformPermission('ai.view'), async (_req, res) => res.json(await SystemPrompt.collection.find({}).sort({ isActive: -1, updatedAt: -1 }).limit(100).toArray()));

router.post('/prompts', requirePlatformPermission('prompts.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 120);
    const content = String(req.body?.content || '').trim();
    if (!name || content.length < 20) return badRequest(res, 'A name and at least 20 characters of prompt content are required');
    const prompt = await SystemPrompt.create({ name, content, description: String(req.body?.description || '').slice(0, 300), isActive: false });
    invalidatePromptCache();
    await audit(req, { action: 'PROMPT_CREATED', targetType: 'system_prompt', targetId: prompt._id.toString(), previousValue: null, newValue: { name, length: content.length }, reason: `Created prompt ${name}` });
    res.status(201).json(prompt);
});

router.put('/prompts/:id', requirePlatformPermission('prompts.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const name = String(req.body?.name || '').trim().slice(0, 120);
    const content = String(req.body?.content || '').trim();
    if (!id || !name || content.length < 20) return badRequest(res, 'A valid prompt, a name, and at least 20 characters of content are required');
    const previous = await SystemPrompt.collection.findOne({ _id: id }, { projection: { name: 1, content: 1 } });
    if (!previous) return res.status(404).json({ error: 'Prompt not found' });
    const updated = await SystemPrompt.collection.findOneAndUpdate({ _id: id }, { $set: { name, content, description: String(req.body?.description || '').slice(0, 300), updatedAt: new Date() } }, { returnDocument: 'after' });
    invalidatePromptCache();
    await audit(req, { action: 'PROMPT_UPDATED', targetType: 'system_prompt', targetId: id.toString(), previousValue: { name: previous.name, length: String(previous.content || '').length }, newValue: { name, length: content.length }, reason: `Updated prompt ${name}` });
    res.json(updated);
});

router.post('/prompts/:id/activate', requirePlatformPermission('prompts.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid prompt and a reason are required');
    const target = await SystemPrompt.collection.findOne({ _id: id }, { projection: { name: 1 } });
    if (!target) return res.status(404).json({ error: 'Prompt not found' });
    const previous = await SystemPrompt.collection.findOne({ isActive: true }, { projection: { name: 1 } });
    // Exactly one prompt drives every tenant's agent, so the swap is two writes and
    // the cache drop that makes it take effect on the next turn.
    await SystemPrompt.collection.updateMany({ isActive: true }, { $set: { isActive: false, updatedAt: new Date() } });
    await SystemPrompt.collection.updateOne({ _id: id }, { $set: { isActive: true, updatedAt: new Date() } });
    invalidatePromptCache();
    await audit(req, { action: 'PROMPT_ACTIVATED', targetType: 'system_prompt', targetId: id.toString(), previousValue: previous ? { id: previous._id, name: previous.name } : null, newValue: { id, name: target.name }, reason: why });
    res.json({ activated: id, name: target.name });
});

router.delete('/prompts/:id', requirePlatformPermission('prompts.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, 'A valid prompt is required');
    const previous = await SystemPrompt.collection.findOne({ _id: id }, { projection: { name: 1, isActive: 1 } });
    if (!previous) return res.status(404).json({ error: 'Prompt not found' });
    if (previous.isActive) return badRequest(res, 'Activate another prompt before deleting the live one');
    await SystemPrompt.collection.deleteOne({ _id: id });
    invalidatePromptCache();
    await audit(req, { action: 'PROMPT_DELETED', targetType: 'system_prompt', targetId: id.toString(), previousValue: { name: previous.name }, newValue: null, reason: `Deleted prompt ${previous.name}` });
    res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// Notification templates
// ---------------------------------------------------------------------------

router.get('/notifications', requirePlatformPermission('settings.view'), async (_req, res) => {
    await ensureDefaultNotificationTemplates();
    res.json({
        templates: await NotificationTemplate.collection.find({}).sort({ event: 1, locale: 1 }).toArray(),
        events: NOTIFICATION_EVENTS.map(event => ({ event, variables: NOTIFICATION_VARIABLES[event] })),
        // Only these two are sent by the platform today; the rest are stored for the
        // surfaces that will send them, and the console says so rather than implying more.
        wired: ['email_verification', 'password_reset'],
    });
});

router.put('/notifications/:id', requirePlatformPermission('settings.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    const body = String(req.body?.body || '').trim().slice(0, 6000);
    if (!id || !subject || !body) return badRequest(res, 'A subject and a body are required');
    const previous = await NotificationTemplate.collection.findOne({ _id: id }, { projection: { event: 1, locale: 1, subject: 1, enabled: 1 } });
    if (!previous) return res.status(404).json({ error: 'Template not found' });
    const enabled = req.body?.enabled === undefined ? previous.enabled : boolOf(req.body.enabled);
    const updated = await NotificationTemplate.collection.findOneAndUpdate({ _id: id }, { $set: { subject, body, enabled, updatedBy: adminId(req), updatedAt: new Date() } }, { returnDocument: 'after' });
    clearNotificationTemplateCache();
    await audit(req, { action: 'NOTIFICATION_TEMPLATE_UPDATED', targetType: 'notification_template', targetId: `${previous.event}:${previous.locale}`, previousValue: { subject: previous.subject, enabled: previous.enabled }, newValue: { subject, enabled }, reason: `Updated ${previous.event} template` });
    res.json(updated);
});

router.post('/notifications', requirePlatformPermission('settings.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const event = NOTIFICATION_EVENTS.find(value => value === req.body?.event);
    const locale = String(req.body?.locale || '').trim().toLowerCase().slice(0, 8);
    const subject = String(req.body?.subject || '').trim().slice(0, 200);
    const body = String(req.body?.body || '').trim().slice(0, 6000);
    if (!event || !/^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(locale) || !subject || !body) return badRequest(res, 'An event, a locale such as bn or en, a subject, and a body are required');
    try {
        const created = await NotificationTemplate.create({ event, locale, subject, body, enabled: true, updatedBy: adminId(req) });
        clearNotificationTemplateCache();
        await audit(req, { action: 'NOTIFICATION_TEMPLATE_CREATED', targetType: 'notification_template', targetId: `${event}:${locale}`, previousValue: null, newValue: { subject }, reason: `Added ${event} template for ${locale}` });
        res.status(201).json(created);
    } catch (error: any) {
        res.status(error?.code === 11000 ? 409 : 400).json({ error: error?.code === 11000 ? 'A template for that event and locale already exists' : 'Unable to create template' });
    }
});

// ---------------------------------------------------------------------------
// User operations beyond suspend/reactivate
// ---------------------------------------------------------------------------

router.patch('/users/:id/membership', requirePlatformPermission('users.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const userId = objectId(req.params.id);
    const businessId = objectId(req.body?.businessId);
    const role = String(req.body?.role || '');
    const why = reason(req.body?.reason);
    if (!userId || !businessId || !(BUSINESS_ROLES as readonly string[]).includes(role) || !why) return badRequest(res, `A valid user, workspace, reason, and one of ${BUSINESS_ROLES.join(', ')} are required`);
    const membership = await BusinessMember.collection.findOne({ userId, businessId });
    if (!membership) return res.status(404).json({ error: 'That user is not a member of that workspace' });
    // A workspace with no owner cannot be administered by its own team again.
    if (membership.role === 'Owner' && role !== 'Owner' && await BusinessMember.collection.countDocuments({ businessId, role: 'Owner', status: 'active', _id: { $ne: membership._id } }) === 0) {
        return badRequest(res, 'A workspace must keep at least one active owner');
    }
    await BusinessMember.collection.updateOne({ _id: membership._id }, { $set: { role, updatedAt: new Date() } });
    await audit(req, { action: 'MEMBERSHIP_ROLE_CHANGED', targetType: 'business_member', targetId: membership._id.toString(), businessId: businessId.toString(), previousValue: { role: membership.role }, newValue: { role }, reason: why });
    res.json({ userId, businessId, role });
});

router.post('/users/:id/verify-email', requirePlatformPermission('users.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid user and a reason are required');
    const previous = await User.collection.findOne({ _id: id }, { projection: { email: 1, emailVerified: 1 } });
    if (!previous) return res.status(404).json({ error: 'User not found' });
    if (previous.emailVerified) return badRequest(res, 'That email is already verified');
    await User.collection.updateOne({ _id: id }, { $set: { emailVerified: true, emailVerifiedAt: new Date(), emailVerificationMethod: 'platform_admin', updatedAt: new Date() } });
    await audit(req, { action: 'USER_EMAIL_VERIFIED', targetType: 'user', targetId: id.toString(), previousValue: { emailVerified: false }, newValue: { emailVerified: true, method: 'platform_admin' }, reason: why });
    res.json({ id, emailVerified: true });
});

router.post('/users/:id/revoke-sessions', requirePlatformPermission('users.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid user and a reason are required');
    const user = await User.collection.findOne({ _id: id }, { projection: { email: 1 } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await revokeAllUserSessions(id.toString(), `platform_admin:${why}`.slice(0, 120));
    await audit(req, { action: 'USER_SESSIONS_REVOKED', targetType: 'user', targetId: id.toString(), previousValue: null, newValue: { revokedAt: new Date() }, reason: why });
    res.json({ id, revoked: true });
});

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

router.post('/payments/:id/refund', requirePlatformPermission('billing.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    const requested = Number(req.body?.amount);
    if (!id || !why) return badRequest(res, 'A valid payment and a reason are required');
    const payment = await BillingTransaction.collection.findOne({ _id: id });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'PAID' || payment.type === 'REFUND') return badRequest(res, 'Only a recorded payment can be refunded');
    const amount = Number.isFinite(requested) && requested > 0 ? requested : Number(payment.amount);
    if (amount > Number(payment.amount)) return badRequest(res, 'A refund cannot exceed the original payment');
    const window = await settingNumber('billing.refund_window_days');
    const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;
    if (window > 0 && paidAt && Date.now() - paidAt.getTime() > window * 86400000 && !boolOf(req.body?.overrideWindow)) {
        return res.status(409).json({ error: `That payment is outside the ${window}-day refund window`, code: 'REFUND_WINDOW' });
    }
    const refund = await BillingTransaction.create({
        businessId: payment.businessId, subscriptionId: payment.subscriptionId,
        type: 'REFUND', amount, currency: payment.currency, status: 'PAID',
        paymentMethod: payment.paymentMethod, provider: payment.provider,
        providerReference: payment.providerReference, reason: why,
        isTest: Boolean(payment.isTest), createdBy: admin(req).id, paidAt: new Date(),
    });
    await audit(req, { action: 'PAYMENT_REFUNDED', targetType: 'billing_transaction', targetId: refund._id.toString(), businessId: payment.businessId?.toString(), previousValue: { paymentId: id, amount: payment.amount }, newValue: { amount, currency: payment.currency }, reason: why });
    res.status(201).json(refund);
});

// ---------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------

const QUEUES = ['webhook-events', 'courier-events'] as const;

/**
 * BullMQ is only required when a queue is actually inspected, and an unreachable
 * Redis is reported rather than thrown — the jobs page has to render on a core-mode
 * install that never started Redis at all.
 */
async function withQueue<T>(name: string, work: (queue: any) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
    if (!(QUEUES as readonly string[]).includes(name)) return { ok: false, error: 'Unknown queue' };
    try {
        const { requireRedisConfig } = await import('../config/runtime');
        const { Queue } = await import('bullmq');
        const queue = new Queue(name, { connection: requireRedisConfig() });
        try { return { ok: true, value: await work(queue) }; } finally { await queue.close().catch(() => undefined); }
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Queue unavailable' };
    }
}

router.get('/jobs', requirePlatformPermission('ops.view'), async (_req, res) => {
    const queues = await Promise.all(QUEUES.map(async name => {
        const result = await withQueue(name, async queue => ({
            counts: await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
            paused: await queue.isPaused(),
            failures: (await queue.getJobs(['failed'], 0, 9)).map((job: any) => ({ id: String(job.id), name: job.name, attempts: job.attemptsMade, failedReason: String(job.failedReason || '').slice(0, 300), timestamp: job.timestamp })),
        }));
        return result.ok ? { name, available: true, ...result.value } : { name, available: false, error: result.error, counts: {}, paused: false, failures: [] };
    }));
    res.json({ queues, redisConfigured: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST) });
});

router.post('/jobs/:queue/:action', requirePlatformPermission('ops.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const name = String(req.params.queue);
    const action = String(req.params.action);
    const why = reason(req.body?.reason);
    if (!['retry', 'pause', 'resume', 'drain', 'clean'].includes(action) || !why) return badRequest(res, 'A supported action and a reason are required');
    const result = await withQueue(name, async queue => {
        if (action === 'pause') { await queue.pause(); return { paused: true }; }
        if (action === 'resume') { await queue.resume(); return { paused: false }; }
        if (action === 'drain') { await queue.drain(); return { drained: true }; }
        if (action === 'clean') { const removed = await queue.clean(0, 1000, 'failed'); return { cleaned: removed.length }; }
        const failed = await queue.getJobs(['failed'], 0, 499);
        for (const job of failed) await job.retry().catch(() => undefined);
        return { retried: failed.length };
    });
    if (!result.ok) return res.status(503).json({ error: result.error });
    await audit(req, { action: `QUEUE_${action.toUpperCase()}`, targetType: 'queue', targetId: name, previousValue: null, newValue: result.value, reason: why });
    res.json({ queue: name, ...result.value });
});

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

router.get('/providers', requirePlatformPermission('integrations.view'), async (_req, res) => {
    const [channels, couriers, settings] = await Promise.all([
        BusinessChannel.collection.aggregate([{ $group: { _id: '$platform', total: { $sum: 1 }, connected: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }]).toArray(),
        CourierIntegration.collection.aggregate([{ $group: { _id: '$provider', total: { $sum: 1 }, connected: { $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] } } } }]).toArray(),
        effectiveSettings(),
    ]);
    const setting = (key: string) => settings.find(row => row.key === key);
    const countOf = (rows: any[], id: string) => rows.find(row => String(row._id) === id) || { total: 0, connected: 0 };
    res.json({
        channels: [
            { id: 'facebook', label: 'Facebook Messenger', settingKey: 'integration.facebook_enabled', enabled: Boolean(setting('integration.facebook_enabled')?.value), credentials: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET), ...countOf(channels, 'facebook') },
            { id: 'instagram', label: 'Instagram', settingKey: 'integration.instagram_enabled', enabled: Boolean(setting('integration.instagram_enabled')?.value), credentials: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET), ...countOf(channels, 'instagram') },
            { id: 'whatsapp', label: 'WhatsApp', settingKey: 'integration.whatsapp_enabled', enabled: Boolean(setting('integration.whatsapp_enabled')?.value), credentials: Boolean(process.env.WHATSAPP_APP_SECRET || process.env.WHATSAPP_VERIFY_TOKEN), ...countOf(channels, 'whatsapp') },
            { id: 'website', label: 'Website widget', settingKey: 'integration.website_enabled', enabled: Boolean(setting('integration.website_enabled')?.value), credentials: true, ...countOf(channels, 'website') },
        ],
        couriers: [
            { id: 'steadfast', label: 'Steadfast', settingKey: 'integration.courier_steadfast_enabled', enabled: Boolean(setting('integration.courier_steadfast_enabled')?.value), credentials: Boolean(process.env.COURIER_CREDENTIAL_SECRET), ...countOf(couriers, 'steadfast') },
            { id: 'pathao', label: 'Pathao', settingKey: 'integration.courier_pathao_enabled', enabled: Boolean(setting('integration.courier_pathao_enabled')?.value), credentials: Boolean(process.env.COURIER_CREDENTIAL_SECRET), ...countOf(couriers, 'pathao') },
        ],
        infrastructure: {
            ai: { groq: Boolean(process.env.GROQ_API_KEY), openai: Boolean(process.env.OPENAI_API_KEY) },
            storage: Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME),
            email: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
            redis: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST),
            sandbox: Boolean(setting('integration.sandbox_mode')?.value),
        },
    });
});

// ---------------------------------------------------------------------------
// Cross-tenant oversight
// ---------------------------------------------------------------------------

router.get('/catalog', requirePlatformPermission('catalog.view'), async (_req, res) => {
    const [totals, topProducts, topOrders, topConversations] = await Promise.all([
        Promise.all([
            Product.collection.estimatedDocumentCount(),
            Order.collection.estimatedDocumentCount(),
            Conversation.collection.estimatedDocumentCount(),
            Customer.collection.estimatedDocumentCount(),
            Knowledge.collection.estimatedDocumentCount(),
            Message.collection.estimatedDocumentCount(),
        ]),
        Product.collection.aggregate([{ $group: { _id: '$businessId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }, { $lookup: { from: Business.collection.name, localField: '_id', foreignField: '_id', as: 'b' } }, { $project: { count: 1, name: { $arrayElemAt: ['$b.name', 0] } } }]).toArray(),
        Order.collection.aggregate([{ $group: { _id: '$businessId', count: { $sum: 1 }, value: { $sum: { $ifNull: ['$total', 0] } } } }, { $sort: { value: -1 } }, { $limit: 8 }, { $lookup: { from: Business.collection.name, localField: '_id', foreignField: '_id', as: 'b' } }, { $project: { count: 1, value: 1, name: { $arrayElemAt: ['$b.name', 0] } } }]).toArray(),
        Conversation.collection.aggregate([{ $group: { _id: '$businessId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }, { $lookup: { from: Business.collection.name, localField: '_id', foreignField: '_id', as: 'b' } }, { $project: { count: 1, name: { $arrayElemAt: ['$b.name', 0] } } }]).toArray(),
    ]);
    const [products, orders, conversations, customers, knowledge, messages] = totals;
    res.json({ totals: { products, orders, conversations, customers, knowledge, messages }, topProducts, topOrders, topConversations });
});

router.get('/catalog/orders', requirePlatformPermission('catalog.view'), async (req, res) => {
    const { page, limit } = pageOf(req as any);
    const match: Record<string, unknown> = {};
    if (req.query.status) match.status = String(req.query.status);
    if (req.query.search) match.$or = [{ orderNumber: safeRegex(req.query.search) }, { 'shippingAddress.phone': safeRegex(req.query.search) }, { 'shippingAddress.fullName': safeRegex(req.query.search) }];
    const [data, total] = await Promise.all([
        Order.collection.aggregate([
            { $match: match }, { $sort: { createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
            { $lookup: { from: Business.collection.name, localField: 'businessId', foreignField: '_id', as: 'b' } },
            { $project: { orderNumber: 1, status: 1, paymentStatus: 1, total: 1, createdAt: 1, itemCount: { $size: { $ifNull: ['$items', []] } }, customerName: '$shippingAddress.fullName', businessId: 1, businessName: { $arrayElemAt: ['$b.name', 0] } } },
        ]).toArray(),
        Order.collection.countDocuments(match),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

router.get('/catalog/products', requirePlatformPermission('catalog.view'), async (req, res) => {
    const { page, limit } = pageOf(req as any);
    const match = req.query.search ? { $or: [{ name: safeRegex(req.query.search) }, { sku: safeRegex(req.query.search) }] } : {};
    const [data, total] = await Promise.all([
        Product.collection.aggregate([
            { $match: match }, { $sort: { updatedAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
            { $lookup: { from: Business.collection.name, localField: 'businessId', foreignField: '_id', as: 'b' } },
            { $project: { name: 1, sku: 1, price: 1, stock: 1, isActive: 1, updatedAt: 1, businessId: 1, businessName: { $arrayElemAt: ['$b.name', 0] } } },
        ]).toArray(),
        Product.collection.countDocuments(match),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// ---------------------------------------------------------------------------
// Onboarding pipeline
// ---------------------------------------------------------------------------

router.get('/onboarding', requirePlatformPermission('merchants.view'), async (_req, res) => {
    const stages = await Business.collection.aggregate([
        { $project: { name: 1, createdAt: 1, status: 1, onboarding: 1, businessTypeStatus: 1 } },
        { $addFields: { stage: { $switch: { branches: [
            { case: { $ifNull: ['$onboarding.completedAt', false] }, then: 'complete' },
            { case: { $eq: ['$onboarding.aiTested', true] }, then: 'ai_tested' },
            { case: { $eq: ['$onboarding.channelConfigured', true] }, then: 'channel_configured' },
            { case: { $eq: ['$onboarding.knowledgeAdded', true] }, then: 'knowledge_added' },
            { case: { $eq: ['$onboarding.productAdded', true] }, then: 'product_added' },
        ], default: 'created' } } } },
        { $facet: {
            funnel: [{ $group: { _id: '$stage', count: { $sum: 1 } } }],
            stuck: [
                { $match: { stage: { $ne: 'complete' } } },
                { $sort: { createdAt: 1 } }, { $limit: 40 },
                { $project: { name: 1, createdAt: 1, status: 1, stage: 1, onboarding: 1 } },
            ],
        } },
    ]).toArray();
    const result = stages[0] || { funnel: [], stuck: [] };
    res.json({
        funnel: Object.fromEntries((result.funnel || []).map((row: any) => [String(row._id), row.count])),
        stuck: (result.stuck || []).map((row: any) => ({ ...row, ageDays: Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 86400000) })),
    });
});

// ---------------------------------------------------------------------------
// Security posture
// ---------------------------------------------------------------------------

router.get('/security', requirePlatformPermission('settings.view'), async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const [admins, logins, sensitive, merchantSessions] = await Promise.all([
        PlatformAdmin.collection.find({}, { projection: { name: 1, email: 1, role: 1, status: 1, lastLoginAt: 1, mustChangePassword: 1 } }).sort({ lastLoginAt: -1 }).toArray(),
        PlatformAuditLog.collection.aggregate([
            { $match: { action: 'ADMIN_LOGIN', createdAt: { $gte: since } } },
            { $group: { _id: '$platformAdminId', logins: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
        ]).toArray(),
        PlatformAuditLog.collection.find({ action: { $in: ['PLATFORM_ADMIN_CREATED', 'PLATFORM_ADMIN_UPDATED', 'PLATFORM_ADMIN_PASSWORD_RESET', 'USER_SESSIONS_REVOKED', 'BUSINESS_ERASED'] }, createdAt: { $gte: since } }, { projection: { action: 1, targetId: 1, reason: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(25).toArray(),
        User.collection.countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - 86400000) } }),
    ]);
    const loginsByAdmin = new Map(logins.map(row => [String(row._id), row]));
    res.json({
        admins: admins.map(row => ({ ...row, logins30d: loginsByAdmin.get(String(row._id))?.logins || 0 })),
        sensitiveEvents: sensitive,
        activeMerchantUsers24h: merchantSessions,
    });
});

// ---------------------------------------------------------------------------
// Compliance and data lifecycle
// ---------------------------------------------------------------------------

const RETENTION_DATASETS = {
    conversations: { key: 'compliance.retention_conversations_days', label: 'Conversations and messages' },
    error_logs: { key: 'compliance.retention_error_logs_days', label: 'Error logs' },
    ai_usage: { key: 'compliance.retention_ai_usage_days', label: 'AI usage records' },
    audit: { key: 'security.audit_retention_days', label: 'Platform audit log' },
} as const;

const cutoffFor = (days: number) => days > 0 ? new Date(Date.now() - days * 86400000) : null;

router.get('/compliance', requirePlatformPermission('compliance.view'), async (_req, res) => {
    const settings = await effectiveSettings();
    const valueOf = (key: string) => Number(settings.find(row => row.key === key)?.value || 0);
    const datasets = await Promise.all(Object.entries(RETENTION_DATASETS).map(async ([id, definition]) => {
        const days = valueOf(definition.key);
        const cutoff = cutoffFor(days);
        const collection = id === 'conversations' ? Conversation.collection : id === 'error_logs' ? ErrorLog.collection : id === 'ai_usage' ? AIUsage.collection : PlatformAuditLog.collection;
        const field = id === 'error_logs' ? 'timestamp' : 'createdAt';
        return { id, label: definition.label, settingKey: definition.key, days, total: await collection.estimatedDocumentCount(), expired: cutoff ? await collection.countDocuments({ [field]: { $lt: cutoff } }) : 0 };
    }));
    const sla = valueOf('compliance.deletion_request_sla_hours');
    const requests = await MetaDataDeletionRequest.collection.find({}, { projection: { providerUserHash: 1, status: 1, completedAt: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({
        datasets,
        requests: requests.map(row => ({ ...row, providerUserHash: String(row.providerUserHash || '').slice(0, 12), overdue: row.status !== 'COMPLETED' && sla > 0 && Date.now() - new Date(row.createdAt).getTime() > sla * 3600000 })),
        sla,
        exportEnabled: Boolean(settings.find(row => row.key === 'compliance.tenant_export_enabled')?.value),
    });
});

router.post('/compliance/requests/:id/complete', requirePlatformPermission('compliance.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid request and a reason are required');
    const previous = await MetaDataDeletionRequest.collection.findOne({ _id: id }, { projection: { status: 1 } });
    if (!previous) return res.status(404).json({ error: 'Request not found' });
    await MetaDataDeletionRequest.collection.updateOne({ _id: id }, { $set: { status: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() } });
    await audit(req, { action: 'DELETION_REQUEST_COMPLETED', targetType: 'deletion_request', targetId: id.toString(), previousValue: { status: previous.status }, newValue: { status: 'COMPLETED' }, reason: why });
    res.json({ id, status: 'COMPLETED' });
});

router.post('/compliance/retention/:dataset/purge', requirePlatformPermission('compliance.manage'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const dataset = String(req.params.dataset) as keyof typeof RETENTION_DATASETS;
    const why = reason(req.body?.reason);
    const definition = RETENTION_DATASETS[dataset];
    if (!definition || !why) return badRequest(res, 'A known dataset and a reason are required');
    const days = await settingNumber(definition.key);
    const cutoff = cutoffFor(days);
    if (!cutoff) return badRequest(res, 'That dataset is set to keep data indefinitely. Set a retention window first.');
    let deleted = 0;
    if (dataset === 'conversations') {
        const expired = await Conversation.collection.find({ createdAt: { $lt: cutoff } }, { projection: { _id: 1 } }).limit(5000).toArray();
        const ids = expired.map(row => row._id);
        if (ids.length) {
            await Message.collection.deleteMany({ conversationId: { $in: ids.map(String) } });
            deleted = (await Conversation.collection.deleteMany({ _id: { $in: ids } })).deletedCount;
        }
    } else if (dataset === 'error_logs') deleted = (await ErrorLog.collection.deleteMany({ timestamp: { $lt: cutoff } })).deletedCount;
    else if (dataset === 'ai_usage') deleted = (await AIUsage.collection.deleteMany({ createdAt: { $lt: cutoff } })).deletedCount;
    else deleted = (await PlatformAuditLog.collection.deleteMany({ createdAt: { $lt: cutoff } })).deletedCount;
    await audit(req, { action: 'RETENTION_PURGE', targetType: 'retention', targetId: dataset, previousValue: { cutoff, days }, newValue: { deleted }, reason: why });
    res.json({ dataset, cutoff, deleted });
});

router.get('/businesses/:id/export', requirePlatformPermission('compliance.view'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    if (!id) return badRequest(res, 'A valid workspace is required');
    if (!await settingFlag('compliance.tenant_export_enabled')) return res.status(403).json({ error: 'Tenant export is disabled in platform settings' });
    const business = await Business.collection.findOne({ _id: id });
    if (!business) return res.status(404).json({ error: 'Workspace not found' });
    const cap = 5000;
    const [members, products, orders, customers, knowledge, subscription, payments] = await Promise.all([
        BusinessMember.collection.aggregate([{ $match: { businessId: id } }, { $lookup: { from: User.collection.name, localField: 'userId', foreignField: '_id', as: 'u' } }, { $project: { role: 1, status: 1, name: { $arrayElemAt: ['$u.name', 0] }, email: { $arrayElemAt: ['$u.email', 0] } } }]).toArray(),
        Product.collection.find({ businessId: id }).limit(cap).toArray(),
        Order.collection.find({ businessId: id }).limit(cap).toArray(),
        Customer.collection.find({ businessId: id }).limit(cap).toArray(),
        Knowledge.collection.find({ businessId: id }).limit(cap).toArray(),
        Subscription.collection.findOne({ businessId: id }),
        BillingTransaction.collection.find({ businessId: id }).limit(cap).toArray(),
    ]);
    await audit(req, { action: 'TENANT_DATA_EXPORTED', targetType: 'business', targetId: id.toString(), businessId: id.toString(), previousValue: null, newValue: { products: products.length, orders: orders.length, customers: customers.length }, reason: `Exported workspace data for ${business.name}` });
    res.setHeader('Content-Disposition', `attachment; filename="sellpilot-${String(business.slug || id)}-export.json"`);
    res.json({ exportedAt: new Date().toISOString(), rowCap: cap, business, members, subscription, payments, products, orders, customers, knowledge });
});

/**
 * Erasure has to be complete to be worth offering, so it covers every collection
 * that carries this workspace's `businessId`, plus the customer-scoped records that
 * hang off them. Two things are kept on purpose and reported back: the billing
 * ledger, because financial records outlive the workspace, and the audit log, which
 * is the record that this happened at all.
 */
const TENANT_COLLECTIONS: Array<[string, { deleteMany: (filter: any) => Promise<{ deletedCount: number }> }]> = [
    ['products', Product.collection as any],
    ['orders', Order.collection as any],
    ['customers', Customer.collection as any],
    ['customerActions', CustomerAction.collection as any],
    ['customerEvents', CustomerEvent.collection as any],
    ['customerIntelligence', CustomerIntelligence.collection as any],
    ['customerVisits', CustomerVisit.collection as any],
    ['categories', Category.collection as any],
    ['offerings', Offering.collection as any],
    ['knowledge', Knowledge.collection as any],
    ['messages', Message.collection as any],
    ['conversations', Conversation.collection as any],
    ['channels', BusinessChannel.collection as any],
    ['couriers', CourierIntegration.collection as any],
    ['courierObservations', CourierObservation.collection as any],
    ['intelligenceIntegrations', IntelligenceIntegration.collection as any],
    ['trainingSources', TrainingSource.collection as any],
    ['trainingCandidates', TrainingCandidate.collection as any],
    ['trainingRuns', TrainingRun.collection as any],
    ['awareness', BusinessAwareness.collection as any],
    ['aiUsage', AIUsage.collection as any],
    ['webhookEvents', WebhookEvent.collection as any],
    ['metaOAuthSessions', MetaOAuthSession.collection as any],
    ['whatsappSignupSessions', WhatsAppSignupSession.collection as any],
    ['merchantActivity', MerchantActivity.collection as any],
    ['authSessions', AuthSession.collection as any],
    ['subscriptionEvents', SubscriptionEvent.collection as any],
    ['subscriptions', Subscription.collection as any],
    ['members', BusinessMember.collection as any],
];

router.post('/businesses/:id/erase', requirePlatformPermission('merchants.delete'), async (req: PlatformAdminAuthenticatedRequest, res) => {
    const id = objectId(req.params.id);
    const why = reason(req.body?.reason);
    if (!id || !why) return badRequest(res, 'A valid workspace and a reason are required');
    const business = await Business.collection.findOne({ _id: id }, { projection: { name: 1, slug: 1 } });
    if (!business) return res.status(404).json({ error: 'Workspace not found' });
    // Typing the workspace name is the last stop before an irreversible delete.
    if (String(req.body?.confirmation || '').trim() !== String(business.name)) return badRequest(res, 'Type the workspace name exactly to confirm erasure');

    const removed: Record<string, number> = {};
    // Notes, meetings and their activity entries are scoped to a customer rather
    // than to the workspace, so they are collected before the customers go.
    const idsOf = (rows: Array<{ _id: unknown }>) => rows.map(row => row._id);
    const customerIds = idsOf(await Customer.collection.find({ businessId: id }, { projection: { _id: 1 } }).toArray());
    if (customerIds.length) {
        // Activity rows point at whatever they describe, so the notes and meetings
        // are identified before they are deleted and nothing is left orphaned.
        const noteIds = idsOf(await Note.collection.find({ customerId: { $in: customerIds } }, { projection: { _id: 1 } }).toArray());
        const meetingIds = idsOf(await Meeting.collection.find({ customerId: { $in: customerIds } }, { projection: { _id: 1 } }).toArray());
        const conversationIds = idsOf(await Conversation.collection.find({ businessId: id }, { projection: { _id: 1 } }).toArray());
        removed.notes = (await Note.collection.deleteMany({ customerId: { $in: customerIds } })).deletedCount;
        removed.meetings = (await Meeting.collection.deleteMany({ customerId: { $in: customerIds } })).deletedCount;
        removed.activity = (await Activity.collection.deleteMany({ entityId: { $in: [...customerIds, ...conversationIds, ...noteIds, ...meetingIds] } })).deletedCount;
    }
    for (const [label, collection] of TENANT_COLLECTIONS) removed[label] = (await collection.deleteMany({ businessId: id })).deletedCount;
    await Business.collection.deleteOne({ _id: id });

    await audit(req, { action: 'BUSINESS_ERASED', targetType: 'business', targetId: id.toString(), previousValue: { name: business.name, slug: business.slug }, newValue: removed, reason: why });
    res.json({ erased: true, business: business.name, removed, kept: ['billing ledger', 'platform audit log'] });
});

// ---------------------------------------------------------------------------
// CSV exports
// ---------------------------------------------------------------------------

const EXPORTS = {
    businesses: { permission: 'merchants.view', columns: [{ header: 'Name', path: 'name' }, { header: 'Status', path: 'status' }, { header: 'Type', path: 'businessType' }, { header: 'Created', path: 'createdAt' }, { header: 'AI status', path: 'aiAccess.status' }] },
    users: { permission: 'users.view', columns: [{ header: 'Name', path: 'name' }, { header: 'Email', path: 'email' }, { header: 'Status', path: 'status' }, { header: 'Verified', path: 'emailVerified' }, { header: 'Last seen', path: 'lastSeenAt' }, { header: 'Created', path: 'createdAt' }] },
    subscriptions: { permission: 'billing.view', columns: [{ header: 'Business', path: 'businessName' }, { header: 'Plan', path: 'plan' }, { header: 'Status', path: 'status' }, { header: 'Billing', path: 'billingPeriod' }, { header: 'Price', path: 'price' }, { header: 'Currency', path: 'currency' }, { header: 'Period start', path: 'currentPeriodStart' }, { header: 'Period end', path: 'currentPeriodEnd' }] },
    payments: { permission: 'billing.view', columns: [{ header: 'Business', path: 'businessName' }, { header: 'Type', path: 'type' }, { header: 'Amount', path: 'amount' }, { header: 'Currency', path: 'currency' }, { header: 'Status', path: 'status' }, { header: 'Provider', path: 'provider' }, { header: 'Reference', path: 'providerReference' }, { header: 'Paid at', path: 'paidAt' }] },
    usage: { permission: 'ai.view', columns: [{ header: 'Business', path: 'businessName' }, { header: 'Provider', path: 'provider' }, { header: 'Model', path: 'model' }, { header: 'Requests', path: 'requests' }, { header: 'Total tokens', path: 'totalTokens' }, { header: 'Estimated cost', path: 'knownCost' }] },
    audit: { permission: 'audit.view', columns: [{ header: 'When', path: 'createdAt' }, { header: 'Action', path: 'action' }, { header: 'Target type', path: 'targetType' }, { header: 'Target', path: 'targetId' }, { header: 'Administrator', path: 'adminEmail' }, { header: 'Business', path: 'businessName' }, { header: 'Reason', path: 'reason' }] },
} as const;

async function exportRows(dataset: keyof typeof EXPORTS, period: ReturnType<typeof range>) {
    const withBusinessName = (localField: string) => [
        { $lookup: { from: Business.collection.name, localField, foreignField: '_id', as: 'b' } },
        { $addFields: { businessName: { $ifNull: [{ $arrayElemAt: ['$b.name', 0] }, 'Deleted workspace'] } } },
        { $project: { b: 0 } },
    ];
    if (dataset === 'businesses') return Business.collection.find({}, { projection: { name: 1, status: 1, businessType: 1, createdAt: 1, aiAccess: 1 } }).limit(EXPORT_ROW_CAP).toArray();
    if (dataset === 'users') return User.collection.find({}, { projection: { name: 1, email: 1, status: 1, emailVerified: 1, lastSeenAt: 1, createdAt: 1 } }).limit(EXPORT_ROW_CAP).toArray();
    if (dataset === 'subscriptions') return Subscription.collection.aggregate([{ $sort: { updatedAt: -1 } }, { $limit: EXPORT_ROW_CAP }, ...withBusinessName('businessId')]).toArray();
    if (dataset === 'payments') return BillingTransaction.collection.aggregate([{ $match: { createdAt: { $gte: period.from, $lt: period.to } } }, { $sort: { createdAt: -1 } }, { $limit: EXPORT_ROW_CAP }, ...withBusinessName('businessId')]).toArray();
    if (dataset === 'usage') return AIUsage.collection.aggregate([
        { $match: { createdAt: { $gte: period.from, $lt: period.to } } },
        { $group: { _id: { businessId: '$businessId', provider: { $ifNull: ['$provider', 'unknown'] }, model: '$model' }, requests: { $sum: 1 }, totalTokens: { $sum: { $ifNull: ['$totalTokens', 0] } }, knownCost: { $sum: { $ifNull: ['$estimatedCost', 0] } } } },
        { $project: { provider: '$_id.provider', model: '$_id.model', businessId: '$_id.businessId', requests: 1, totalTokens: 1, knownCost: 1 } },
        { $sort: { knownCost: -1 } }, { $limit: EXPORT_ROW_CAP }, ...withBusinessName('businessId'),
    ]).toArray();
    return PlatformAuditLog.collection.aggregate([
        { $match: { createdAt: { $gte: period.from, $lt: period.to } } }, { $sort: { createdAt: -1 } }, { $limit: EXPORT_ROW_CAP },
        { $lookup: { from: 'platformadmins', localField: 'platformAdminId', foreignField: '_id', as: 'a' } },
        { $addFields: { adminEmail: { $arrayElemAt: ['$a.email', 0] } } }, { $project: { a: 0 } },
        ...withBusinessName('businessId'),
    ]).toArray();
}

router.get('/exports/:dataset', async (req: PlatformAdminAuthenticatedRequest, res) => {
    const dataset = String(req.params.dataset) as keyof typeof EXPORTS;
    const definition = EXPORTS[dataset];
    if (!definition) return badRequest(res, 'Unknown export');
    // Each dataset is gated by the permission that governs its own page, so an
    // export can never become a way around a role.
    if (!hasPermission(admin(req).permissions, definition.permission)) return res.status(403).json({ error: 'This platform role cannot export that dataset', requires: [definition.permission] });
    const period = range(req.query.period);
    const rows = await exportRows(dataset, period);
    await audit(req, { action: 'DATA_EXPORTED', targetType: 'export', targetId: dataset, previousValue: null, newValue: { rows: rows.length, period: period.name }, reason: `Exported ${dataset} as CSV` });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename(dataset)}"`);
    res.send(toCsv(definition.columns as any, rows as any));
});

export default router;
