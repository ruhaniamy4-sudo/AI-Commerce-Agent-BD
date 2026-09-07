# Customer intelligence roadmap and checkpoints

## Phase 0 — Audit

Existing data: tenant-scoped Customer (phone, email, page identity, orders/spend), Conversation (channel, control mode, sales stage, metadata), Message (attachments, products, intent, human source), Product/inventory, Knowledge, Order (payment status and Steadfast courier state). Authentication establishes AsyncLocalStorage tenant context; model hooks scope queries and aggregation. Public website channels resolve a tenant separately. Messenger already validates signatures and queues idempotent events. Steadfast already provides credential management and shipment synchronization. Merchant billing is separate from customer payments.

Frontend: merchant customers directory, conversation detail, assistant test/live workspace, analytics and integration settings exist. Sandbox sessions must never contribute to production customer intelligence. Current assistant risk/delivery formulas are uncalibrated and must be removed.

Missing: durable customer event ledger, anonymous sessions/identity linking, website behavior tracking, WhatsApp adapter, courier/payment normalized evidence, scoring provenance/confidence, and durable recommendation workflow.

Implementation sequence: (1) tenant event ledger and projection service; (2) restricted public tracking and storefront instrumentation; (3) Messenger evidence; (4) WhatsApp signed ingress and outbound transport; (5) courier evidence normalization; (6) verified payment evidence; (7) trust scoring; (8) multi-signal intelligence; (9) dashboard timeline/intelligence; (10) persisted merchant actions; (11) full validation.

API plan: authenticated customer timeline/intelligence/actions; channel-scoped public tracking; provider-specific verified ingress. Never trust browser-submitted customer IDs, paid amounts, delivery outcomes or tenant IDs. Provider credentials must remain server-side. External provider live verification depends on provisioned accounts and credentials; document unverified provider capabilities rather than reporting simulated calls as live integrations.

Compatibility: retain all auth, tenancy, order/stock and AI flows. Extend central persistence points. Events use stable deduplication keys; repeat webhooks must not inflate scores. Anonymous tracking has retention and contains allowlisted metadata only. Identity association requires a server-validated interaction, never an arbitrary browser customer ID. Probabilities require observed outcomes; behavioral heuristics are identified as scores, not calibrated probabilities.

Git: the repository started with extensive uncommitted previous work. Commit only changes made for this roadmap; preserve existing work.

Validation strategy: phase-specific unit/API tests plus backend typecheck. Frontend phases additionally check frontend types. Final pass runs workspace typechecks, lint, tests and builds. Run browser/API checks without sending messages to real customers or charging payments.

### Checkpoints

- Phase 0: audit complete. Existing Test AI and conversation-control regression tests and backend typecheck used as baseline. No implementation changes in this phase.
- Phase 1: added tenant-scoped, indexed, deduplicated event ledger, timestamp/payload validation, sandbox exclusion, anonymous retention and authenticated customer timeline API. Event contract tests cover identity, browser privilege boundaries and sandbox exclusion. Existing application bootstrap changes are preserved in the integration commit.
- Phase 2: public channel-scoped tracking session/event endpoints; allowlisted browser payloads; random hashed visit bearer tokens; storefront page/product/search/cart/checkout instrumentation; server checkout association; 90-day anonymous retention and abandonment reconciliation. Backend/storefront types and 8 contract/checkout tests passed. Checkout association is not proof of phone ownership. Existing storefront/public-checkout changes are retained in touched files.
- Phase 3: Messenger and web messages project channel/customer identity, message history, support requests, human/AI attribution and measured response time into the ledger. Replay recovers missed projections; analytics errors do not fail customer replies. Existing signature validation and queue delivery remain intact. Backend typecheck and 15 event/tracking/Messenger tests passed.
