import { describe, expect, it } from 'vitest';
import { credentialSignInErrorMessage } from './login-error';

describe('credential sign-in errors', () => {
  it('explains that an unverified account must verify its email', () => {
    expect(credentialSignInErrorMessage('EMAIL_NOT_VERIFIED')).toContain('verify your email');
  });

  it('keeps invalid credentials enumeration-safe', () => {
    expect(credentialSignInErrorMessage('CredentialsSignin')).toBe('Invalid email or password.');
    expect(credentialSignInErrorMessage()).toBe('Invalid email or password.');
  });
});
