# Merchant authentication and onboarding

SellPilot beta accounts may sign up without email verification. The user schema records `emailVerified` so verification can be added later. Password reset is intentionally deferred until an email delivery service is configured; the UI labels it **Coming soon**.

Google and Facebook account login use NextAuth's OAuth providers and a server-to-server identity exchange with the agent. A provider button stays disabled and says **Not configured** unless both of its credentials are present. OAuth callback URLs are based on `NEXTAUTH_URL` (for local development, Google uses `/api/auth/callback/google` and Facebook uses `/api/auth/callback/facebook`).

## Local setup

1. Copy each app's `.env.example` to `.env` and replace the placeholder secrets.
2. Use the same 32-or-more-character `OAUTH_INTERNAL_SECRET` in the agent and dashboard.
3. Start MongoDB and Redis, then run `npm run dev:agent`, `npm run dev:dashboard`, and `npm run dev:storefront` in separate terminals.
4. Open `http://localhost:3001/signup`, create an account, and follow the onboarding wizard.

Live Google/Facebook login requires provider credentials and registered callback URLs. Live AI replies require `OPENAI_API_KEY`. These integrations cannot be verified by static tests alone.

## Recommended first AI test

The onboarding form is prefilled with a safe example product: **Black T-Shirt**, price **৳1,490**, stock **10**, sizes **M, L, XL** in the description. After setup, open `/test-ai` and send:

1. `Hi`
2. `Black t-shirt ache?`
3. `XL er price koto?`
4. `Amar XL lagbe.`
5. `Order korte chai.`
6. `Delivery koto din?`
7. `My size ki bollam?`

Refresh the page, then sign out and back in to confirm the same test conversation remains available.
