import { sendEmail } from '../services/notification.service';

function dashboardUrl() {
    return String(process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function sendVerificationEmail(email: string, token: string) {
    const url = `${dashboardUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    return sendEmail(
        [email],
        'Verify your SellPilot email',
        `Verify your SellPilot email address: ${url}\n\nThis link expires in 24 hours.`,
        `<p>Verify your SellPilot email address:</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`
    );
}

export function sendPasswordResetEmail(email: string, token: string) {
    const url = `${dashboardUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    return sendEmail(
        [email],
        'Reset your SellPilot password',
        `Reset your SellPilot password: ${url}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
        `<p>Reset your SellPilot password:</p><p><a href="${url}">Reset password</a></p><p>This link expires in 1 hour. If you did not request it, ignore this email.</p>`
    );
}
