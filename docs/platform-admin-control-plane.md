# SellPilot Platform Admin — Control Plane Specification

The platform admin console (`/platform-admin`) is the single operational surface for
running SellPilot as a multi-tenant SaaS business. Everything a platform operator
needs — commercial, tenant, AI, integration, compliance, and configuration control —
is reachable from it, with role-based access and a full audit trail.

## Principles

1. **One console, no shell access.** Any routine operational change is a console
   action, not a database edit or an environment-variable redeploy.
2. **Every mutation is audited.** Destructive or commercial actions require a reason
   and land in `PlatformAuditLog` with before/after values.
3. **Least privilege.** Six roles map to a permission matrix; the navigation, the API,
   and the buttons all read the same matrix, so a Finance operator never sees a
   prompt editor and never gets a 403 for something the menu offered.
4. **Runtime configuration over redeploys.** Feature availability, AI routing,
   currencies, tax, retention, and limits resolve from the settings registry at
   request time, cached briefly.
5. **International first.** Multi-currency with FX, per-region tax rules, locale and
   timezone defaults, and per-region feature gating are first-class, not bolted on.

## Roles and permissions

| Role | Intent |
| --- | --- |
| `OWNER` | Founder/CTO. Full control including the admin team and tenant erasure. |
| `ADMIN` | Senior operator. Everything except admin-team changes and tenant erasure. |
| `FINANCE` | Billing, plans, coupons, subscriptions, revenue, refunds, tax and currency. |
| `SUPPORT` | Tenant and user operations, announcements, read-only operations. |
| `ENGINEER` | Health, jobs, integrations, AI configuration, prompts, feature flags, errors. |
| `ANALYST` | Read-only across the console. |

Permission keys are `resource.action`:
`dashboard.view`, `merchants.view|manage|delete`, `users.view|manage`,
`billing.view|manage`, `plans.manage`, `coupons.manage`, `subscriptions.manage`,
`ai.view|manage`, `prompts.manage`, `integrations.view|manage`, `ops.view|manage`,
`catalog.view`, `audit.view`, `compliance.view|manage`, `settings.view|manage`,
`flags.manage`, `team.view|manage`, `announcements.manage`.

`merchants.impersonate` is declared but no console action uses it yet — see
**Deliberately not shipped** below.

`OWNER` holds the wildcard `*`. The matrix lives in
`apps/agent/src/services/platform-permissions.ts` and is served to the console on
`GET /platform-admin/me`, so navigation and API authorisation cannot drift apart.

## Navigation

Eight groups, 28 destinations. Items the signed-in role cannot view are hidden.

### 1. Command center

| Page | Route | Controls |
| --- | --- | --- |
| Overview | `/platform-admin` | KPI tiles, revenue/growth/AI trends, period selector, operational pulse |
| Live operations | `/platform-admin/support` | Merchant session feed, audited-event feed, 30s refresh |
| Announcements | `/platform-admin/announcements` | Compose, schedule, publish, take down and delete merchant broadcasts; audience targeting (all, plan, subscription status, named workspaces); severity; delivered to the merchant dashboard top bar |

### 2. Merchants

| Page | Route | Controls |
| --- | --- | --- |
| Businesses | `/platform-admin/businesses` | Search/filter, suspend/reactivate, AI suspend/resume, open detail |
| Business detail | `/platform-admin/businesses/[id]` | Members, subscription editor, manual billing adjustment, revenue, AI usage, integrations, AI usage-limit overrides, workspace data export, workspace erasure |
| Users | `/platform-admin/users` | Search, suspend/reactivate, membership role change, force email verification, revoke sessions |
| Onboarding pipeline | `/platform-admin/onboarding` | Funnel by stage, stuck-tenant list with age, drill into the tenant |
| Catalog oversight | `/platform-admin/catalog` | Cross-tenant products, orders, conversations, knowledge counts |

### 3. Revenue

| Page | Route | Controls |
| --- | --- | --- |
| Subscriptions & plans | `/platform-admin/subscriptions` | Plan CRUD (price, currency, trial, limits, features, visibility), subscription ledger with status filter |
| Payments | `/platform-admin/payments` | Ledger, manual adjustment, refund with reason, CSV export, status filter |
| Coupons | `/platform-admin/coupons` | Create/disable discount codes: percent, fixed, trial extension; plan scope, redemption cap, validity window, live redemption count |
| Revenue analytics | `/platform-admin/revenue` | Net revenue, refunds, MRR, revenue by plan, trend, period selector |
| Tax & currency | `/platform-admin/localization` | Base currency, enabled currencies with FX rate, per-region tax rules, default locale/timezone |

### 4. AI & intelligence

| Page | Route | Controls |
| --- | --- | --- |
| AI control | `/platform-admin/ai-control` | Per-tenant AI enable/suspend with reason, per-tenant monthly request/token caps |
| Model & routing | `/platform-admin/ai-config` | Live routing (provider from the deployment, model and reply ceiling overridable here), spend by model, highest-cost workspaces, default tenant caps, monthly cost ceiling and its behaviour, capability switches |
| Prompt library | `/platform-admin/prompts` | The shared agent prompt, versioned: draft, edit, activate one for every workspace, roll back by activating an earlier one |
| AI usage & cost | `/platform-admin/usage` | Per tenant/provider/model requests, tokens, cost; period selector; CSV export |

### 5. Channels & integrations

| Page | Route | Controls |
| --- | --- | --- |
| Integration health | `/platform-admin/integrations` | Channel/courier/training rollups, Facebook connection table, reauthorisation flags |
| Providers | `/platform-admin/providers` | Enable/disable each channel and courier platform-wide, credential presence per provider, infrastructure dependency status |

### 6. Platform operations

| Page | Route | Controls |
| --- | --- | --- |
| Health | `/platform-admin/health` | API/Mongo/Redis/worker/AI/storage state, channel and courier counters |
| Background jobs | `/platform-admin/jobs` | Queue depth by state, retry failed, drain, pause/resume, recent failures |
| Errors | `/platform-admin/errors` | Recent error log, redacted, grouped by type |

### 7. Governance

| Page | Route | Controls |
| --- | --- | --- |
| Audit log | `/platform-admin/audit` | Search by action/tenant/reason, before/after diff, CSV export |
| Data & privacy | `/platform-admin/compliance` | Meta deletion requests, retention windows per collection, tenant export and erase |
| Admin team | `/platform-admin/team` | Create admin, assign role, extra grants, disable, force password reset, last-login visibility |
| Security | `/platform-admin/security` | Console access and sign-in history, sensitive-change feed, password policy, admin IP allowlist, login-failure lockout, audit retention |

### 8. Configuration

| Page | Route | Controls |
| --- | --- | --- |
| Settings registry | `/platform-admin/settings` | Every runtime setting, grouped, typed inputs, defaults, description, audited writes |
| Feature flags | `/platform-admin/flags` | Global on/off, percentage rollout, plan allowlist, tenant allowlist, kill switch |
| Notification templates | `/platform-admin/notifications` | Transactional email/dashboard templates, subject/body, locale variant, enable per event |

## Backend layout

```
apps/agent/src/api/platform-admin.routes.ts           existing core (overview, businesses, users, revenue, audit…)
apps/agent/src/api/platform-control.routes.ts         new: team, announcements, flags, coupons, ai config,
                                                      prompts, jobs, compliance, catalog, onboarding,
                                                      security, localization, notifications, exports
apps/agent/src/services/platform-permissions.ts       role → permission matrix + middleware
apps/agent/src/services/platform-settings.service.ts  typed settings registry + cached runtime reader
apps/agent/src/services/feature-flag.service.ts       flag resolution for a tenant
apps/agent/src/services/platform-export.service.ts    CSV serialisation
```

Both routers mount on `/platform-admin` behind `authenticatePlatformAdmin`, so the
console's proxy and session renewal keep working unchanged.

## Data model additions

| Model | Purpose |
| --- | --- |
| `PlatformAdmin` (extended) | `role`, `permissions[]`, `createdBy`, `mustChangePassword`, `notes` |
| `PlatformAnnouncement` | Merchant broadcasts with audience targeting and a schedule |
| `User` (extended) | `announcementsSeenAt`, the single timestamp the unread badge is derived from |
| `FeatureFlag` | Keyed rollout: enabled, percentage, plan slugs, tenant ids |
| `Coupon` | Discount codes with scope, cap, window, redemption count |
| `PromptTemplate` | Global prompt library entries with version history |
| `PlatformSetting` (extended) | Categories widened to `localization`, `security`, `ai`, `notification`, `compliance`, `support` |

## What the console actually changes at runtime

A settings page that only records numbers is worse than none, so these are read on
the paths that enforce them:

| Setting | Enforced where |
| --- | --- |
| `platform.maintenance_mode`, `platform.maintenance_message` | Express middleware refuses merchant, public, and dashboard API traffic with a 503. The console, its sign-in, `/health`, and inbound provider webhooks stay reachable so nothing inbound is lost. |
| `platform.signup_enabled`, `platform.signup_blocked_message` | `POST /auth/signup` returns 403 `SIGNUP_CLOSED`. |
| `security.password_min_length`, `security.password_requires_symbol` | Every password path — merchant signup, reset, change, team invite, and admin creation. The shipped 10-character validator remains the floor, so a console value can only make passwords stricter. |
| `security.admin_ip_allowlist` | Platform admin sign-in, checked before credentials so a blocked address learns nothing. |
| `security.admin_login_lockout_attempts` | Per-account consecutive failure counter on `PlatformAdmin`, locking for 15 minutes. Complements the existing per-address rate limit. |
| `billing.refund_window_days` | A refund outside the window returns 409 `REFUND_WINDOW` unless the operator overrides it. |
| `compliance.retention_*`, `security.audit_retention_days` | The retention page reports what is past its window and the purge deletes it. |
| `compliance.tenant_export_enabled` | Gates the workspace data export. |
| Feature flags | `GET /api/dashboard/platform-notices` resolves every flag for the signed-in workspace, with stable percentage bucketing. |
| Announcements | The same endpoint returns the ten most recent notices targeted at that workspace, with an unread count. `PlatformNoticeBell` renders them behind a bell in the merchant top bar; opening the panel writes `announcementsSeenAt` on the user, so the badge is correct on every device they sign in from. |
| Notification templates | `email_verification` and `password_reset` are rendered from the stored template, falling back to the shipped default. |
| `ai.primary_model`, `ai.max_output_tokens` | `getAIModel()` and `getAIMaxOutputTokens()`, read synchronously from the warmed settings cache while a customer turn is built. Empty or 0 means "use the deployment value", which is also how a cold cache reads. The provider and its API key stay with the deployment, so switching provider remains a deploy-time decision. |
| Integration provider switches | Read by the Providers page, which reports credential presence alongside them. |

The remaining registry values are stored and served — the console is their source of
truth, and the consumer reads them through `settingValue`. The notification page
labels which events send today rather than implying all of them do.

## Deliberately not shipped

- **Merchant impersonation.** A support operator signing in as a merchant needs a
  one-time grant, a NextAuth exchange provider, and a session banner — an
  authentication bypass path that deserves its own review rather than riding along
  with this change. The permission key exists so the matrix does not need reshaping
  later. Until then the business detail page carries the full tenant picture, and
  workspace data export covers the questions impersonation was wanted for.
- **Outbound announcement email.** Announcements are marked for email delivery and
  stored; only dashboard delivery is live. The compose dialog says so.
- **Coupon redemption at checkout.** Codes, scope, caps, and eligibility are
  managed and validated here; nothing redeems them yet because self-serve checkout
  is itself behind a flag.

## Migration

Administrators created before roles existed carry no `role`, and a schema default
only applies to new documents — so `backfillPlatformAdminRoles()` runs on boot and
assigns them `OWNER`, the access they already had. `permissionsFor` independently
reads a missing role as `OWNER` and an unrecognised one as read-only, so a
deployment that skips the backfill cannot lock its own operator out.

`PlatformSetting.category` widened rather than changed, so existing rows stay valid.

## Tests

`apps/agent/src/services/platform-control-plane.test.ts` covers the permission
matrix (including the pre-RBAC and unrecognised-role cases and a 403 through the
middleware), the settings registry (defaults, type refusal, normalisation, and the
database-unreachable fallback), coupon eligibility, CSV quoting and the UTF-8 BOM,
and feature-flag bucketing stability, plan scope, and the kill switch.
