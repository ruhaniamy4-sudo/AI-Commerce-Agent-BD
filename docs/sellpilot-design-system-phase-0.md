# SellPilot unified design system — Phase 0 audit

Date: 2026-09-05

## Mandate

Transform the existing SellPilot storefront and merchant workspace into one premium AI-commerce ecosystem. The five supplied packages are visual references only. Existing routes, tenant boundaries, APIs, persistence, order/product logic, and AI workflows remain authoritative.

This audit extends `docs/dashboard-donor-audit.md`. Its key rule still applies: reuse presentation patterns, never duplicate or replace current business models with donor/template logic.

## Reference synthesis

| Reference | Adopt | Do not copy |
| --- | --- | --- |
| Eilex | Restrained SaaS page rhythm, clear hierarchy, generous section spacing, structured feature/pricing compositions | Space imagery, serif identity, generic automation copy |
| Agex | Violet AI atmosphere, luminous depth, orbital accents, premium dark hero moments | Full-page purple saturation, decorative density that competes with content |
| Jolly AI dashboard | Calm workspace framing, narrow utility rail, obvious daily priorities, schedule/assistant balance | Personal-assistant tasks or calendar features SellPilot does not own |
| Selley sales dashboard | Dense but readable KPIs, inventory/order scanning, charts plus actionable tables | Invented metrics, stock duplication, mint brand palette |
| Chat AI landing | Conversation-first storytelling, phone/chat choreography, layered message surfaces | Its brand, copy, navigation, or separate visual identity |

## Current implementation audit

### Strengths to preserve

- Storefront has complete marketing, product, pricing, test-AI, authentication, shop, and cart routes.
- Merchant workspace already contains real conversations, customers, orders, product/inventory, AI training, knowledge, usage, integration, team, business, and security workflows.
- Product currency, nullable stock, variants, specifications, images, AI persistence, and tenant-scoped APIs are already represented in the UI.
- Both applications support light/dark behavior and compile successfully at the Phase 0 baseline.
- The homepage has a distinctive SellPilot hero, commerce phone story, animated atmosphere, and Bangladesh-specific positioning.

### System gaps

- Storefront and dashboard use related colors but separate token vocabularies, radii, elevations, spacing, and motion timings.
- Marketing subpages use an older generic blue SaaS system while the homepage uses a richer violet commerce identity.
- Dashboard information architecture is functional but visually flat: navigation is long, priority states are weak, and overview cards do not communicate relationships or next actions.
- Typography has inconsistent weights and several labels below the preferred working-interface size.
- Dark/light distribution is page-dependent rather than intentional; dark atmospheric moments and light working surfaces do not yet follow a repeatable 60/40 rhythm.
- Product pages, Test AI, Features, Pricing, and Auth do not yet share the homepage’s conversation and glow language.
- Animation is strongest on the homepage and sparse elsewhere; timing and reduced-motion behavior need one shared specification.
- Dashboard analytics are primarily isolated counters instead of a coherent merchant story: sales, conversations, order health, and product attention should scan together.

## Unified visual thesis

**Luminous commerce operating system.** SellPilot uses deep midnight-violet environments for AI, automation, and decisive moments; crisp pearl-white/lavender working surfaces for products, operations, forms, and analytics. Fine orbital lines and controlled glows imply intelligence moving through the system, while dense commerce data remains calm and readable.

### Design rules

- Palette: SellPilot midnight `#070817`, violet `#6C3BFF`, electric purple `#9A4DFF`, messenger blue `#1687FF`, WhatsApp green `#25D366`, pearl `#F8F7FF`.
- Balance: approximately 60% dark atmospheric/anchor surfaces and 40% light work/detail surfaces across complete journeys—not alternating every section mechanically.
- Typography: system sans for product clarity; display scale is compact and high contrast; body text is at least 16px on marketing pages and 14px on working surfaces.
- Radius: 12px controls, 16px cards, 24px feature panels, 32px narrative showcases.
- Elevation: four levels only—hairline, raised, floating, spotlight.
- Spacing: 4px base; page rhythm 24/32/48/72/96; working surfaces favor 20–24px padding.
- Motion: 160ms control, 280ms surface, 600ms reveal, 12–24s atmosphere. Use transform/opacity only where practical; honor reduced motion.
- Data: every KPI needs context, status, or an action; never use invented production data to imply real business results.
- Copy: concise merchant language; avoid generic AI hype and unexplained technical terms.

## Route map and page order

1. Shared foundation: tokens, typography, surfaces, motion, navigation, page shells.
2. Homepage: align the current finished hero with the shared foundation; preserve its distinctive composition.
3. Product pages: AI Chatbot and Store Builder.
4. Test AI: storefront demo and merchant testing workspace.
5. Features.
6. Pricing.
7. Authentication: sign in, sign up, reset/verification/onboarding surfaces.
8. Merchant dashboard: shell, overview, conversations, customers, orders, products/inventory, training, knowledge, usage, integrations, team, business, security.
9. Platform-admin surfaces: inherit foundation without changing administrative behavior.

## Acceptance gates

- No route, API call, mutation, schema, tenant boundary, or persistence behavior is removed or replaced.
- Storefront and dashboard use the same visual tokens and motion vocabulary.
- Each major route has a recognizable first viewport and one primary action.
- Conversation, product, order, and analytics representations use realistic SellPilot commerce content.
- Light and dark modes remain readable; reduced-motion preference is honored.
- Responsive layouts retain complete content and actions without horizontal scrolling.
- Storefront and dashboard typecheck/build; existing tests continue to pass.

