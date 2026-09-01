import dotenv from 'dotenv';
import { getEmailConfiguration, sendEmail } from '../services/notification.service';

dotenv.config();

async function main() {
    const config = getEmailConfiguration();
    const recipient = String(process.argv[2] || config.user).trim();
    if (!config.configured) throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS first.');
    if (!recipient) throw new Error('Pass a recipient email address to the command.');

    const sent = await sendEmail(
        [recipient],
        'SellPilot email delivery test',
        'SellPilot email delivery is configured correctly.',
        '<p><strong>SellPilot email delivery is configured correctly.</strong></p>',
    );
    if (!sent) throw new Error('Test email was not accepted. Check the SMTP error above.');
    console.log('Test email accepted by the email provider.');
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
