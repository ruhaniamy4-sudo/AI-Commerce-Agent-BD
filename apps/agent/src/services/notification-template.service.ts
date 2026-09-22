/**
 * Transactional copy, resolved at send time.
 *
 * Wording used to be compiled into the code, so changing a verification email was a
 * release. Templates now come from the console when one exists for the event and
 * locale, and fall back to the shipped default otherwise — so an operator editing
 * copy can never leave the platform unable to send.
 */
import { DEFAULT_NOTIFICATION_TEMPLATES, NotificationEvent, NotificationTemplate } from '../models/NotificationTemplate';
import { settingText } from './platform-settings.service';

const CACHE_MS = 30_000;
let cache: { rows: Array<{ event: string; locale: string; subject: string; body: string; enabled: boolean }>; expires: number } | null = null;
export function clearNotificationTemplateCache() { cache = null; }

async function templates() {
    if (cache && cache.expires > Date.now()) return cache.rows;
    const rows = await NotificationTemplate.collection.find({}, { projection: { event: 1, locale: 1, subject: 1, body: 1, enabled: 1 } }).toArray() as any[];
    cache = { rows, expires: Date.now() + CACHE_MS };
    return cache.rows;
}

const interpolate = (text: string, variables: Record<string, string>) => text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');

/** Plain text becomes paragraphs; a template author never has to write HTML. */
const asHtml = (text: string) => text.split(/\n{2,}/).map(block => `<p>${block.replace(/\n/g, '<br/>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('');

export interface RenderedNotification { subject: string; text: string; html: string; enabled: boolean }

export async function renderNotification(event: NotificationEvent, variables: Record<string, string> = {}, locale = 'en'): Promise<RenderedNotification> {
    const rows = await templates();
    const stored = rows.find(row => row.event === event && row.locale === locale) || rows.find(row => row.event === event && row.locale === 'en');
    const fallback = DEFAULT_NOTIFICATION_TEMPLATES.find(row => row.event === event);
    const subject = stored?.subject || fallback?.subject || '';
    const body = stored?.body || fallback?.body || '';
    const values = { platformName: await settingText('platform.name'), supportEmail: await settingText('platform.support_email'), ...variables };
    const text = interpolate(body, values);
    return { subject: interpolate(subject, values), text, html: asHtml(text), enabled: stored ? stored.enabled : true };
}

/** Called when the console opens the templates page, so the catalog is never empty. */
export async function ensureDefaultNotificationTemplates() {
    if (await NotificationTemplate.collection.countDocuments({})) return;
    await NotificationTemplate.collection.insertMany(DEFAULT_NOTIFICATION_TEMPLATES.map(template => ({ ...template, enabled: true, createdAt: new Date(), updatedAt: new Date() })));
    clearNotificationTemplateCache();
}
