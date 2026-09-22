import mongoose, { Document, Schema } from 'mongoose';

export const NOTIFICATION_EVENTS = ['email_verification', 'password_reset', 'announcement', 'billing_receipt', 'usage_warning', 'subscription_expiring', 'welcome'] as const;
export type NotificationEvent = typeof NOTIFICATION_EVENTS[number];

export interface INotificationTemplate extends Document {
    event: NotificationEvent;
    locale: string;
    subject: string;
    body: string;
    enabled: boolean;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>({
    event: { type: String, enum: [...NOTIFICATION_EVENTS], required: true },
    locale: { type: String, default: 'en', lowercase: true, trim: true, maxlength: 8 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 6000 },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin' },
}, { timestamps: true });

// One template per event and locale, so a lookup is a single deterministic hit.
NotificationTemplateSchema.index({ event: 1, locale: 1 }, { unique: true });
export const NotificationTemplate = mongoose.model<INotificationTemplate>('NotificationTemplate', NotificationTemplateSchema);

/** The variables each event can interpolate, surfaced in the console so an operator is not guessing. */
export const NOTIFICATION_VARIABLES: Record<NotificationEvent, string[]> = {
    email_verification: ['platformName', 'actionUrl', 'expiresIn'],
    password_reset: ['platformName', 'actionUrl', 'expiresIn'],
    announcement: ['platformName', 'businessName', 'title', 'body'],
    billing_receipt: ['platformName', 'businessName', 'amount', 'currency', 'invoiceNumber', 'paidAt'],
    usage_warning: ['platformName', 'businessName', 'usedPercent', 'limit', 'resetsOn'],
    subscription_expiring: ['platformName', 'businessName', 'plan', 'expiresOn', 'billingUrl'],
    welcome: ['platformName', 'businessName', 'dashboardUrl', 'supportEmail'],
};

export const DEFAULT_NOTIFICATION_TEMPLATES: Array<Pick<INotificationTemplate, 'event' | 'locale' | 'subject' | 'body'>> = [
    { event: 'email_verification', locale: 'en', subject: 'Verify your {{platformName}} email', body: 'Verify your {{platformName}} email address: {{actionUrl}}\n\nThis link expires in {{expiresIn}}.' },
    { event: 'password_reset', locale: 'en', subject: 'Reset your {{platformName}} password', body: 'Reset your {{platformName}} password: {{actionUrl}}\n\nThis link expires in {{expiresIn}}. If you did not request it, ignore this email.' },
    { event: 'announcement', locale: 'en', subject: '{{title}}', body: '{{body}}\n\n— The {{platformName}} team' },
    { event: 'billing_receipt', locale: 'en', subject: 'Your {{platformName}} receipt {{invoiceNumber}}', body: 'We received {{amount}} {{currency}} for {{businessName}} on {{paidAt}}.\n\nInvoice {{invoiceNumber}}.' },
    { event: 'usage_warning', locale: 'en', subject: '{{businessName}} is near its {{platformName}} allowance', body: '{{businessName}} has used {{usedPercent}}% of its monthly allowance of {{limit}}. It resets on {{resetsOn}}.' },
    { event: 'subscription_expiring', locale: 'en', subject: 'Your {{platformName}} plan expires on {{expiresOn}}', body: '{{businessName}} is on {{plan}}, which expires on {{expiresOn}}. Renew from {{billingUrl}}.' },
    { event: 'welcome', locale: 'en', subject: 'Welcome to {{platformName}}', body: 'Welcome, {{businessName}}. Open your dashboard at {{dashboardUrl}}. Questions go to {{supportEmail}}.' },
] as const as Array<Pick<INotificationTemplate, 'event' | 'locale' | 'subject' | 'body'>>;
