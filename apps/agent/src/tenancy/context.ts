import { AsyncLocalStorage } from 'node:async_hooks';

export const BUSINESS_ROLES = ['Owner', 'Admin', 'Staff'] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export interface TenantPrincipal {
    userId: string;
    businessId: string;
    membershipId: string;
    role: BusinessRole;
    sessionId?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantPrincipal>();

export class TenantContextError extends Error {
    constructor(message = 'A tenant context is required for this operation') {
        super(message);
        this.name = 'TenantContextError';
    }
}

export function getTenantContext(): TenantPrincipal | undefined {
    return tenantStorage.getStore();
}

export function requireTenantContext(): TenantPrincipal {
    const context = getTenantContext();
    if (!context) throw new TenantContextError();
    return context;
}

export function assertTenantBusinessId(businessId: string, stage: string): string {
    const context = requireTenantContext();
    if (!businessId || businessId !== context.businessId) {
        throw new TenantContextError(`Tenant context mismatch at ${stage}`);
    }
    return context.businessId;
}

export function withTenantContext<T>(context: TenantPrincipal, work: () => T): T {
    return tenantStorage.run(context, work);
}

export function enterTenantContext(context: TenantPrincipal): void {
    tenantStorage.enterWith(context);
}

export function tenantFilter<T extends Record<string, unknown>>(filter: T = {} as T) {
    return { ...filter, businessId: requireTenantContext().businessId };
}

export function tenantDocument<T extends Record<string, unknown>>(document: T) {
    const businessId = requireTenantContext().businessId;
    const suppliedBusinessId = document.businessId?.toString();
    if (suppliedBusinessId && suppliedBusinessId !== businessId) {
        throw new TenantContextError('Cannot write data for another business');
    }
    return { ...document, businessId };
}
