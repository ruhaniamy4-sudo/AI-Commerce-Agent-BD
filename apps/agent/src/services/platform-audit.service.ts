import { PlatformAuditLog } from '../models/PlatformAuditLog';

const secretKey = /password|secret|token|credential|api.?key|encryption/i;
export function sanitizeAuditValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sanitizeAuditValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, secretKey.test(key) ? '[redacted]' : sanitizeAuditValue(item)]));
    if (typeof value === 'string') return value.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]').replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted key]');
    return value;
}

export async function writePlatformAudit(params: { platformAdminId:string;action:string;targetType:string;targetId:string;businessId?:string;previousValue?:unknown;newValue?:unknown;reason:string }) {
    return PlatformAuditLog.create({ ...params, previousValue: sanitizeAuditValue(params.previousValue), newValue: sanitizeAuditValue(params.newValue), reason: params.reason.trim().slice(0,500) });
}
