/** Request-shaping helpers shared by the platform admin routers. */
import mongoose from 'mongoose';

export const safeRegex = (value: unknown) => new RegExp(String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80), 'i');
export const objectId = (value: unknown) => mongoose.isValidObjectId(String(value)) ? new mongoose.Types.ObjectId(String(value)) : null;
/** Every audited mutation carries one; an empty string is what route validation rejects. */
export const reason = (value: unknown) => String(value || '').trim().slice(0, 500);
export const pageOf = (req: { query: Record<string, unknown> }) => ({ page: Math.max(1, Number(req.query.page) || 1), limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20)) });
export const monthStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
export const dayStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const boolOf = (value: unknown) => typeof value === 'boolean' ? value : ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
export const stringList = (value: unknown, cap = 50) => (Array.isArray(value) ? value : String(value ?? '').split(',')).map(entry => String(entry).trim()).filter(Boolean).slice(0, cap);
export const objectIdList = (value: unknown, cap = 200) => stringList(value, cap).map(objectId).filter((id): id is mongoose.Types.ObjectId => Boolean(id));
export const dateOf = (value: unknown) => { const parsed = value ? new Date(String(value)) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined; };

/** Shared period windows, so every analytics surface reads the same "last 30 days". */
export function range(value: unknown) {
    const now = new Date();
    const name = String(value || '30d');
    if (name === 'today') return { name, from: dayStart(now), to: now };
    if (name === '7d') return { name, from: new Date(now.getTime() - 7 * 86400000), to: now };
    if (name === 'this_month') return { name, from: monthStart(now), to: now };
    if (name === 'previous_month') return { name, from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: monthStart(now) };
    const months: Record<string, number> = { '3m': 3, '6m': 6, '12m': 12 };
    return { name, from: months[name] ? new Date(now.getFullYear(), now.getMonth() - months[name] + 1, 1) : new Date(now.getTime() - 30 * 86400000), to: now };
}
