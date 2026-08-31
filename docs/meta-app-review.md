# Meta Messenger setup and App Review runbook

This runbook describes operator work that cannot be completed by source code. It deliberately does not claim production approval. The repository default is `v26.0` as of 31 August 2026. Confirm that version in the Meta dashboard before each release, set `FB_GRAPH_API_VERSION` explicitly, and rerun the sandbox tests.

## One shared Meta app

1. In Meta for Developers, create or select the single SellPilot business app.
2. Add the Facebook Login for Business (or the current equivalent business-login product) and Messenger products.
3. Put the same app ID and secret in the agent (`FB_APP_ID`, `FB_APP_SECRET`) and dashboard (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`) server environments.
4. Add the exact OAuth redirect URI: `https://<agent-host>/facebook/oauth/callback`.
5. Add allowed domains and the dashboard/agent production domains. Use HTTPS in production.
6. In Messenger settings, add callback URL `https://<agent-host>/facebook` and the exact `FB_VERIFY_TOKEN` value.
7. Subscribe the app to Page fields `messages` and `messaging_postbacks`. SellPilot also subscribes each selected Page through `/{page-id}/subscribed_apps`.
8. Configure the privacy-policy URL, terms URL, user-data-deletion callback `https://<agent-host>/facebook/data-deletion`, support/contact information, app icon, category, and business verification details.
9. Add development/test Facebook accounts and Pages while the app is in Development mode. Do not treat successful admin/tester messaging as public eligibility.
10. Generate a new encryption secret of at least 32 characters for `FACEBOOK_CREDENTIALS_ENCRYPTION_KEY`; keep it server-only and back it up through the deployment secret manager.

## Permissions and access to request

Core merchant connection requests only:

- `pages_show_list` — list Pages the authorizing person can manage so they can choose one.
- `pages_messaging` — respond to customer-initiated Messenger conversations.
- `pages_manage_metadata` — subscribe/unsubscribe the selected Page to webhook events.

Optional Page-learning phase, requested separately and only when the product flow is ready:

- `pages_read_engagement` — read authorized Page metadata/posts for merchant-reviewed business learning.

Do not request comment, publishing, catalog, ads, analytics, message-tag, or marketing permissions for the current core flow. Add any future permission only with a separately scoped capability, consent UI, policy review, tests, and App Review evidence.

## App Review submissions still required

For each requested permission, provide a concise use-case narrative and a fresh screencast that shows: merchant signs into SellPilot; clicks Connect Facebook; completes Meta authorization; sees only Pages they manage; selects one Page; accepts the authorization acknowledgement; connection health becomes Connected; a test customer sends a message; SellPilot receives the signed webhook; SellPilot replies inside the customer-initiated window; merchant takes over and returns control to AI; merchant verifies and disconnects the Page.

For `pages_show_list`, show the Page chooser and why Page selection cannot work without it. For `pages_manage_metadata`, show automatic Page webhook subscription, health verification, and disconnect/unsubscribe. For `pages_messaging`, show a customer-initiated text, image, product card, opt-out, closed-window block, and human takeover. If submitting `pages_read_engagement`, show that it is optional, reads only the selected Page, stages facts for merchant review, deduplicates against website knowledge, and never promotes customer messages to business facts.

Also complete business verification and any required Tech Provider/solution-provider verification, data-use checkup, data-handling questionnaire, privacy-policy review, data-deletion test, test-user credentials/instructions, and requested Advanced Access. Respond to reviewer questions without adding unreviewed behavior. Switch the app to Live only after Meta shows the necessary permissions/access approved and production webhook/domain settings have been revalidated.

## Production validation checklist

- Connect two different merchant test businesses to two different Pages and prove tenant isolation in both directions.
- Revoke a Page token and confirm Reauthorization Required without leaking a token or provider payload.
- Send duplicate webhook deliveries and confirm one customer response.
- Confirm missing/invalid `X-Hub-Signature-256` returns 403.
- Confirm opt-out persists, healthcare automation remains restricted, payment credentials are removed before AI, and a normal reply after 24 hours is blocked.
- Confirm text, customer image, product image/card/carousel, postback, human takeover, usage accounting, Page health, disconnect, and optional learning behavior with real Meta test assets.
- Inspect application and deployment logs for Page tokens, authorization headers, OAuth codes, signatures, PSIDs, and raw customer payloads; none should be emitted beyond approved operational identifiers.
