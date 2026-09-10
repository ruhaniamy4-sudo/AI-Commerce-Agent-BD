# SellPilot completion roadmap — September 8, 2026

This is a working checklist, not a release certification. Preserve the existing worktree, backend connections, and the separate admin/billing work.

## Sequence and acceptance

1. Public experience: validate the existing compact inquiry/phone hero; complete pricing preview, showcase, features, CTA and footer. Check motion, navigation and responsive layouts.
2. Merchant workspace: audit Overview, Conversations, Products/Inventory, Orders, Customers, Analytics, Knowledge and Settings. Preserve actual queries and mutation controls; expose missing navigation and failure states.
3. Onboarding: guide business type, information, payment preferences, product sources and training through existing APIs. Resume from saved business state; handle completion errors.
4. Training: show readiness from saved evidence with an explanation, plus direct paths to brand voice, delivery, payments, returns and FAQs. Never present a setup percentage as measured AI accuracy.
5. Integrations: clearly distinguish connected, disconnected, unavailable and failed-to-load states. Keep real Facebook and courier authorization handlers; explain website and payment setup.
6. QA: typecheck, lint, production build; public and authenticated checks at 1920×1080, 1440×900, 1280×800 and 390×844. Record unverified workflows explicitly.

## Confirmed dependencies

- Subscription checkout currently returns `payment_required` for paid plans; no online provider is configured. The user selected bKash. A gateway adapter, server-side sandbox credentials, callback configuration and payment verification still need implementation/validation in the billing workstream. No automatic payment connection is claimed.
- WhatsApp remains coming soon. A visual connection card is not evidence of an operational integration.
- Authenticated merchant and platform-admin sessions are required to verify real screens. Do not bypass authentication or invent successful payments.

## Current progress

- Existing hero already implements requested headline, compact platform inquiries, central phone, continuous cycle and pause/reduced-motion support.
- Added homepage pricing preview using the shared pricing component and existing early-access messaging.
- Inventory now has a dedicated route, paginated real product data, active-variant quantities, low-stock alerts, unknown-stock states, recorded units sold and catalog detail links. Counts explicitly apply to the current page.
- Added Inventory and Categories to merchant navigation, preserving existing product editor and performance work.
- Fixed onboarding redirect/resume behavior for an existing business with incomplete setup. Added payment preferences through the existing commerce API, separated subscription billing from accepted customer payment methods, preserved saved ordering rules, and added completion error handling.
- Added a training coverage panel calculated from saved guided answers. Six configuration links lead to Products, Brand Voice, Delivery, Payments, Returns and FAQs. Coverage is explicitly not an accuracy score.
- Added integration section navigation, load/error states, status retry, courier disconnect confirmation, website setup guidance and accurate bKash/WhatsApp availability.
- Added an escaped, downloadable order invoice from recorded order data. Replaced the unconditional “Verified Transaction” badge with the actual payment status and removed the invented fallback SKU.

## Validation in this continuation

- Repository typecheck passed; lint passed with four existing image optimization warnings.
- Full production build passed. Storefront build logged a catalog fetch warning while the local API was unavailable; this is not a successful real catalog/checkout test.
- Dashboard typecheck/lint/build repeated successfully after the order invoice changes.
- Existing onboarding and public checkout regression suites: 6 tests passed. These use mocked dependencies, not live payment settlement or merchant data.
- Homepage hero inspected at all four requested viewport settings, with no horizontal document overflow. Mobile pricing preview also inspected. Browser captures immediately after viewport changes had inconsistent framing; these are not a full visual certification of every page at every size.
- Public homepage, Demo, Signup and Cart returned HTTP 200.
- Signed-in merchant/admin validation is pending: the browser redirects to login and the user has been asked to sign in. No authentication bypass or live order/payment submission was performed.
- Local development processes restarted after builds to restore a clean runtime.
- The API still reported startup without a TCP listener after restart. Normalizing `PORT` to a validated integer and explicitly binding the HTTP server restored connectivity. The subsequent `/health` response reported `ok`, API up and MongoDB connected; Redis, email and Facebook remain unconfigured.

## Release gates still open

1. Complete authenticated visual and interaction checks across the four requested sizes, including customer histories, conversation takeover, orders/invoice export, analytics, business/team settings and platform-admin billing/revenue.
2. Implement and validate bKash online settlement; verify merchant/provider configuration. Payment preferences alone do not implement a gateway.
3. Implement/validate WhatsApp and external website widget installation, plus configured Facebook authorization. Current startup reports Facebook unavailable.
4. Configure authentication email for verification/recovery and Redis/worker services for queue-dependent ingestion. Current local startup reports both unconfigured.
5. Finish end-to-end signup, training/import, channel reply, checkout, courier and billing tests in an authorized sandbox. The platform is **not yet certified complete**.
