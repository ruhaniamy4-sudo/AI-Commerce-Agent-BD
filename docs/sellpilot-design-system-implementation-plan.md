# SellPilot design system implementation plan

## Phase 1 — Foundation and homepage alignment

- Create matching storefront/dashboard tokens for color, spacing, radius, elevation, and motion.
- Standardize navigation, page headers, cards, badges, fields, data surfaces, and focus states.
- Reconcile the finished homepage with the shared system without rebuilding it.
- Gate: homepage remains visually intact; both apps typecheck.

## Phase 2 — Product journeys

- Recompose AI Chatbot around conversation → recommendation → checkout → tracking.
- Recompose Store Builder around launch → catalog → inventory sync → live operations.
- Preserve current routes and calls to action.
- Gate: both product pages are responsive and visually belong to the homepage.

## Phase 3 — Test AI and feature system

- Make Test AI a conversation-first interactive surface with visible business context and deterministic states.
- Consolidate Features into a clear capability architecture with live/coming-soon status.
- Gate: no raw JSON leaks; empty/loading/error states remain legible.

## Phase 4 — Pricing and authentication

- Clarify plan comparison, inclusion hierarchy, and early-access language.
- Bring sign-in, sign-up, recovery, verification, and onboarding into one trusted identity system.
- Gate: forms retain validation, routes, redirects, and keyboard behavior.

## Phase 5 — Merchant workspace shell and overview

- Introduce Jolly-inspired calm framing and Selley-inspired commerce density.
- Group navigation by daily work, AI, and business administration.
- Rebuild overview hierarchy around attention, performance, and recent activity using existing data only.
- Gate: role visibility and logout/theme behavior remain unchanged.

## Phase 6 — Operational workspaces

- Conversations/customers: stronger master-detail and status scanning.
- Orders/products: readable tables, stock/availability semantics, filters, forms, and action hierarchy.
- Training/knowledge/Test AI: one AI workspace language with progress and persistence cues.
- Usage/integrations/team/settings/security: consistent administrative patterns.
- Gate: existing queries and mutations remain untouched except for presentation-safe composition.

## Phase 7 — Validation and cohesion pass

- Responsive review at mobile, tablet, laptop, and large desktop sizes.
- Verify dark/light/system themes and reduced motion.
- Run type checks, tests, lint where supported, and production builds.
- Remove temporary reference files; preserve user environment files and unrelated work.

