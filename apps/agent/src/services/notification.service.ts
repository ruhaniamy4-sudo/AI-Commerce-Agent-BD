import nodemailer from 'nodemailer';

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function getEmailConfiguration(env: Environment = process.env) {
    const user = String(env.EMAIL_USER || '').trim();
    const password = String(env.EMAIL_PASS || '').replace(/\s/g, '');
    const host = String(env.EMAIL_HOST || '').trim();
    const port = Number(env.EMAIL_PORT || 587);
    const secure = String(env.EMAIL_SECURE || '').toLowerCase() === 'true' || port === 465;
    const service = String(env.EMAIL_SERVICE || (host ? '' : 'gmail')).trim();
    const credentialsPresent = Boolean(user && password && (service || host));
    const gmailAppPasswordValid = service.toLowerCase() !== 'gmail' || password.length === 16;
    return {
        configured: credentialsPresent && gmailAppPasswordValid,
        issue: !credentialsPresent
            ? 'Email credentials are missing.'
            : !gmailAppPasswordValid
              ? 'Gmail requires a 16-character App Password; a normal Google Account password cannot be used.'
              : undefined,
        user,
        password,
        from: String(env.EMAIL_FROM || user).trim(),
        service,
        host,
        port,
        secure,
    };
}

export const sendEmail = async (to: string[], subject: string, text: string, html?: string) => {
    try {
        const config = getEmailConfiguration();
        if (!config.configured) {
            console.warn(config.issue || 'Email delivery is not configured.');
            return false;
        }

        const transporter = nodemailer.createTransport(config.host ? {
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: { user: config.user, pass: config.password },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
        } : {
            service: config.service,
            auth: { user: config.user, pass: config.password },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
        });
        const info = await transporter.sendMail({
            from: config.from,
            to: to.join(', '),
            subject,
            text,
            html,
        });
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error('Error sending email:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: typeof error?.code === 'string' ? error.code : undefined,
            command: typeof error?.command === 'string' ? error.command : undefined,
        });
        return false;
    }
};
