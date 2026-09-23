# SellPilot Platform Admin — Software Testing Guide

How to test the platform admin console (`/platform-admin`): what exists, which route
to open, what to click, and what the correct outcome is. Written so someone who has
never seen the codebase can run a full pass and file precise bugs.

Companion document: [platform-admin-control-plane.md](./platform-admin-control-plane.md)
describes the design. This one describes the testing.

---

## 1. Scope

| In scope | Out of scope |
| --- | --- |
| 28 console pages, their controls, and the API behind them | Merchant dashboard features (products, orders, inbox, training) |
| Role-based access: navigation, buttons, API refusal | Storefront |
| Audit trail completeness on every mutation | AI reply quality |
| Settings that change runtime behaviour | Load and performance testing |
| CSV and workspace data exports | Penetration testing |

---

## 2. Set up the environment

### 2.1 Services

```bash
npm install
npm run setup:env
npm run migrate
npm run dev
```

`npm run dev` starts three processes: agent API on `:4000`, dashboard on `:3000`,
storefront on `:3001`. Background jobs need Redis, so for the **Background jobs**
page use:

```bash
npm run dev:full
```

Without Redis that page must still render and report the queues as unavailable —
that is a test case, not a blocker.

### 2.2 Confirm the API is up before testing the UI

```bash
npm run health:check
```

Expect `"status": "ok"` and `"mongo": "connected"`. If Mongo is down, most console
pages show empty tables rather than errors, and you will file false bugs.

### 2.3 Required environment values

| Variable | Needed for |
| --- | --- |
| `MONGODB_URI` | Everything |
| `AUTH_JWT_SECRET` | Sign-in (32+ characters) |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` | The bootstrap admin account (password 10+ characters) |
| `GROQ_API_KEY` or `OPENAI_API_KEY` | AI pages showing real usage; Test AI |
| `REDIS_URL` | Background jobs page showing real queues |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`/`EMAIL_SERVICE` | Notification template delivery |
| `CLOUDINARY_*` | Storage row on Health and Providers reading "configured" |

Anything unset should make the console **report it as not configured**, never crash.
That is itself a test: unset `CLOUDINARY_URL`, reload
`/platform-admin/providers`, and the storage row must read "Not configured".

### 2.4 Sign in

Open `http://localhost:3000/login?access=admin`, or press the **Platform Admin**
toggle on the login page. Use `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.

The bootstrap account is created only if that email does not already exist, so
changing the password in `.env` does **not** change an existing account's password.
Reset it from **Governance → Admin team** instead.

Session facts worth knowing while testing: the platform token lasts 24 hours, the
overall session is capped at 7 days, and the token slides forward automatically once
it is past half its life. A sign-out that happens mid-task before 7 days is a bug.

### 2.5 Create test data

The console shows real tenant data, so an empty database makes most pages look
broken. Create at least two merchant workspaces before testing:

1. Open `http://localhost:3000/signup` and register a merchant.
2. Complete onboarding partly for one workspace (add a product, stop there) and
   fully for another. This gives the **Onboarding pipeline** page two different
   stages to show.
3. Add a few products and place a test order in one workspace, so **Catalog
   oversight** has rows.

For the revenue pages, record a manual payment: open the workspace's detail page and
use **Manual billing adjustment** with *Test environment* ticked.

---

## 3. Role-based access testing

This is the highest-value area, because a mistake here either blocks an operator or
exposes something it should not.

### 3.1 Create one admin per role

Sign in as the bootstrap `OWNER`, open `/platform-admin/team`, and use **Add
administrator** to create five accounts — one each for `ADMIN`, `FINANCE`,
`SUPPORT`, `ENGINEER`, `ANALYST`. Give each a password of at least 10 characters
that does not contain their own name or email.

Each new account is flagged *must change password*. That flag is recorded and shown
in the console; it is not yet enforced at sign-in, so they can sign in with the
temporary password.

### 3.2 Expected navigation per role

Sign in as each role and compare the sidebar against this table. It is generated
from the permission matrix, so a mismatch is a real defect.

| Page | Route | OWNER | ADMIN | FINANCE | SUPPORT | ENGINEER | ANALYST |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Overview | `/platform-admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Live operations | `/platform-admin/support` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Announcements | `/platform-admin/announcements` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Businesses | `/platform-admin/businesses` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Users | `/platform-admin/users` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Onboarding | `/platform-admin/onboarding` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Catalog oversight | `/platform-admin/catalog` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Subscriptions | `/platform-admin/subscriptions` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Payments | `/platform-admin/payments` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Coupons | `/platform-admin/coupons` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Revenue | `/platform-admin/revenue` | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Tax & currency | `/platform-admin/localization` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI control | `/platform-admin/ai-control` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Model & routing | `/platform-admin/ai-config` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Prompt library | `/platform-admin/prompts` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| AI usage | `/platform-admin/usage` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Integration health | `/platform-admin/integrations` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Providers | `/platform-admin/providers` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Platform health | `/platform-admin/health` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Background jobs | `/platform-admin/jobs` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Errors | `/platform-admin/errors` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Audit log | `/platform-admin/audit` | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Data & privacy | `/platform-admin/compliance` | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Admin team | `/platform-admin/team` | ✅ | ✅ | — | — | — | ✅ |
| Security | `/platform-admin/security` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings | `/platform-admin/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Feature flags | `/platform-admin/flags` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notifications | `/platform-admin/notifications` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Two things that look wrong but are not:

- **`ANALYST` sees every page.** The role holds every `.view` permission by design.
  The test is that all its controls are disabled or absent, not that pages are hidden.
- **A visible page can still be read-only.** Announcements, Flags, Settings and
  Notifications are visible to anyone with `settings.view`/`dashboard.view`; the
  write controls require a separate `.manage` permission. `ANALYST` and `FINANCE`
  should see the Feature flags table with the toggles **disabled**.

### 3.3 Verify the API refuses, not just the menu

Hiding a menu item is not access control. For each role, confirm the API refuses too:

```bash
# 1. Sign in as the FINANCE test admin and keep the token
TOKEN=$(curl -s -X POST http://localhost:4000/platform-auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"finance@example.test","password":"YourTestPassword1"}' | jq -r .platformToken)

# 2. Something the role may do — expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4000/platform-admin/revenue \
  -H "authorization: Bearer $TOKEN"

# 3. Something it may not — expect 403 naming the missing permission
curl -s http://localhost:4000/platform-admin/prompts -H "authorization: Bearer $TOKEN"
# {"error":"This platform role cannot perform that action","requires":["ai.view"]}
```

Repeat for at least: `FINANCE` → `/prompts`, `/jobs`; `ENGINEER` → `/revenue`,
`/coupons`, `/users`; `SUPPORT` → `/audit`, `/team`; `ANALYST` → any `POST`/`PUT`.

### 3.4 Guard rails that must hold

| Test | Route | Expected |
| --- | --- | --- |
| Change your own role to something lower | Admin team | `You cannot downgrade or disable your own administrator account` |
| Disable your own account | Admin team | Same refusal |
| Downgrade or disable the last active `OWNER` | Admin team | `At least one active owner must remain` |
| Demote the last active `Owner` of a merchant workspace | Users → role dropdown | `A workspace must keep at least one active owner` |
| Sign in as a disabled admin | Login | `Invalid credentials`, and existing sessions stop working on their next request |

---

## 4. Rules that apply to every page

Check these on each page you touch, not once per pass.

| Rule | How to verify |
| --- | --- |
| **Every mutation is audited** | After any change, open `/platform-admin/audit`. There must be an entry with the right action, your admin name, the reason you typed, and a before/after diff when you expand the row. A mutation with no audit entry is a bug. |
| **Destructive actions ask why** | The confirmation dialog's reason field requires at least 3 characters; the confirm button stays disabled until then. |
| **Cancel means cancel** | Cancel, `Escape`, and clicking outside the dialog must all abort with no change and no audit entry. |
| **Read-only roles see disabled controls** | Toggles and buttons render disabled rather than failing on click. |
| **No secrets in responses** | With devtools open, inspect the response of every page's request. No API keys, password hashes, tokens, or courier credentials. Errors on `/platform-admin/errors` must show `[redacted]` in place of keys. |
| **Responsive** | Test at 375px and 768px. The sidebar collapses to a menu button, tables scroll horizontally instead of overflowing the page, and no control is unreachable. |
| **Light and dark** | Use the theme toggle in the top bar. Text must stay readable and status colours distinguishable in both. |
| **Empty states** | On a fresh database every table shows a written empty state, never a blank panel or a spinner that never ends. |
| **Loading** | Panels show a loading line, not a layout jump. |

---

## 5. Route-by-route test plan

### 5.1 Overview — `/platform-admin`

| What | How | Expected |
| --- | --- | --- |
| KPI tiles | Load the page | Merchants, active subscriptions, MRR, AI conversations all populated from real data |
| Period selector | Switch through 7d / 30d / this month / 3m / 12m | Charts and tiles refetch; no stale numbers |
| Growth percentage | Compare MRR tile against Revenue page | Arrow direction matches the sign of the change |
| Charts | Three charts on the page | Each has its own colour; a chart with no data renders empty axes, not a broken SVG |
| Failure state | Stop the agent (`Ctrl+C` in the dev terminal), reload | Status pill reads "Data connection issue" instead of the page crashing |

### 5.2 Live operations — `/platform-admin/support`

| What | How | Expected |
| --- | --- | --- |
| Merchant activity feed | Sign in to the merchant dashboard in another browser profile | That user appears in the feed within ~30s (the page refetches automatically) |
| Event feed | Suspend a workspace, come back | The suspension shows with its reason |
| Relative time | Check timestamps | Shows `Now`, `5m`, `3h`, `2d` — not a raw date |

### 5.3 Announcements — `/platform-admin/announcements`

| What | How | Expected |
| --- | --- | --- |
| Create draft | **New announcement** → title, message, severity `info`, audience *Every workspace* → Save | Row appears with status `draft`. Nothing is visible to merchants yet — confirm in the merchant dashboard |
| Publish | **Publish** → give a reason | Status becomes `published`. In the merchant dashboard the bell in the top bar gains a red unread badge, and the announcement is at the top of its panel |
| Severity styling | Publish one each of info / success / warning / critical | Each row in the merchant bell panel gets its own icon and colour: info violet, success green, warning amber, critical red |
| Read state | As a merchant, open the bell, then reload. Then sign in as the same user in a different browser profile | Opening the panel clears the badge and it stays cleared after a reload. It is also cleared in the other browser, because the read mark is stored against the user rather than the browser. The "new" dots stay visible while the panel is open, so what just arrived can still be told apart while it is being read |
| Target by plan | Audience *Specific plans* → enter a plan slug that one workspace has | Only that workspace's dashboard shows it |
| Target by status | Audience *Specific subscription statuses* → `PAST_DUE` | Only workspaces in that state see it |
| Target by workspace | Audience *Named workspaces* → paste a workspace id from the Businesses table | Only that workspace sees it |
| Empty target | Pick a targeted audience, leave the list blank, Save | `A title, a message, and at least one recipient are required` — nothing is created |
| Feed cap | Publish more than ten announcements aimed at every workspace | The merchant panel shows the ten most recent, newest first, and scrolls rather than growing. Older ones drop off the list |
| Schedule | Set *Starts* an hour in the future, publish | Merchants do not see it yet; it appears once the start time passes |
| Expiry | Set *Ends* in the past on a published announcement, reload the list | Status flips to `expired` automatically and merchants stop seeing it |
| Take down | **Take down** on a published row | Returns to `draft` and the announcement leaves the merchant bell panel on the next load |
| Delete | **Delete** → confirm | Row removed, audit entry `ANNOUNCEMENT_DELETED` |

Note: the *email delivery* checkbox only records intent. No announcement email is
sent yet — see §9.

### 5.4 Businesses — `/platform-admin/businesses`

| What | How | Expected |
| --- | --- | --- |
| Search | Type a workspace name, an owner email, a plan | Matching rows only; search resets to page 1 |
| Filters | Cycle every filter option | `active`, `suspended`, subscription states, `ai_active`, `ai_suspended`, `recent`, `inactive` each narrow the list correctly |
| Suspend | **Suspend** → reason | Status becomes `suspended`; the merchant team is locked out of that workspace; audit entry `BUSINESS_SUSPENDED` carries the reason |
| Reactivate | **Reactivate** → reason | Access returns |
| Pagination | With more than 20 workspaces | Previous/Next work and disable at the ends |
| CSV export | **Export CSV** | Downloads `sellpilot-businesses-<date>.csv`; opens in a spreadsheet with readable Bangla names; an audit entry `DATA_EXPORTED` is written |

### 5.5 Business detail — `/platform-admin/businesses/[id]`

The densest page in the console. Work through it top to bottom.

| What | How | Expected |
| --- | --- | --- |
| Suspend / reactivate business | Header buttons | As above, and the metric tile updates |
| Suspend / resume AI | Header buttons | Only AI stops; the merchant team can still reply by hand. Send a customer message through Test AI to confirm the agent no longer answers |
| Change subscription | **Change subscription** | Form pre-filled with the current plan, status, period, price. Saving writes a `SubscriptionEvent` and shows in Subscription history |
| Subscription → AI coupling | Set status to `EXPIRED` | AI status becomes `SUSPENDED_BY_SUBSCRIPTION`. Set it back to `ACTIVE` → AI returns to `ENABLED` |
| Cancel subscription | Set status `CANCELLED` | Asks a second time before applying |
| Manual billing adjustment | **Manual billing adjustment** → amount, type, reason | With *Test environment* unticked it asks for one more confirmation. The entry appears on the Payments page and in Revenue |
| AI usage limits | **AI usage limits** → request limit 5, reason | Send 6 messages to that workspace's agent. The 6th is blocked and the merchant dashboard shows the allowance banner |
| Clear a limit | Set the limit back to 0 | The workspace falls back to its plan allowance; the detail page shows "Plan allowance" on the AI control page |
| Workspace data export | **Export workspace data** | Downloads a JSON bundle containing business, members, subscription, payments, products, orders, customers, knowledge. Audit entry `TENANT_DATA_EXPORTED` |
| Export disabled | Set `compliance.tenant_export_enabled` to off in Settings, retry | `403 Tenant export is disabled in platform settings` |
| Erase — wrong name | **Erase workspace** → type the name incorrectly | Confirm button stays disabled |
| Erase — correct | Type the exact name + reason → **Erase permanently** | ⚠️ Destructive. Redirects to the Businesses list, the workspace is gone, the merchant can no longer sign in, and the audit entry lists the per-collection deletion counts. Billing ledger and audit log are kept on purpose |
| Erase permission | Try as `ADMIN` (not `OWNER`) | The Erase button is absent — only `merchants.delete` sees it |

### 5.6 Users — `/platform-admin/users`

| What | How | Expected |
| --- | --- | --- |
| Search | Name or email | Matching accounts; pagination resets |
| Suspend | **Suspend** → reason | The user is signed out and cannot sign in again; audit `USER_SUSPENDED` |
| Reactivate | **Reactivate** | Sign-in works again |
| Membership role change | Role dropdown next to a workspace → `Admin` → reason | Their permissions in that workspace change on their next request. Verify inside the merchant dashboard |
| Last-owner guard | Try to demote the only `Owner` | `A workspace must keep at least one active owner` |
| Force email verification | On an unverified account → mail icon → reason | Badge flips to `Verified`; audit `USER_EMAIL_VERIFIED` records `method: platform_admin` |
| Already verified | Try it twice | `That email is already verified` |
| Revoke sessions | Sign in as that merchant elsewhere, then **revoke** → reason | Their next request fails and they are returned to the login screen. The account stays active and they can sign in again |
| Export | **Export CSV** | `sellpilot-users-<date>.csv` |

### 5.7 Onboarding pipeline — `/platform-admin/onboarding`

| What | How | Expected |
| --- | --- | --- |
| Funnel accuracy | Create a workspace, add one product, stop | It appears at stage *First product added*, not further |
| Completion | Finish onboarding for a workspace | It moves to *Onboarding complete* and leaves the stuck list |
| Age colouring | Check a workspace older than 7 and than 14 days | Warning at 7+, danger at 14+ |
| Step chips | Compare chips against the workspace's real onboarding | Completed steps are highlighted |
| Drill-in | Click a workspace name | Opens its detail page |

### 5.8 Catalog oversight — `/platform-admin/catalog`

| What | How | Expected |
| --- | --- | --- |
| Totals | Overview tab | Products, orders, conversations, customers, knowledge, messages counted across all workspaces |
| Leaderboards | Overview tab | Largest catalogs, highest order value, busiest inboxes — names resolve, deleted workspaces read "Deleted workspace" |
| Orders tab | Search an order number, a customer name, a phone | Matching rows across tenants; status filter narrows further |
| Products tab | Search a name and a SKU | Matching rows; price and stock shown |
| Read-only | Look for edit controls | There are none — this page must never write |
| Cross-links | Click a workspace name | Opens that workspace's detail page |

### 5.9 Subscriptions & plans — `/platform-admin/subscriptions`

| What | How | Expected |
| --- | --- | --- |
| Plan cards | Load | One card per plan with price, limits, live/disabled state |
| Create plan | **New plan** → name, slug, prices, limits | Appears in the grid and is offered to merchants on their billing page |
| Duplicate slug | Create a plan with an existing slug | `Plan slug already exists` (409), nothing created |
| Edit plan | **Manage plan** → change a limit | Saved; a merchant on that plan is held to the new limit. Note plans are cached for 60s, so allow a minute |
| Unlimited | Set a limit to `-1` | Shows "Unlimited" and the merchant is not blocked |
| Disable plan | Untick *Enabled* | Hidden from merchant plan selection; existing subscribers keep working |
| Ledger filter | Filter by each subscription status | Rows narrow correctly |
| Export | **Export CSV** | `sellpilot-subscriptions-<date>.csv` |

### 5.10 Payments — `/platform-admin/payments`

| What | How | Expected |
| --- | --- | --- |
| Tiles and trend | Switch periods | Net collected, successes, failures, refunds and the chart all move together |
| Ledger filters | `PAID` / `PENDING` / `FAILED` / `REFUND` | Rows narrow; search matches merchant name and provider reference |
| Refund | On a `PAID` non-refund row → **Refund** → reason | A `REFUND` entry is created, net revenue drops, audit `PAYMENT_REFUNDED`. The original payment row is unchanged |
| Refund a refund | Try **Refund** on a refund row | The button is not offered; the API answers `Only a recorded payment can be refunded` |
| Refund window | Set `billing.refund_window_days` to 1, refund an older payment | `409` — *that payment is outside the 1-day refund window* |
| Over-refund | Via API, request an amount larger than the payment | `A refund cannot exceed the original payment` |
| Permission | As `ANALYST` | No Refund button |
| Export | **Export CSV** | Period-scoped payments file |

### 5.11 Coupons — `/platform-admin/coupons`

| What | How | Expected |
| --- | --- | --- |
| Create percent code | **New code** → `LAUNCH20`, percent, 20 | Row reads "20% off"; no rejection reason shown |
| Create fixed code | Type *Fixed amount off*, value 500, currency BDT | Reads "500 BDT off" |
| Create trial code | Type *Extra trial days*, value 14 | Reads "14 extra trial days" |
| Invalid code format | Try `ab`, or `has space` | Refused: 3–40 letters, numbers, dashes, underscores |
| Percent over 100 | Value 150 on a percent code | Refused |
| Duplicate code | Reuse an existing code | `That code already exists` (409) |
| Window | Set *Valid until* in the past | Status column explains `This code has expired` and the toggle is replaced by the reason |
| Cap reached | Nothing increments `redemptions` yet, so set `redemptions: 1` on the coupon document in Mongo and set the cap to 1 | Status reads `This code has reached its redemption limit` and the toggle is replaced by that reason |
| Plan scope | Scope to one plan | The *Plan scope* column lists that plan. Eligibility against a different plan is enforced by `couponRejection`, which is unit-tested — there is no preview in the UI because nothing redeems a code yet |
| Disable | Toggle a code off | Status shows `This code is disabled` |
| Delete unused | Delete a code with 0 redemptions | Removed entirely; audit `COUPON_DELETED` |
| Delete redeemed | On the same seeded code with `redemptions: 1`, press Delete | Kept but disabled rather than removed, audit `COUPON_DISABLED`, and the dialog explains that a redeemed code stays on the record |

Coupons are managed and validated here but nothing redeems them yet — see §9.

### 5.12 Revenue — `/platform-admin/revenue`

| What | How | Expected |
| --- | --- | --- |
| Summary | Load | Net revenue, new subscription revenue, renewal revenue, refunds |
| Refund effect | Record a refund on Payments, return here | Net revenue drops by the refund; the refunds figure rises |
| Period | Cycle every period | Numbers change consistently with Payments for the same period |
| Search | Workspace name or transaction reference | Rows narrow |
| Export | **Export CSV** | Same dataset as Payments for that period |

### 5.13 Tax & currency — `/platform-admin/localization`

| What | How | Expected |
| --- | --- | --- |
| Currency table | Load | Reflects `localization.enabled_currencies`; the base currency row is marked |
| Add a currency | Edit the *Enabled currencies* JSON below → add `{"code":"EUR","symbol":"€","rate":0.008,"rounding":2}` → save | The table above gains a EUR row |
| Invalid JSON | Type a broken object → save | `Enabled currencies is not valid JSON`; nothing is written |
| Tax rules | Add a rule with region, label, rate | Appears in the Tax rules table |
| Tax toggle | Turn *Apply tax* on | Header pill changes to "Tax applied to invoices" |
| Locales | Change *Supported locales* to `bn, en, hi` | Tile count updates; the list accepts comma-separated input |
| Reset | Use the reset arrow on a changed setting | Returns to the shipped default and the `default` marker reappears |

### 5.14 AI control — `/platform-admin/ai-control`

| What | How | Expected |
| --- | --- | --- |
| States | Load | Each workspace shows one of Enabled / Suspended by platform / Suspended by subscription / Disabled by merchant, with the stored reason |
| Suspend AI | **Suspend AI** → reason | Confirmation lists the consequences. Afterwards the agent stops replying for that workspace; the merchant sees the paused banner |
| Resume | **Resume AI** → reason | Replies resume on the next customer message |
| Limit column | For a workspace with an override | Shows the cap and the percentage used; otherwise "Plan allowance" |
| Limits link | **Limits** | Opens the workspace detail page, where the override is edited |
| Search | Workspace name | Rows narrow |
| Permission | As `ANALYST` | No suspend/resume buttons |

### 5.15 Model & routing — `/platform-admin/ai-config`

| What | How | Expected |
| --- | --- | --- |
| Live routing panel | Load | Provider, deployment model, model in use, max tokens per reply |
| Model override | Set `ai.primary_model` to another model the provider supports → save | "Model in use" changes and is marked as overridden. Send a message through Test AI and confirm a reply still arrives |
| Clear the override | Empty the field → save | Returns to the deployment model |
| Bogus model | ⚠️ Set an invalid model name | AI replies start failing; errors appear on `/platform-admin/errors`. **Revert immediately.** This is a legitimate negative test — confirm the failure is visible, not silent |
| Token ceiling | Set `ai.max_output_tokens` to 120 | Replies get noticeably shorter. Setting 0 returns to the deployment value; a huge number is clamped to 2000 |
| Missing credentials | Unset the provider key and restart | Red banner: provider has no API key |
| Cost ceiling | Set `ai.monthly_cost_ceiling_usd` to a value below current spend | Warning banner and the meter turn amber/red |
| Spend by model | With real usage | Requests, tokens and cost per provider/model |
| Highest-cost workspaces | With real usage | Ranked by spend, names resolved |
| Quotas | Set `ai.default_monthly_request_limit` | Applies to workspaces whose plan and own override both set none |

### 5.16 Prompt library — `/platform-admin/prompts`

| What | How | Expected |
| --- | --- | --- |
| Live prompt | Load | The active prompt is shown in full with its update time |
| Create | **New prompt** → name + 20+ characters | Saved as a draft. Merchant replies do not change |
| Too short | Content under 20 characters | Refused |
| Activate | **Activate** on a draft → reason | Becomes the only live prompt; the previous one becomes a draft. Send a message through Test AI — the new prompt takes effect on the next turn |
| Rollback | Activate the previous prompt again | Behaviour returns |
| Delete live prompt | **Delete** on the active row | Not offered; the API answers `Activate another prompt before deleting the live one` |
| Delete draft | **Delete** on a draft → confirm | Removed |
| Merchant lockout | As a merchant administrator, `PATCH /admin/system-prompts/:id` | `403 PROMPT_PLATFORM_MANAGED`. This prompt is global; one merchant must not be able to change every tenant's agent |

### 5.17 AI usage — `/platform-admin/usage`

| What | How | Expected |
| --- | --- | --- |
| Totals | Load | Requests, tokens, estimated cost |
| Unknown pricing | With a model missing from `AI_MODEL_PRICING_JSON` | Cost reads "Unavailable" / "partial" rather than 0 — a fabricated 0 here is a bug |
| Per-workspace rows | Load | Provider, model, requests, input/output tokens, cost |
| Period | Cycle periods | Numbers change |
| Export | **Export CSV** | Period-scoped usage file |

### 5.18 Integration health — `/platform-admin/integrations`

| What | How | Expected |
| --- | --- | --- |
| Rollups | Load | Channel, courier and training counts by state |
| Facebook table | With a connected Page | Workspace, Page name, state, last event, last verified |
| Attention | On a connection needing reauthorisation | Flagged in the Attention column and counted in the header pill |
| No credentials | Without Facebook credentials | Empty state, not an error |
| Privacy | Inspect the response | No Page access tokens or Page IDs beyond what is needed |

### 5.19 Providers — `/platform-admin/providers`

| What | How | Expected |
| --- | --- | --- |
| Credential reporting | Load | Each channel and courier shows Configured / Credentials missing based on the environment |
| Turn a provider off | Toggle Messenger off; if workspaces use it, a confirmation appears | Existing connections stay in the database but the provider stops being offered to merchants |
| Turn it back on | Toggle on | Offered again |
| Infrastructure table | Load | Groq, OpenAI, storage, email, Redis each report real state |
| Secrets | Inspect the response and the UI | Only booleans — never a key value |
| Permission | As `ANALYST` | Toggles disabled |

### 5.20 Platform health — `/platform-admin/health`

| What | How | Expected |
| --- | --- | --- |
| Services table | Load | API, Mongo, Redis, worker, AI provider, Facebook, courier encryption, storage |
| Refresh | **Refresh** | Re-checks immediately; also auto-refreshes every 30s |
| Degraded | Stop Redis | Redis row turns red/amber and the header pill reads "Degraded" — the page must not crash |
| Mongo down | Stop Mongo | Overall status degrades and the page still renders |

### 5.21 Background jobs — `/platform-admin/jobs`

Run `npm run dev:full` for this page.

| What | How | Expected |
| --- | --- | --- |
| No Redis | Start with `npm run dev` | Each queue reports "Unreachable" with a reason; the page renders; actions return `503` |
| Counts | With Redis | waiting / active / completed / failed / delayed / paused per queue |
| Retry failed | Cause a webhook failure, then **Retry failed** → reason | Failed jobs are re-queued; the failed count drops; audit `QUEUE_RETRY` |
| Pause | **Pause** → reason | Queue reports paused; new jobs accumulate rather than being processed |
| Resume | **Resume** → reason | Processing restarts |
| Clear failed | **Clear failed** → reason | ⚠️ Failed jobs are removed and can no longer be retried; the dialog says so |
| Drain | **Drain** → reason | ⚠️ Waiting and delayed jobs are discarded; the dialog says so |
| Failure detail | With failed jobs | Recent failures list the attempt count and the failure reason |
| Permission | As `ANALYST` | Counts visible, action buttons absent |

### 5.22 Errors — `/platform-admin/errors`

| What | How | Expected |
| --- | --- | --- |
| Recent errors | Cause one (e.g. the bogus model test) | Appears with type, message and relative time |
| Redaction | Look for anything secret-shaped | Bearer tokens, `sk-…` keys and `password=`/`token=` pairs read `[redacted]` |
| Type filter | Pick a type | Rows narrow; distinct-type count matches |
| Search | Search message text | Rows narrow |
| Last-hour pill | With recent errors | Turns amber, and red above 10 |
| No stack traces | Inspect the response | Stack traces stay server-side |

### 5.23 Audit log — `/platform-admin/audit`

| What | How | Expected |
| --- | --- | --- |
| Completeness | Perform one action on each page, then come here | Every one is present |
| Diff | Expand a row | Before and after JSON, side by side |
| Redaction in diffs | Change a setting holding a secret-shaped value | The diff shows `[redacted]`, not the value |
| Action filter | Pick actions from the dropdown | Rows narrow |
| Search | Search an action, a target id, a reason | Rows narrow |
| Actor | Act as two different admins | Each entry names the right administrator |
| Export | **Export CSV** | 12-month audit file |
| Permission | As `SUPPORT` | The page is not in the menu; direct URL access gets an empty table because the API refuses |

### 5.24 Data & privacy — `/platform-admin/compliance`

| What | How | Expected |
| --- | --- | --- |
| Retention table | Load | Conversations, error logs, AI usage, audit log — each with its window, total, and how many rows are past the window |
| Indefinite | A dataset with window 0 | Reads "Kept indefinitely" and offers no purge |
| Purge with no window | Set a window to 0 and try purging via API | `That dataset is set to keep data indefinitely. Set a retention window first.` |
| Purge | Set `compliance.retention_error_logs_days` to 1, then **Purge** → reason | ⚠️ Every row past the window is deleted; the returned count matches the drop in the table; audit `RETENTION_PURGE`. The conversation purge is the exception — it works in batches of up to 5,000 conversations per run, so press it again while the expired count stays above zero |
| Conversation purge | Purge conversations | Their messages go too — no orphaned messages left behind |
| Deletion requests | With a Meta deletion callback recorded | Listed with a truncated reference; overdue ones flagged against the SLA |
| Complete a request | **Complete** → describe what was done | Status `COMPLETED`; audit `DELETION_REQUEST_COMPLETED` |
| SLA | Set `compliance.deletion_request_sla_hours` to 1 | Older open requests become overdue |
| Permission | As `SUPPORT` (has `compliance.view`) | Table visible, purge and complete buttons absent |

### 5.25 Admin team — `/platform-admin/team`

| What | How | Expected |
| --- | --- | --- |
| Create | **Add administrator** | Requires name, valid email, role, reason, and a policy-compliant password |
| Weak password | Try `password123` or one containing their own name | Refused with the specific reason |
| Duplicate email | Reuse an email | `An administrator with that email already exists` (409) |
| Role change | Change someone's role from the dropdown → reason | Their access changes on their next request — verify by reloading their session |
| Disable | **Disable** → reason | They cannot sign in; existing sessions stop working |
| Password reset | Key icon → new password → | Marked *must change password*; they can sign in with the new one; audit `PLATFORM_ADMIN_PASSWORD_RESET` |
| Self-protection | Try to change or disable your own account | Refused (see §3.4) |
| Role reference | Scroll to *What each role can do* | Each role's permission chips match §3.2 |
| Permission | As `ADMIN` | Page visible (it has `team.view`) but no create/role/disable controls — `team.manage` is `OWNER` only |

### 5.26 Security — `/platform-admin/security`

| What | How | Expected |
| --- | --- | --- |
| Access table | Load | Every admin with role, status, 30-day sign-in count, last sign-in, password state |
| Never signed in | A freshly created admin | Flagged "Never" and counted in the tile |
| Sensitive feed | Create an admin, reset a password, revoke sessions | All three appear in the feed |
| Password policy | Set `security.password_min_length` to 14 and *Require a symbol* on | Merchant signup, password reset, and admin creation all enforce it. The shipped 10-character minimum is the floor — a value below 10 cannot weaken it |
| Login lockout | Set `security.admin_login_lockout_attempts` to 3, then fail sign-in 3 times for one admin | 4th attempt returns `423 ACCOUNT_LOCKED` for 15 minutes; a successful sign-in clears the counter |
| IP allowlist | ⚠️ See the warning below | Sign-in from a non-listed address returns `403 IP_NOT_ALLOWED` before credentials are checked |
| Audit retention | Set `security.audit_retention_days` | Reflected on the compliance retention table |

> ⚠️ **The IP allowlist can lock you out of the console.** Test it last, and know the
> way back before you start: remove the `security.admin_ip_allowlist` document from
> the `platformsettings` collection in MongoDB, or sign in from an address that is on
> the list. On localhost the address is usually `::1` or `127.0.0.1`; add both.

### 5.27 Settings — `/platform-admin/settings`

| What | How | Expected |
| --- | --- | --- |
| Tabs | Cycle Platform / Billing / Subscription / Integrations / Support | Settings grouped under headings with description and key |
| Typed controls | Look at each type | Booleans render a toggle that saves on click; selects offer only valid options; numbers, text, lists and JSON get the right input |
| Default marker | An untouched setting | Shows `default` next to its key |
| Save | Change a text setting → save icon | Value persists across reload; audit `PLATFORM_SETTING_UPDATED` with before/after |
| Reset | Reset arrow | Returns to the shipped default; audit `PLATFORM_SETTING_RESET` |
| Type refusal | Via API, `PUT` a string into a number setting | `This setting expects a number` |
| Unknown key | Via API, `PUT` an undeclared key | `Unknown setting key` |
| **Maintenance mode** | Turn it on | ⚠️ The merchant dashboard and public API return `503` with your message; **this console stays reachable** so you can turn it back off. Verify both halves |
| Signup closed | Turn *Self-serve signup* off | `/signup` refuses with your message and `SIGNUP_CLOSED` |
| Banners | With maintenance on and signup off | The Settings page shows a banner for each |
| Permission | As `ANALYST` | All inputs disabled, no save or reset buttons |

### 5.28 Feature flags — `/platform-admin/flags`

| What | How | Expected |
| --- | --- | --- |
| Seeded flags | First load | The default catalog appears rather than an empty table |
| Create | **New flag** → key `test.flag`, label | Created; invalid keys (spaces, capitals) are refused |
| Duplicate key | Reuse a key | `That flag key already exists` (409) |
| Toggle | Flip a flag on | Saved immediately |
| Verify resolution | As a merchant, call `/api/dashboard/platform-notices` from devtools | `flags` contains the key with the right value |
| Rollout 0 / 100 | Set 0, then 100 | Merchant resolution flips accordingly |
| Bucketing stability | Set rollout 25, reload the merchant dashboard repeatedly | The same workspace keeps getting the same answer — flicker is a bug |
| Plan scope | Scope to one plan | Only workspaces on that plan resolve true |
| Workspace override | Add a workspace id | That workspace resolves true even outside the plan scope and rollout |
| Kill switch | **Kill** → confirm | Every workspace resolves false regardless of everything else; the enable toggle becomes disabled |
| Release | **Release** | Previous behaviour returns |
| Delete | **Delete** → confirm | Removed; code asking for that flag reads it as off |

### 5.29 Notification templates — `/platform-admin/notifications`

| What | How | Expected |
| --- | --- | --- |
| Seeded templates | First load | One template per event, with its available variables listed |
| Live vs stored | Check the *Sent today* column | `email_verification` and `password_reset` read "Live"; the rest read "Stored" |
| Edit | Change the verification subject → save | Trigger a merchant signup or resend verification. The email uses the new subject. Without email configured, the server logs the delivery warning instead — check the terminal |
| Variables | Use `{{platformName}}` and `{{actionUrl}}` | Replaced at send time; an unknown variable renders as empty, not as literal braces |
| Disable | Toggle a live template off | That email stops being sent; the flow still completes |
| Locale variant | **Add locale variant** → same event, locale `bn` | Created. Adding the same event and locale twice returns `409` |
| Invalid locale | Try `bangla` | Refused — expects `bn`, `en`, or `bn-BD` style |
| Delivery settings | Edit the sender block below | Sender name, address, reply-to, operator alert address persist |

---

## 6. API-level testing

Useful when you need to test a refusal, an edge case the UI prevents, or a response
shape. The console talks to `/api/platform-admin/*` on the dashboard, which proxies
to `/platform-admin/*` on the agent with the session cookie. Testing the agent
directly with a bearer token is simpler:

```bash
# Sign in
TOKEN=$(curl -s -X POST http://localhost:4000/platform-auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_ADMIN_PASSWORD"}' | jq -r .platformToken)

# Who am I, and what may I do
curl -s http://localhost:4000/platform-admin/me -H "authorization: Bearer $TOKEN" | jq

# Every setting with its effective value
curl -s http://localhost:4000/platform-admin/settings/registry -H "authorization: Bearer $TOKEN" | jq '.[0:3]'

# A mutation without a reason — expect 400
curl -s -X PATCH http://localhost:4000/platform-admin/users/ANY_ID/status \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"status":"disabled"}' | jq
```

Checks worth doing only at this level:

| Test | Expected |
| --- | --- |
| No `authorization` header | `401 Platform administrator authentication required` |
| Tampered token (change one character) | `401` invalid or expired |
| A merchant access token against `/platform-admin/*` | `401` — merchant tokens must not work here |
| Any mutation with an empty `reason` | `400` naming the reason requirement |
| An invalid ObjectId as `:id` | `400`, never a 500 |
| An unknown export dataset | `400 Unknown export` |
| A very large payload | Rejected at the 256kb JSON limit |

---

## 7. Automated tests

Run before and after any change to the console:

```bash
npm run typecheck          # all workspaces
npm test                   # agent (837 tests) + dashboard
npm run build              # agent + dashboard + storefront
```

To run only the control-plane suite while iterating:

```bash
npx vitest run --root apps/agent src/services/platform-control-plane.test.ts
```

That file covers the permission matrix (including the pre-RBAC and unrecognised-role
cases and a 403 through the middleware), the settings registry (defaults, type
refusal, normalisation, database-unreachable fallback), coupon eligibility, CSV
quoting and the UTF-8 BOM, feature-flag bucketing stability and kill switch, and the
AI model/token overrides.

Other suites that matter for this area:

```bash
npx vitest run --root apps/agent src/api/__tests__/billing-adjustment.test.ts
npx vitest run --root apps/agent src/auth/platform-admin.test.ts src/auth/platform-session.test.ts
npx vitest run --root apps/agent src/services/platform-control.test.ts
```

If you add a console mutation, the test stub for a platform admin must carry
`role` and `permissions` — a stub without them now resolves to a role that cannot
write, and the test will fail with a `403`.

---

## 8. Destructive tests — run these last

Run each on a throwaway workspace or a local database you are happy to lose, and know
the recovery before you start.

| Test | Recovery |
| --- | --- |
| Workspace erasure | None. The workspace is gone. Use a workspace you created for the purpose |
| Retention purge | None. Deleted rows are deleted |
| Queue drain / clear failed | None. Discarded jobs do not come back |
| Maintenance mode | Turn it off in Settings — the console stays reachable by design |
| Admin IP allowlist | Remove the setting document from Mongo, or sign in from a listed address |
| Bogus AI model | Clear `ai.primary_model` in Settings |
| Disabling the last owner | Prevented by the API — if it ever succeeds, that is a critical bug |

---

## 9. Known gaps — do not file these as bugs

These are deliberate and documented in the control-plane spec:

| Behaviour | Why |
| --- | --- |
| No "sign in as merchant" (impersonation) | Needs a one-time grant and a NextAuth exchange — an authentication bypass path that deserves its own review. The permission key exists for later |
| Announcement *email delivery* checkbox sends nothing | Only dashboard delivery is live. The dialog says "flag for email delivery" |
| Coupons are never redeemed | Self-serve checkout is itself behind a feature flag |
| Notification templates other than verification and password reset do not send | The page labels them "Stored" rather than "Live" |
| Feature flags have no merchant UI yet | Resolution is observable on `/api/dashboard/platform-notices` |
| Opening a forbidden page by direct URL shows an empty table, not a "no access" message | The API correctly refuses; the nav hides the page. The empty state is a polish gap — worth a low-priority ticket, not a security bug |
| `must change password` is recorded but not enforced at sign-in | Flagged in the console; enforcement is not built |
| Provider secrets cannot be edited in the console | They stay in the deployment environment on purpose; the console only reports presence |

---

## 10. Regression smoke pass

Fifteen minutes, after any change to the console or the platform routes.

1. Sign in at `/login?access=admin`; Overview loads with real numbers.
2. Switch the Overview period; charts refetch.
3. Businesses: search, then suspend and reactivate one workspace with a reason.
4. Business detail: open it; every panel renders.
5. Users: suspend and reactivate one account.
6. Subscriptions: open a plan editor and save it unchanged.
7. Payments: refund a test payment, confirm net revenue drops.
8. Coupons: create a code, then disable it.
9. AI control: suspend and resume AI for one workspace.
10. Prompts: the live prompt is displayed.
11. Health: all rows report a state.
12. Jobs: renders (or reports unavailable without Redis).
13. Settings: toggle a boolean, confirm it persists after reload, reset it.
14. Flags: toggle a flag; check it in `/api/dashboard/platform-notices`.
15. Audit log: every action above is present with its reason and diff.
16. Repeat steps 1 and 3 as `ANALYST`: read-only, no write controls.

---

## 11. Filing a bug

Include all of these — without them a console bug is usually not reproducible:

```
Route:            /platform-admin/...
Signed in as:     role (OWNER / ADMIN / FINANCE / SUPPORT / ENGINEER / ANALYST)
Steps:            1. ... 2. ... 3. ...
Expected:         what this guide says should happen
Actual:           what happened
Network:          failing request's method, path, status, response body
Console:          any browser console error
Audit entry:      present / missing  (a missing audit entry on a mutation is high severity)
Environment:      Redis on/off, AI provider configured, email configured
Screenshot:       for anything visual
```

Severity guidance:

| Severity | Examples |
| --- | --- |
| **Critical** | A role reaching something it must not; secrets in a response; a mutation with no audit entry; erasure or purge deleting the wrong tenant's data; locking out the last owner |
| **High** | A control that silently does nothing; wrong money figures; a setting that claims to be enforced and is not; maintenance mode locking the console out |
| **Medium** | Wrong counts or filters; a missing confirmation on a destructive action; pagination faults |
| **Low** | Copy, spacing, empty-state wording, responsive glitches |
