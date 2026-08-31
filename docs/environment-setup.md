# Environment setup

Create these local, Git-ignored files from the corresponding tracked examples:

- `apps/agent/.env`
- `apps/dashboard/.env`
- `apps/storefront/.env`

Never commit populated environment files. Variables containing credentials, tokens, passwords, signing material, or encryption material are secrets. Values whose names start with `NEXT_PUBLIC_` are bundled for browser use and must never contain secrets.

## Core only

For the agent, configure `MONGODB_URI`, `REDIS_HOST`, `REDIS_PORT`, `CORS_ORIGINS`, `AUTH_JWT_SECRET`, `OAUTH_INTERNAL_SECRET`, and `COURIER_CREDENTIALS_ENCRYPTION_KEY`. The repository Docker Compose stack exposes MongoDB with replica set `rs0` on port 27017 and Redis on port 6379.

To bootstrap the first internal operator, set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` before starting the agent. These are server-only secrets and are separate from merchant users and `BusinessMember` roles.

For the dashboard, configure `AGENT_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and the same `OAUTH_INTERNAL_SECRET` used by the agent.

For the storefront, configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_BUSINESS_CHANNEL_ID`.

Local defaults use agent `http://localhost:4000`, dashboard `http://localhost:3000`, and storefront `http://localhost:3001`. Start infrastructure with `npm run infra:up`, then run the three development apps in separate terminals.

## Full integration

Add only the integrations needed in the environment being run:

- Test AI and embeddings: `OPENAI_API_KEY`, plus optional `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `AI_RECENT_MESSAGE_LIMIT`, `AI_SUMMARY_THRESHOLD`, `AI_MAX_OUTPUT_TOKENS`, `AI_MODEL_PRICING_JSON`, and `RAG_TOP_K`.
- Facebook Messenger: `FB_APP_ID`, `FB_APP_SECRET`, `FB_VERIFY_TOKEN`, `FB_GRAPH_API_VERSION`, `FB_OAUTH_REDIRECT_URI`, `FACEBOOK_CREDENTIALS_ENCRYPTION_KEY`, `PUBLIC_AGENT_URL`, and `DASHBOARD_URL` in the agent. Merchant Page tokens are obtained through OAuth and encrypted in MongoDB; there is no shared `FB_PAGE_ACCESS_TOKEN` or `FB_PAGE_ID`.
- Google account login: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the dashboard. Register the callback derived from `NEXTAUTH_URL`.
- Google Calendar integration: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the agent.
- Facebook account login: `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in the dashboard. Use the same Meta app as the agent's `FB_APP_ID`/`FB_APP_SECRET`; Page credentials remain tenant-scoped and are never dashboard environment variables.
- Cloudinary uploads: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the agent.
- Steadfast: configure merchant API credentials through the dashboard. They are encrypted in MongoDB using `COURIER_CREDENTIALS_ENCRYPTION_KEY`; do not place merchant Steadfast keys in frontend variables.
- Optional email/calendar support: `EMAIL_USER`, `EMAIL_PASS`, and the Google Calendar variables.

`OPENAI_API_KEY`, all variables ending in `_SECRET`, tokens, passwords, `AUTH_JWT_SECRET`, `NEXTAUTH_SECRET`, `OAUTH_INTERNAL_SECRET`, `COURIER_CREDENTIALS_ENCRYPTION_KEY`, `FACEBOOK_CREDENTIALS_ENCRYPTION_KEY`, database credential-bearing URIs, and provider API keys are secrets. Keep them server-side.

## Deployment URLs

Replace local values for `AGENT_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`, `NEXT_PUBLIC_SITE_URL`, and `GOOGLE_REDIRECT_URI`. Update Google and Meta provider consoles with the deployed OAuth callback/webhook URLs.

`BUSINESS_ID` is optional and used only to select a tenant for maintenance scripts. `IMAGE_CONTEXT_TTL_MINUTES` is optional and controls visual-search context lifetime.
