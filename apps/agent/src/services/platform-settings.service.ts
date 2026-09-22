/**
 * The platform settings registry.
 *
 * Operational configuration used to live in environment variables, which meant a
 * price change or a maintenance window was a redeploy. Every runtime knob is
 * declared here instead: the console renders the catalog, writes land in
 * `PlatformSetting` with an audit entry, and callers read through `settingValue`
 * so an unset key falls back to the declared default rather than `undefined`.
 */
import { PlatformSetting, SETTING_CATEGORIES, SettingCategory } from '../models/PlatformSetting';

export type SettingType = 'boolean' | 'number' | 'string' | 'text' | 'select' | 'list' | 'json';
export { SETTING_CATEGORIES };
export type { SettingCategory };

export interface SettingDefinition {
    key: string;
    label: string;
    description: string;
    category: SettingCategory;
    group: string;
    type: SettingType;
    default: unknown;
    options?: string[];
    unit?: string;
    /** Shown in the console but never echoed back once written. */
    secret?: boolean;
}

const define = (definitions: SettingDefinition[]) => definitions;

export const SETTING_REGISTRY = define([
    // Platform & access
    { key: 'platform.name', label: 'Platform name', description: 'Product name used in merchant-facing copy and email.', category: 'platform', group: 'Identity', type: 'string', default: 'SellPilot' },
    { key: 'platform.support_email', label: 'Support email', description: 'Address merchants are told to contact.', category: 'platform', group: 'Identity', type: 'string', default: 'support@sellpilot.app' },
    { key: 'platform.status_page_url', label: 'Status page URL', description: 'Linked from the merchant dashboard during incidents.', category: 'platform', group: 'Identity', type: 'string', default: '' },
    { key: 'platform.maintenance_mode', label: 'Maintenance mode', description: 'Merchant and public API requests return a maintenance response. The admin console stays reachable.', category: 'platform', group: 'Availability', type: 'boolean', default: false },
    { key: 'platform.maintenance_message', label: 'Maintenance message', description: 'Shown to merchants while maintenance mode is on.', category: 'platform', group: 'Availability', type: 'text', default: 'SellPilot is briefly unavailable for scheduled maintenance. Please try again shortly.' },
    { key: 'platform.signup_enabled', label: 'Self-serve signup', description: 'Allow new merchants to create an account without an invitation.', category: 'platform', group: 'Availability', type: 'boolean', default: true },
    { key: 'platform.signup_blocked_message', label: 'Signup blocked message', description: 'Returned when self-serve signup is closed.', category: 'platform', group: 'Availability', type: 'text', default: 'New workspaces are currently invitation only.' },

    // Localization & tax
    { key: 'localization.base_currency', label: 'Base currency', description: 'Currency all revenue reporting is normalised to.', category: 'localization', group: 'Currency', type: 'string', default: 'BDT' },
    { key: 'localization.enabled_currencies', label: 'Enabled currencies', description: 'Currencies merchants can be billed in, with the FX rate applied against the base currency.', category: 'localization', group: 'Currency', type: 'json', default: [{ code: 'BDT', symbol: '৳', rate: 1, rounding: 0 }, { code: 'USD', symbol: '$', rate: 0.0085, rounding: 2 }] },
    { key: 'localization.default_locale', label: 'Default locale', description: 'Locale new workspaces start in.', category: 'localization', group: 'Locale', type: 'select', options: ['bn', 'en'], default: 'bn' },
    { key: 'localization.supported_locales', label: 'Supported locales', description: 'Locales the merchant dashboard and agent can operate in.', category: 'localization', group: 'Locale', type: 'list', default: ['bn', 'en'] },
    { key: 'localization.default_timezone', label: 'Default timezone', description: 'Timezone used for new workspaces and scheduled reporting.', category: 'localization', group: 'Locale', type: 'string', default: 'Asia/Dhaka' },
    { key: 'localization.tax_enabled', label: 'Apply tax', description: 'Add tax to platform invoices using the rules below.', category: 'localization', group: 'Tax', type: 'boolean', default: false },
    { key: 'localization.tax_rules', label: 'Tax rules', description: 'Per-region tax rates applied to platform invoices.', category: 'localization', group: 'Tax', type: 'json', default: [{ region: 'BD', label: 'VAT', ratePercent: 15, inclusive: false }] },
    { key: 'localization.invoice_footer', label: 'Invoice footer', description: 'Legal text printed on platform invoices.', category: 'localization', group: 'Tax', type: 'text', default: '' },

    // Billing
    { key: 'billing.invoice_prefix', label: 'Invoice prefix', description: 'Prefix for newly issued invoice numbers.', category: 'billing', group: 'Invoicing', type: 'string', default: 'SP' },
    { key: 'billing.invoice_start_number', label: 'Invoice start number', description: 'Sequence the next invoice number continues from.', category: 'billing', group: 'Invoicing', type: 'number', default: 1000 },
    { key: 'billing.grace_period_days', label: 'Past-due grace period', description: 'Days a past-due subscription keeps working before AI access is suspended.', category: 'billing', group: 'Collection', type: 'number', default: 5, unit: 'days' },
    { key: 'billing.dunning_retry_days', label: 'Dunning retries', description: 'Days after a failed charge that a retry is attempted.', category: 'billing', group: 'Collection', type: 'list', default: ['1', '3', '7'] },
    { key: 'billing.auto_suspend_on_past_due', label: 'Auto-suspend on past due', description: 'Suspend AI access automatically once the grace period ends.', category: 'billing', group: 'Collection', type: 'boolean', default: true },
    { key: 'billing.refund_window_days', label: 'Refund window', description: 'How long after payment an operator may refund without an override.', category: 'billing', group: 'Collection', type: 'number', default: 30, unit: 'days' },
    { key: 'billing.manual_payments_enabled', label: 'Manual payments', description: 'Allow operators to record bank transfers and cash payments.', category: 'billing', group: 'Collection', type: 'boolean', default: true },

    // Subscription policy
    { key: 'subscription.default_plan_slug', label: 'Default plan', description: 'Plan a new workspace is placed on.', category: 'subscription', group: 'Lifecycle', type: 'string', default: 'free-trial' },
    { key: 'subscription.default_trial_days', label: 'Default trial length', description: 'Trial length when the plan does not declare one.', category: 'subscription', group: 'Lifecycle', type: 'number', default: 14, unit: 'days' },
    { key: 'subscription.allow_self_serve', label: 'Self-serve plan changes', description: 'Let merchants start a plan change from their billing page.', category: 'subscription', group: 'Lifecycle', type: 'boolean', default: true },
    { key: 'subscription.allow_plan_downgrade', label: 'Allow downgrades', description: 'Let merchants move to a cheaper plan without an operator.', category: 'subscription', group: 'Lifecycle', type: 'boolean', default: false },
    { key: 'subscription.proration_enabled', label: 'Prorate plan changes', description: 'Charge the difference for the remainder of the period.', category: 'subscription', group: 'Lifecycle', type: 'boolean', default: true },
    { key: 'subscription.cancel_behavior', label: 'Cancellation behaviour', description: 'Whether a cancellation ends access immediately or at period end.', category: 'subscription', group: 'Lifecycle', type: 'select', options: ['end_of_period', 'immediate'], default: 'end_of_period' },

    // AI
    { key: 'ai.primary_model', label: 'Model override', description: 'Model used for merchant conversations, on the provider the deployment is configured with. Leave empty to use the model from the environment.', category: 'ai', group: 'Routing', type: 'string', default: '' },
    { key: 'ai.max_output_tokens', label: 'Max output tokens', description: 'Ceiling on a single generated reply. 0 uses the deployment value.', category: 'ai', group: 'Routing', type: 'number', default: 0, unit: 'tokens' },
    { key: 'ai.default_monthly_request_limit', label: 'Default monthly requests', description: 'Per-tenant request allowance when the plan and the tenant both set none. 0 means unlimited.', category: 'ai', group: 'Quotas', type: 'number', default: 0 },
    { key: 'ai.default_monthly_token_limit', label: 'Default monthly tokens', description: 'Per-tenant token allowance when the plan and the tenant both set none. 0 means unlimited.', category: 'ai', group: 'Quotas', type: 'number', default: 0 },
    { key: 'ai.usage_warning_percent', label: 'Usage warning threshold', description: 'Share of the allowance at which a tenant is warned.', category: 'ai', group: 'Quotas', type: 'number', default: 80, unit: '%' },
    { key: 'ai.monthly_cost_ceiling_usd', label: 'Monthly cost ceiling', description: 'Platform-wide estimated AI spend ceiling. 0 disables the ceiling.', category: 'ai', group: 'Quotas', type: 'number', default: 0, unit: 'USD' },
    { key: 'ai.cost_ceiling_behavior', label: 'At the cost ceiling', description: 'Whether reaching the ceiling only alerts operators or suspends AI platform-wide.', category: 'ai', group: 'Quotas', type: 'select', options: ['warn', 'suspend'], default: 'warn' },
    { key: 'ai.vision_enabled', label: 'Image understanding', description: 'Allow the agent to interpret customer images.', category: 'ai', group: 'Capabilities', type: 'boolean', default: true },
    { key: 'ai.human_handoff_enabled', label: 'Human handoff', description: 'Allow the agent to hand a conversation to a human operator.', category: 'ai', group: 'Capabilities', type: 'boolean', default: true },

    // Integrations
    { key: 'integration.facebook_enabled', label: 'Messenger channel', description: 'Offer the Facebook Messenger channel to merchants.', category: 'integration', group: 'Channels', type: 'boolean', default: true },
    { key: 'integration.instagram_enabled', label: 'Instagram channel', description: 'Offer the Instagram channel to merchants.', category: 'integration', group: 'Channels', type: 'boolean', default: false },
    { key: 'integration.whatsapp_enabled', label: 'WhatsApp channel', description: 'Offer the WhatsApp channel to merchants.', category: 'integration', group: 'Channels', type: 'boolean', default: false },
    { key: 'integration.website_enabled', label: 'Website channel', description: 'Offer the embeddable website widget.', category: 'integration', group: 'Channels', type: 'boolean', default: true },
    { key: 'integration.courier_steadfast_enabled', label: 'Steadfast courier', description: 'Offer Steadfast delivery integration.', category: 'integration', group: 'Couriers', type: 'boolean', default: true },
    { key: 'integration.courier_pathao_enabled', label: 'Pathao courier', description: 'Offer Pathao delivery integration.', category: 'integration', group: 'Couriers', type: 'boolean', default: false },
    { key: 'integration.webhook_retry_attempts', label: 'Webhook retries', description: 'Attempts before an inbound webhook job is parked as failed.', category: 'integration', group: 'Delivery', type: 'number', default: 3 },
    { key: 'integration.sandbox_mode', label: 'Sandbox mode', description: 'Route outbound integration calls to provider sandboxes.', category: 'integration', group: 'Delivery', type: 'boolean', default: false },

    // Security
    { key: 'security.admin_ip_allowlist', label: 'Admin IP allowlist', description: 'When set, platform admin sign-in is only accepted from these addresses.', category: 'security', group: 'Admin access', type: 'list', default: [] },
    { key: 'security.admin_login_lockout_attempts', label: 'Admin lockout threshold', description: 'Failed sign-ins before an admin account is locked.', category: 'security', group: 'Admin access', type: 'number', default: 5 },
    { key: 'security.password_min_length', label: 'Minimum password length', description: 'Enforced on merchant and admin password changes.', category: 'security', group: 'Passwords', type: 'number', default: 10 },
    { key: 'security.password_requires_symbol', label: 'Require a symbol', description: 'Require a non-alphanumeric character in passwords.', category: 'security', group: 'Passwords', type: 'boolean', default: false },
    { key: 'security.audit_retention_days', label: 'Audit retention', description: 'How long platform audit entries are kept. 0 keeps them indefinitely.', category: 'security', group: 'Retention', type: 'number', default: 0, unit: 'days' },

    // Compliance
    { key: 'compliance.retention_conversations_days', label: 'Conversation retention', description: 'Days customer conversations are kept. 0 keeps them indefinitely.', category: 'compliance', group: 'Retention', type: 'number', default: 0, unit: 'days' },
    { key: 'compliance.retention_error_logs_days', label: 'Error log retention', description: 'Days error logs are kept.', category: 'compliance', group: 'Retention', type: 'number', default: 90, unit: 'days' },
    { key: 'compliance.retention_ai_usage_days', label: 'AI usage retention', description: 'Days per-request AI usage rows are kept.', category: 'compliance', group: 'Retention', type: 'number', default: 365, unit: 'days' },
    { key: 'compliance.deletion_request_sla_hours', label: 'Deletion request SLA', description: 'Hours within which a data deletion request must be completed.', category: 'compliance', group: 'Requests', type: 'number', default: 72, unit: 'hours' },
    { key: 'compliance.tenant_export_enabled', label: 'Tenant data export', description: 'Allow operators to export a tenant’s full dataset.', category: 'compliance', group: 'Requests', type: 'boolean', default: true },
    { key: 'compliance.privacy_policy_url', label: 'Privacy policy URL', description: 'Linked from merchant and public surfaces.', category: 'compliance', group: 'Policies', type: 'string', default: '' },
    { key: 'compliance.terms_url', label: 'Terms of service URL', description: 'Linked from merchant and public surfaces.', category: 'compliance', group: 'Policies', type: 'string', default: '' },
    { key: 'compliance.dpa_url', label: 'Data processing addendum URL', description: 'Provided to enterprise merchants on request.', category: 'compliance', group: 'Policies', type: 'string', default: '' },

    // Notifications
    { key: 'notification.from_name', label: 'Sender name', description: 'From name on transactional email.', category: 'notification', group: 'Sender', type: 'string', default: 'SellPilot' },
    { key: 'notification.from_email', label: 'Sender address', description: 'From address on transactional email.', category: 'notification', group: 'Sender', type: 'string', default: '' },
    { key: 'notification.reply_to', label: 'Reply-to address', description: 'Where merchant replies to transactional email land.', category: 'notification', group: 'Sender', type: 'string', default: '' },
    { key: 'notification.admin_alert_email', label: 'Operator alert address', description: 'Receives platform incident and ceiling alerts.', category: 'notification', group: 'Sender', type: 'string', default: '' },
    { key: 'notification.announcement_email', label: 'Email announcements', description: 'Also deliver dashboard announcements by email.', category: 'notification', group: 'Events', type: 'boolean', default: false },
    { key: 'notification.billing_receipt_email', label: 'Billing receipts', description: 'Email a receipt when a payment is recorded.', category: 'notification', group: 'Events', type: 'boolean', default: true },
    { key: 'notification.usage_warning_email', label: 'Usage warnings', description: 'Email a merchant approaching their allowance.', category: 'notification', group: 'Events', type: 'boolean', default: true },

    // Support
    { key: 'support.enabled', label: 'In-product support', description: 'Show support entry points in the merchant dashboard.', category: 'support', group: 'Channels', type: 'boolean', default: true },
    { key: 'support.chat_url', label: 'Support chat URL', description: 'Opened from the merchant support button.', category: 'support', group: 'Channels', type: 'string', default: '' },
    { key: 'support.onboarding_call_url', label: 'Onboarding call URL', description: 'Offered to new merchants during onboarding.', category: 'support', group: 'Channels', type: 'string', default: '' },
    { key: 'support.response_sla_hours', label: 'Response SLA', description: 'Advertised first-response time.', category: 'support', group: 'Channels', type: 'number', default: 24, unit: 'hours' },
]);

export const REGISTRY_BY_KEY = new Map(SETTING_REGISTRY.map(definition => [definition.key, definition]));

/**
 * Settings are read on request paths that also serve inbound customer messages, so
 * the whole table is memoised briefly rather than fetched per key. A write clears it,
 * which is what makes a console change visible immediately in the same process.
 */
const CACHE_MS = 30_000;
let cache: { values: Map<string, unknown>; expires: number } | null = null;
export function clearSettingCache() { cache = null; }

async function storedValues() {
    if (cache && cache.expires > Date.now()) return cache.values;
    try {
        const rows = await PlatformSetting.collection.find({}, { projection: { key: 1, value: 1 } }).toArray();
        const values = new Map(rows.map(row => [String(row.key), row.value]));
        cache = { values, expires: Date.now() + CACHE_MS };
        return values;
    } catch {
        // Settings are read on the request path. A database that is briefly
        // unreachable must leave every caller on its declared default rather than
        // turning one slow query into a platform-wide failure; retried shortly.
        cache = { values: new Map(), expires: Date.now() + 5_000 };
        return cache.values;
    }
}

/** Coerces a stored value into the shape the definition promises, so a bad write cannot poison a caller. */
function coerce(definition: SettingDefinition, value: unknown): unknown {
    if (value === undefined || value === null || value === '') return definition.default;
    switch (definition.type) {
        case 'boolean': return typeof value === 'boolean' ? value : ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
        case 'number': { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : definition.default; }
        case 'select': return definition.options?.includes(String(value)) ? String(value) : definition.default;
        case 'list': return Array.isArray(value) ? value.map(String) : String(value).split(',').map(entry => entry.trim()).filter(Boolean);
        case 'json': return typeof value === 'object' ? value : safeJson(value, definition.default);
        default: return String(value);
    }
}

function safeJson(value: unknown, fallback: unknown) {
    try { return JSON.parse(String(value)); } catch { return fallback; }
}

/**
 * The last known value, read synchronously.
 *
 * Model selection happens while a customer's turn is being built, where an await
 * on the settings table would put a database round trip in front of every reply.
 * This reads whatever the cache already holds and otherwise returns the declared
 * default — so a cold cache behaves exactly like an unset setting. `warmSettingCache`
 * runs at boot and after each write, and the request path keeps it warm.
 */
export function cachedSetting<T = unknown>(key: string): T {
    const definition = REGISTRY_BY_KEY.get(key);
    if (!definition) return undefined as T;
    return coerce(definition, cache?.values.get(key)) as T;
}

/** Repopulates the cache immediately, so a synchronous reader is never left behind a write. */
export async function warmSettingCache() {
    clearSettingCache();
    await storedValues();
}

export async function settingValue<T = unknown>(key: string): Promise<T> {
    const definition = REGISTRY_BY_KEY.get(key);
    if (!definition) return undefined as T;
    return coerce(definition, (await storedValues()).get(key)) as T;
}

export const settingFlag = (key: string) => settingValue<boolean>(key);
export const settingNumber = (key: string) => settingValue<number>(key);
export const settingText = (key: string) => settingValue<string>(key);

/** Every registry key with its effective value, for the console and for bulk consumers. */
export async function effectiveSettings() {
    const stored = await storedValues();
    return SETTING_REGISTRY.map(definition => ({
        ...definition,
        value: coerce(definition, stored.get(definition.key)),
        isDefault: !stored.has(definition.key),
    }));
}

/** Validates a console write against the registry before it reaches the database. */
export type SettingWriteCheck = { ok: false; error: string } | { ok: true; definition: SettingDefinition; value: unknown };

export function validateSettingWrite(key: string, value: unknown): SettingWriteCheck {
    const definition = REGISTRY_BY_KEY.get(key);
    if (!definition) return { ok: false, error: 'Unknown setting key' };
    if (definition.type === 'number' && !Number.isFinite(Number(value))) return { ok: false, error: 'This setting expects a number' };
    if (definition.type === 'boolean' && typeof value !== 'boolean') return { ok: false, error: 'This setting expects true or false' };
    if (definition.type === 'select' && !definition.options?.includes(String(value))) return { ok: false, error: `Allowed values: ${definition.options?.join(', ')}` };
    if (definition.type === 'list' && !Array.isArray(value)) return { ok: false, error: 'This setting expects a list' };
    if (definition.type === 'json' && (typeof value !== 'object' || value === null)) return { ok: false, error: 'This setting expects a JSON object or array' };
    return { ok: true, definition, value: coerce(definition, value) };
}
