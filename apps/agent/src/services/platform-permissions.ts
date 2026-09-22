/**
 * One permission matrix, read by three things: the API that authorises a request,
 * the `GET /platform-admin/me` payload the console builds its navigation from, and
 * the buttons inside a page. Adding a capability in one place is what stops the
 * console offering an action the API will refuse.
 */
import type { NextFunction, Response } from 'express';
import type { PlatformAdminAuthenticatedRequest } from '../auth/middleware';

export const PLATFORM_PERMISSIONS = [
    'dashboard.view',
    'merchants.view', 'merchants.manage', 'merchants.impersonate', 'merchants.delete',
    'users.view', 'users.manage',
    'billing.view', 'billing.manage', 'plans.manage', 'coupons.manage', 'subscriptions.manage',
    'ai.view', 'ai.manage', 'prompts.manage',
    'integrations.view', 'integrations.manage',
    'ops.view', 'ops.manage',
    'catalog.view',
    'audit.view',
    'compliance.view', 'compliance.manage',
    'settings.view', 'settings.manage', 'flags.manage',
    'team.view', 'team.manage',
    'announcements.manage',
] as const;
export type PlatformPermission = typeof PLATFORM_PERMISSIONS[number];

export const PLATFORM_ADMIN_ROLES = ['OWNER', 'ADMIN', 'FINANCE', 'SUPPORT', 'ENGINEER', 'ANALYST'] as const;
export type PlatformAdminRole = typeof PLATFORM_ADMIN_ROLES[number];

const READ_ONLY = PLATFORM_PERMISSIONS.filter(permission => permission.endsWith('.view'));

/** `OWNER` carries the wildcard rather than a list, so a new permission is never missing from it. */
export const ROLE_PERMISSIONS: Record<PlatformAdminRole, readonly string[]> = {
    OWNER: ['*'],
    ADMIN: PLATFORM_PERMISSIONS.filter(permission => !['team.manage', 'merchants.delete', 'compliance.manage'].includes(permission)),
    FINANCE: ['dashboard.view', 'merchants.view', 'users.view', 'billing.view', 'billing.manage', 'plans.manage', 'coupons.manage', 'subscriptions.manage', 'catalog.view', 'audit.view', 'settings.view'],
    SUPPORT: ['dashboard.view', 'merchants.view', 'merchants.manage', 'merchants.impersonate', 'users.view', 'users.manage', 'ai.view', 'billing.view', 'integrations.view', 'ops.view', 'catalog.view', 'announcements.manage', 'compliance.view', 'settings.view'],
    ENGINEER: ['dashboard.view', 'merchants.view', 'ai.view', 'ai.manage', 'prompts.manage', 'integrations.view', 'integrations.manage', 'ops.view', 'ops.manage', 'catalog.view', 'audit.view', 'settings.view', 'settings.manage', 'flags.manage', 'compliance.view'],
    ANALYST: READ_ONLY,
};

export const ROLE_DESCRIPTIONS: Record<PlatformAdminRole, string> = {
    OWNER: 'Full control, including the admin team and tenant erasure.',
    ADMIN: 'Senior operator. Everything except admin-team changes and tenant erasure.',
    FINANCE: 'Billing, plans, coupons, subscriptions, revenue, tax and currency.',
    SUPPORT: 'Tenant and user operations, impersonation, announcements, read-only operations.',
    ENGINEER: 'Health, jobs, integrations, AI configuration, prompts, feature flags.',
    ANALYST: 'Read-only across the console.',
};

export const isPlatformRole = (value: unknown): value is PlatformAdminRole => PLATFORM_ADMIN_ROLES.includes(String(value) as PlatformAdminRole);

/**
 * Role grants plus any individual extra grants, deduplicated. A wildcard collapses
 * the list.
 *
 * A record with no role at all predates roles, so it resolves to the founding
 * OWNER access it already had — the boot backfill writes that role explicitly. A
 * role that is present but unrecognised is a different thing: something wrote a
 * value this build does not know, and the safe answer there is read-only.
 */
export function permissionsFor(role: string | undefined, extra: string[] = []): string[] {
    const resolved: PlatformAdminRole = !role ? 'OWNER' : isPlatformRole(role) ? role : 'ANALYST';
    const granted = ROLE_PERMISSIONS[resolved];
    if (granted.includes('*')) return ['*'];
    const valid = extra.filter(permission => (PLATFORM_PERMISSIONS as readonly string[]).includes(permission));
    return [...new Set([...granted, ...valid])];
}

export const hasPermission = (held: string[] | undefined, required: PlatformPermission) => Boolean(held?.includes('*') || held?.includes(required));

/**
 * Mount after `authenticatePlatformAdmin`. A missing permission is a 403 carrying the
 * key that was needed, which is what makes a console bug obvious instead of mysterious.
 */
export function requirePlatformPermission(...required: PlatformPermission[]) {
    return (req: PlatformAdminAuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.platformAdmin) return res.status(401).json({ error: 'Platform administrator authentication required' });
        const missing = required.filter(permission => !hasPermission(req.platformAdmin!.permissions, permission));
        if (missing.length) return res.status(403).json({ error: 'This platform role cannot perform that action', requires: missing });
        return next();
    };
}
