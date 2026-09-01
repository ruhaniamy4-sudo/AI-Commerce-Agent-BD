# Authentication security

SellPilot uses short-lived signed access tokens and database-backed opaque refresh sessions.

## Session lifecycle

- Merchant and pre-onboarding account access tokens expire after 15 minutes.
- Refresh sessions expire after 7 days and are stored only as SHA-256 token hashes.
- Every refresh rotates both the refresh token and session identifier.
- Reuse of an already rotated token is treated as replay and revokes the full token family.
- Logout revokes the refresh session. Password reset or password change revokes every session for the user.
- Access-token authentication checks the backing session, active user, active membership, role, and active business.

Legacy access tokens without a session identifier remain accepted until their existing expiry so deployment does not abruptly invalidate all signed-in merchants.

## Email verification and password recovery

Signup creates a one-time email verification token valid for 24 hours. Password reset tokens are valid for 1 hour. Only hashes are stored, issuing a new token invalidates earlier live tokens, and confirmation consumes a token atomically.

`AUTH_REQUIRE_VERIFIED_EMAIL=true` is the product default. Password users cannot receive an account, merchant, or refresh session until they confirm the one-time verification link. Use `false` only as an explicit emergency/local override.

Successful verification persists `emailVerified`, `emailVerifiedAt`, and `emailVerificationMethod`. The last accepted verification and password-reset email times are also stored for operational support. Password-reset mail is issued only for active, verified accounts, and resetting a password never changes verification state.

Configure:

```dotenv
DASHBOARD_URL=https://dashboard.example.com
EMAIL_USER=mailer-account
EMAIL_PASS=provider-app-password
EMAIL_FROM=SellPilot <support@example.com>
EMAIL_SERVICE=gmail
AUTH_REQUIRE_VERIFIED_EMAIL=true
```

For Gmail, enable 2-Step Verification on the sender Google Account and create a Google App Password. Put that 16-character App Password in `EMAIL_PASS`; a normal Gmail login password will not work. Spaces copied with the App Password are removed automatically. Restart the agent after changing `.env`. For another provider, set `EMAIL_HOST`, `EMAIL_PORT`, and `EMAIL_SECURE` instead of `EMAIL_SERVICE`.

The `/health` response and the agent startup summary report whether authentication email is configured. They never expose the credentials. A recovery request still returns a generic response for both known and unknown accounts, so delivery failures must be checked in agent logs.

After configuring the sender, verify real delivery from `apps/agent`:

```bash
npm run test-email -- recipient@example.com
```

Recovery endpoints deliberately return the same response for known and unknown email addresses.

## Rate limiting and proxies

Authentication rate limits use Redis when `REDIS_URL` is configured and fall back to a bounded in-process limiter for core/local mode. Set `TRUST_PROXY=true` only when the API is behind one trusted reverse proxy so client IP rate limits remain accurate.

## Operational rollout

1. Configure and test outbound email before opening registration.
2. Deploy with `AUTH_REQUIRE_VERIFIED_EMAIL=true`.
3. Verify signup, resend, verification, and verified-account reset in staging.
4. Confirm `DASHBOARD_URL`, sender identity, spam delivery, and link expiry.
5. Monitor 401, 429, reset, refresh-replay, and email-delivery rates.

MFA, recovery codes, enterprise SSO, and a provider-neutral transactional email service remain future hardening work.
