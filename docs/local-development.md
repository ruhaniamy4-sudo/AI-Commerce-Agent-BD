# Local development

## Quick start

The recommended, cost-conscious setup runs frontends and Node services locally while using hosted infrastructure. Provider free/development tiers may be available, but availability and usage limits can change and are not guaranteed.

1. Create a MongoDB Atlas development cluster that supports transactions.
2. Allow your development IP and create a database user.
3. Copy the Atlas `mongodb+srv://...` URI.
4. Create a Groq API key.
5. Optionally create managed Redis for worker/background integrations.
6. Run `npm install` and `npm run setup:env`.
7. Set `MONGODB_URI` and `GROQ_API_KEY` in `apps/agent/.env`.
8. Run `npm run migrate`.
9. Run `npm run dev`.
10. Open `http://localhost:3000`, sign up/sign in, complete onboarding, and use Test AI.

## Environment files

The actual runtimes load these files:

- `apps/agent/.env`
- `apps/dashboard/.env`
- `apps/storefront/.env`

`npm run setup:env` creates missing files from their safe `.env.example` templates, preserves existing files and configured values, and generates cryptographically random development values for `AUTH_JWT_SECRET`, `NEXTAUTH_SECRET`, the shared `OAUTH_INTERNAL_SECRET`, `COURIER_CREDENTIALS_ENCRYPTION_KEY`, and `BOOTSTRAP_OWNER_PASSWORD`. It shows a newly generated bootstrap password once. It does not create MongoDB, Groq, OpenAI, OAuth, Facebook, courier, or other external credentials.

Minimum agent configuration:

```dotenv
MONGODB_URI=mongodb+srv://...
AI_PROVIDER=groq
GROQ_API_KEY=...
AUTH_JWT_SECRET=<generated>
OAUTH_INTERNAL_SECRET=<generated and shared with dashboard>
COURIER_CREDENTIALS_ENCRYPTION_KEY=<generated>
BOOTSTRAP_OWNER_EMAIL=you@example.com
BOOTSTRAP_OWNER_PASSWORD=<generated or chosen securely>
```

The courier encryption key is generated so the app has stable local encryption material; individual Steadfast tenant credentials are still optional. `BOOTSTRAP_OWNER_PASSWORD` must be at least 8 characters. No public default password is embedded.

## Core mode: no Redis

Run `npm run dev`. One launcher starts and labels:

- Agent API — `http://localhost:4000`
- Dashboard — `http://localhost:3000`
- Storefront — `http://localhost:3001`

Redis clients and BullMQ queues are initialized lazily. With no Redis settings, the API starts in core mode and reports queue features as disabled. Core merchant flows and synchronous chat/commerce work. A queue-dependent request fails explicitly; jobs are never accepted and discarded.

## Full mode: Redis and worker

Set either:

```dotenv
REDIS_URL=rediss://username:password@managed-host:port
```

or the backward-compatible settings:

```dotenv
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
```

`REDIS_URL` wins and supports both `redis://` and TLS `rediss://` URLs. Then run `npm run dev:full`. It starts the three core services plus the worker. Without Redis configuration, it exits before starting any services with a concise instruction.

Redis is not the main database. MongoDB stores persistent tenant and commerce data. Redis supports Facebook async handling, BullMQ retries, background jobs, and courier background synchronization.

## MongoDB and transactions

Atlas is the default. Use an Atlas deployment/configuration that supports multi-document transactions because order and stock writes rely on them. Do not replace the transaction flow with non-transactional development shortcuts.

Docker Compose remains an optional fallback via `npm run infra:up`. Its MongoDB service runs as a single-node replica set. When the application runs on your host, connect to `localhost`, not the Docker-only hostname `mongo`.

## AI providers

Groq is recommended for development:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

OpenAI remains supported:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.2
```

Test AI requires the key for the selected provider. Some existing embedding and vision paths remain OpenAI-specific and report that OpenAI is not configured when invoked without its key.

## External services

Google OAuth, Facebook Login/Messenger, Cloudinary, email, Steadfast tenant connections, and WhatsApp-related settings are optional for core mode. Missing credentials do not make process startup fail. Their UI or endpoint should report not configured/unavailable when used. Facebook async processing and courier background synchronization additionally require Redis and the worker.

## Migration and bootstrap

`npm run migrate` runs the existing idempotent tenancy migration. It preserves tenant indexes and backfills, and creates the default business, owner membership, and web channel when needed. Required values are explicit:

```dotenv
BOOTSTRAP_OWNER_EMAIL=you@example.com
BOOTSTRAP_OWNER_PASSWORD=<unique value with 8+ characters>
```

Optional names are `BOOTSTRAP_OWNER_NAME`, `DEFAULT_BUSINESS_NAME`, `DEFAULT_BUSINESS_SLUG`, and `DEFAULT_WEB_CHANNEL_ID`. Re-running setup does not replace an already configured owner password.

## Health and startup diagnostics

`GET /health` and `npm run health:check` report API, MongoDB, Redis (`connected`, `not_configured`, or `unavailable`), external worker status, selected AI provider/configuration presence, Facebook configuration, and Steadfast encryption configuration. Optional integrations do not make core health unhealthy. No keys, passwords, connection strings, or secret values are returned.

The agent prints one startup summary. Core mode prints `Redis: Not configured` and `Queue features: Disabled` once rather than continuously retrying.

## Troubleshooting

### `ENOTFOUND mongo`

`mongo` is normally a Docker-only service hostname. A Node process running on the host cannot resolve it. Use an Atlas URI, or use `mongodb://localhost:27017/...` only when the optional local Compose MongoDB is running.

### `ECONNREFUSED 6379`

Nothing is accepting Redis connections at the configured host/port. Core mode does not need Redis: remove stale `REDIS_HOST`/`REDIS_PORT` values and run `npm run dev`. For full mode, correct `REDIS_URL`, start the optional local Redis, or check the managed provider firewall/TLS requirement.

### `MongooseServerSelectionError`

MongoDB could not be selected. Check the URI, Atlas database username/password, escaped URI characters, IP access list, DNS/network access, and cluster availability. Confirm the URI is in `apps/agent/.env`.

### `BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD are required`

The migration has no safe owner credentials. Set both values in `apps/agent/.env`; the password must be at least 8 characters. `npm run setup:env` generates a unique development password and shows it once.

### Missing Groq key

Set `AI_PROVIDER=groq` and `GROQ_API_KEY` in `apps/agent/.env`, then restart the agent. The server may run without the key, but Test AI cannot call the provider.

### `MongoServerError: language override unsupported: bn`

An older MongoDB text index is treating the application's Bangla `language` value as a MongoDB stemming override. Run `npm run migrate:text-indexes` once. The idempotent migration inspects Knowledge, Message, and Product text indexes, drops only incompatible text indexes, and recreates them with language-neutral indexing. Application language fields and Bangla content remain unchanged.

### OAuth provider not configured

OAuth buttons/providers are enabled only when the matching client ID and secret exist. Password login and core development remain available. Add the provider's callback URL and credentials only when testing that integration.

### Full mode refuses to start

This is intentional when Redis is absent. Add `REDIS_URL` (preferred) or legacy host/port values. Use `npm run dev` for Test AI and core merchant development.
