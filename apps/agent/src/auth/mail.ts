import { sendEmail } from '../services/notification.service';
import { renderNotification } from '../services/notification-template.service';

function dashboardUrl() {
    return String(process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Copy comes from the console's notification templates, with the shipped default as
 * the fallback — so editing the wording never blocks the email, and disabling the
 * template stops it deliberately.
 */
async function send(event: 'email_verification' | 'password_reset', email: string, variables: Record<string, string>) {
    const rendered = await renderNotification(event, variables);
    if (!rendered.enabled) return false;
    return sendEmail([email], rendered.subject, rendered.text, rendered.html);
}

export function sendVerificationEmail(email: string, token: string) {
    return send('email_verification', email, { actionUrl: `${dashboardUrl()}/verify-email?token=${encodeURIComponent(token)}`, expiresIn: '24 hours' });
}

export function sendPasswordResetEmail(email: string, token: string) {
    return send('password_reset', email, { actionUrl: `${dashboardUrl()}/reset-password?token=${encodeURIComponent(token)}`, expiresIn: '1 hour' });
}
