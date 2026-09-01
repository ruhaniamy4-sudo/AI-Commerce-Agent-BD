import { describe, expect, it } from 'vitest';
import { getEmailConfiguration } from './notification.service';

describe('email configuration', () => {
    it('configures Gmail and normalizes a copied App Password', () => {
        expect(getEmailConfiguration({
            EMAIL_USER: ' sender@example.com ',
            EMAIL_PASS: 'abcd efgh ijkl mnop',
            EMAIL_SERVICE: 'gmail',
        })).toMatchObject({
            configured: true,
            user: 'sender@example.com',
            password: 'abcdefghijklmnop',
            service: 'gmail',
            host: '',
        });
    });

    it('supports custom SMTP and rejects missing credentials', () => {
        expect(getEmailConfiguration({ EMAIL_HOST: 'smtp.example.com', EMAIL_USER: 'mailer', EMAIL_PASS: 'secret' }))
            .toMatchObject({ configured: true, host: 'smtp.example.com', port: 587, secure: false });
        expect(getEmailConfiguration({ EMAIL_USER: 'sender@example.com' }).configured).toBe(false);
        expect(getEmailConfiguration({ EMAIL_USER: 'sender@example.com', EMAIL_PASS: 'normal-password', EMAIL_SERVICE: 'gmail' }))
            .toMatchObject({ configured: false, issue: expect.stringContaining('App Password') });
    });
});
