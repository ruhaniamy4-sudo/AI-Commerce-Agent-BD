import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_PERMISSIONS, ROLE_PERMISSIONS, hasPermission, permissionsFor, requirePlatformPermission } from './platform-permissions';
import { SETTING_REGISTRY, clearSettingCache, effectiveSettings, validateSettingWrite, warmSettingCache } from './platform-settings.service';
import { getAIMaxOutputTokens, getAIModel } from './ai-config';
import { getAIConfiguration } from '../config/runtime';
import { PlatformSetting } from '../models/PlatformSetting';
import { couponRejection } from '../models/Coupon';
import { toCsv } from './platform-export.service';
import { FeatureFlag } from '../models/FeatureFlag';
import { Subscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { clearFeatureFlagCache, resolveFeatureFlags } from './feature-flag.service';
import { clearPlanCacheForTests } from './entitlement.service';

const adminId = new mongoose.Types.ObjectId().toString();

describe('the platform permission matrix', () => {
    it('gives the owner everything through the wildcard, so a new permission is never missing from it', () => {
        expect(permissionsFor('OWNER')).toEqual(['*']);
        for (const permission of PLATFORM_PERMISSIONS) expect(hasPermission(['*'], permission)).toBe(true);
    });

    it('keeps a finance operator out of prompts and an engineer out of billing', () => {
        const finance = permissionsFor('FINANCE');
        expect(hasPermission(finance, 'billing.manage')).toBe(true);
        expect(hasPermission(finance, 'prompts.manage')).toBe(false);
        const engineer = permissionsFor('ENGINEER');
        expect(hasPermission(engineer, 'ops.manage')).toBe(true);
        expect(hasPermission(engineer, 'billing.manage')).toBe(false);
    });

    it('leaves the read-only role unable to change anything', () => {
        const analyst = permissionsFor('ANALYST');
        expect(analyst.every(permission => permission.endsWith('.view'))).toBe(true);
    });

    it('reads a record with no role as the founding owner and an unrecognised one as read-only', () => {
        // Administrators created before roles existed must not lose their access,
        // while a value this build does not know is treated as untrusted.
        expect(permissionsFor(undefined)).toEqual(['*']);
        expect(permissionsFor('SUPERUSER')).toEqual(ROLE_PERMISSIONS.ANALYST);
    });

    it('adds individual grants on top of a role but ignores invented ones', () => {
        const granted = permissionsFor('SUPPORT', ['prompts.manage', 'not.a.permission']);
        expect(granted).toContain('prompts.manage');
        expect(granted).not.toContain('not.a.permission');
    });

    it('refuses a request the role cannot make, and says which permission was needed', async () => {
        const app = express()
            .use((req, _res, next) => { (req as any).platformAdmin = { id: adminId, email: 'finance@sellpilot.test', name: 'Finance', role: 'FINANCE', permissions: permissionsFor('FINANCE') }; next(); })
            .get('/prompts', requirePlatformPermission('prompts.manage'), (_req, res) => res.json({ reached: true }))
            .get('/revenue', requirePlatformPermission('billing.view'), (_req, res) => res.json({ reached: true }));
        const refused = await request(app).get('/prompts').expect(403);
        expect(refused.body.requires).toEqual(['prompts.manage']);
        await request(app).get('/revenue').expect(200);
    });
});

describe('the settings registry', () => {
    beforeEach(() => clearSettingCache());
    afterEach(() => { vi.restoreAllMocks(); clearSettingCache(); });

    it('declares a unique key, a group, and a default for every setting', () => {
        const keys = SETTING_REGISTRY.map(definition => definition.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const definition of SETTING_REGISTRY) {
            expect(definition.default).not.toBeUndefined();
            expect(definition.group.length).toBeGreaterThan(0);
            if (definition.type === 'select') expect(definition.options).toContain(String(definition.default));
        }
    });

    it('reports the declared default until something is written, then the stored value', async () => {
        vi.spyOn(PlatformSetting.collection, 'find').mockReturnValue({ toArray: async () => [] } as any);
        const untouched = (await effectiveSettings()).find(row => row.key === 'billing.invoice_prefix');
        expect(untouched).toMatchObject({ value: 'SP', isDefault: true });

        clearSettingCache();
        vi.mocked(PlatformSetting.collection.find).mockReturnValue({ toArray: async () => [{ key: 'billing.invoice_prefix', value: 'ACME' }] } as any);
        const written = (await effectiveSettings()).find(row => row.key === 'billing.invoice_prefix');
        expect(written).toMatchObject({ value: 'ACME', isDefault: false });
    });

    it('falls back to declared defaults when the database cannot be reached, instead of failing the request', async () => {
        vi.spyOn(PlatformSetting.collection, 'find').mockImplementation(() => { throw new Error('connection refused'); });
        const rows = await effectiveSettings();
        expect(rows.find(row => row.key === 'platform.maintenance_mode')).toMatchObject({ value: false });
    });

    it('refuses a write that does not match the declared type', () => {
        expect(validateSettingWrite('platform.maintenance_mode', 'yes')).toMatchObject({ ok: false });
        expect(validateSettingWrite('billing.grace_period_days', 'soon')).toMatchObject({ ok: false });
        expect(validateSettingWrite('subscription.cancel_behavior', 'whenever')).toMatchObject({ ok: false });
        expect(validateSettingWrite('nonexistent.key', 1)).toMatchObject({ ok: false, error: 'Unknown setting key' });
    });

    it('accepts and normalises a valid write', () => {
        expect(validateSettingWrite('billing.grace_period_days', '7')).toMatchObject({ ok: true, value: 7 });
        expect(validateSettingWrite('localization.supported_locales', ['bn', 'en'])).toMatchObject({ ok: true, value: ['bn', 'en'] });
        expect(validateSettingWrite('platform.maintenance_mode', true)).toMatchObject({ ok: true, value: true });
    });
});

describe('coupon eligibility', () => {
    const base = { enabled: true, maxRedemptions: 0, redemptions: 0, planSlugs: [] as string[], validFrom: undefined, validUntil: undefined };

    it('accepts a code that is enabled, in window, and within its cap', () => {
        expect(couponRejection(base)).toBeNull();
    });

    it('explains every reason a code cannot be redeemed', () => {
        const now = new Date('2026-06-01T00:00:00Z');
        expect(couponRejection({ ...base, enabled: false }, undefined, now)).toMatch(/disabled/);
        expect(couponRejection({ ...base, validFrom: new Date('2026-07-01') }, undefined, now)).toMatch(/not active yet/);
        expect(couponRejection({ ...base, validUntil: new Date('2026-05-01') }, undefined, now)).toMatch(/expired/);
        expect(couponRejection({ ...base, maxRedemptions: 5, redemptions: 5 }, undefined, now)).toMatch(/redemption limit/);
        expect(couponRejection({ ...base, planSlugs: ['growth'] }, 'starter', now)).toMatch(/does not apply/);
        expect(couponRejection({ ...base, planSlugs: ['growth'] }, 'growth', now)).toBeNull();
    });
});

describe('csv export', () => {
    it('quotes separators and doubles embedded quotes so one merchant name cannot shift a column', () => {
        const csv = toCsv([{ header: 'Name', path: 'name' }, { header: 'Note', path: 'note' }], [
            { name: 'Rahim, Karim & Co', note: 'said "on hold"' },
            { name: 'Line\nbreak', note: '' },
        ]);
        const [, first, second] = csv.split('\r\n');
        expect(first).toBe('"Rahim, Karim & Co","said ""on hold"""');
        expect(second).toBe('"Line\nbreak",');
    });

    it('starts with a byte order mark, so Bangla names survive being opened in a spreadsheet', () => {
        expect(toCsv([{ header: 'Name', path: 'name' }], [{ name: 'সেলপাইলট' }]).startsWith('﻿')).toBe(true);
    });

    it('reads a nested path and leaves a missing one empty rather than printing undefined', () => {
        const csv = toCsv([{ header: 'AI', path: 'aiAccess.status' }], [{ aiAccess: { status: 'ENABLED' } }, {}]);
        expect(csv.split('\r\n').slice(1)).toEqual(['ENABLED', '']);
    });
});

describe('feature flag resolution', () => {
    const businesses = Array.from({ length: 400 }, () => new mongoose.Types.ObjectId().toString());
    const flagRows = (rows: Array<Record<string, unknown>>) => vi.spyOn(FeatureFlag.collection, 'find').mockReturnValue({ toArray: async () => rows } as any);

    beforeEach(() => { clearFeatureFlagCache(); clearPlanCacheForTests(); });
    afterEach(() => { vi.restoreAllMocks(); clearFeatureFlagCache(); clearPlanCacheForTests(); });

    it('keeps a workspace on the same side of a percentage split between reads', async () => {
        flagRows([{ key: 'agent.auto_training', enabled: true, rolloutPercent: 25, planSlugs: [], businessIds: [] }]);
        vi.spyOn(Subscription, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) } as any);
        const first = await Promise.all(businesses.map(id => resolveFeatureFlags(id)));
        clearFeatureFlagCache();
        clearPlanCacheForTests();
        const second = await Promise.all(businesses.map(id => resolveFeatureFlags(id)));
        expect(second).toEqual(first);
        // A 25% rollout across 400 workspaces should land near a quarter, not at 0 or all.
        const enabled = first.filter(flags => flags['agent.auto_training']).length;
        expect(enabled).toBeGreaterThan(40);
        expect(enabled).toBeLessThan(160);
    });

    it('lets the kill switch override an enabled flag and an explicit workspace override', async () => {
        const [target] = businesses;
        flagRows([{ key: 'channel.whatsapp', enabled: true, rolloutPercent: 100, planSlugs: [], businessIds: [new mongoose.Types.ObjectId(target)], killSwitch: true }]);
        vi.spyOn(Subscription, 'findOne').mockReturnValue({ select: () => ({ lean: async () => null }) } as any);
        expect((await resolveFeatureFlags(target))['channel.whatsapp']).toBe(false);
    });

    it('gates a flag on plan, and lets a workspace override outrank the plan scope', async () => {
        const [scoped, overridden] = businesses;
        flagRows([{ key: 'commerce.store_builder', enabled: true, rolloutPercent: 100, planSlugs: ['growth'], businessIds: [new mongoose.Types.ObjectId(overridden)] }]);
        vi.spyOn(Subscription, 'findOne').mockReturnValue({ select: () => ({ lean: async () => ({ planSlug: 'starter' }) }) } as any);
        vi.spyOn(SubscriptionPlan, 'findOne').mockReturnValue({ lean: async () => ({ slug: 'starter' }) } as any);
        expect((await resolveFeatureFlags(scoped))['commerce.store_builder']).toBe(false);
        expect((await resolveFeatureFlags(overridden))['commerce.store_builder']).toBe(true);
    });
});

describe('operator overrides on the model path', () => {
    beforeEach(() => clearSettingCache());
    afterEach(() => { vi.restoreAllMocks(); clearSettingCache(); });

    const stored = (rows: Array<{ key: string; value: unknown }>) => vi.spyOn(PlatformSetting.collection, 'find').mockReturnValue({ toArray: async () => rows } as any);

    it('uses the deployment model until an operator names one', async () => {
        stored([]);
        await warmSettingCache();
        expect(getAIModel()).toBe(getAIConfiguration().model);

        stored([{ key: 'ai.primary_model', value: 'llama-3.1-8b-instant' }]);
        await warmSettingCache();
        expect(getAIModel()).toBe('llama-3.1-8b-instant');
    });

    it('treats a blank override as no override, so clearing the field restores the deployment model', async () => {
        stored([{ key: 'ai.primary_model', value: '   ' }]);
        await warmSettingCache();
        expect(getAIModel()).toBe(getAIConfiguration().model);
    });

    it('reads a cold cache as an unset setting rather than as an empty model', () => {
        clearSettingCache();
        expect(getAIModel()).toBe(getAIConfiguration().model);
        expect(getAIMaxOutputTokens()).toBeGreaterThan(0);
    });

    it('clamps an operator reply ceiling into the supported range and ignores zero', async () => {
        stored([{ key: 'ai.max_output_tokens', value: 99999 }]);
        await warmSettingCache();
        expect(getAIMaxOutputTokens()).toBe(2000);

        stored([{ key: 'ai.max_output_tokens', value: 0 }]);
        await warmSettingCache();
        expect(getAIMaxOutputTokens()).toBe(500);
    });
});
