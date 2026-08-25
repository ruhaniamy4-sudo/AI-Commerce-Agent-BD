# Dashboard donor audit

The `Ai-Agent-Sprint` repository was inspected as a donor only. The current `AI-Commerce-Agent-BD` architecture remains authoritative.

| Area | Decision | Reason |
| --- | --- | --- |
| Authentication and tenancy | Keep current | Donor predates the current account onboarding, tenant context, and stronger role enforcement. |
| Conversations | Merge presentation ideas | Keep current tenant-safe APIs, persistence, takeover controls, and clearer commerce language. |
| Customers and orders | Keep current | Current models and routes include tenant enforcement and newer Steadfast state. |
| Product management | Keep current | Current Product already owns price, variants, SKU, images, and stock. |
| Donor Inventory model/page | Reject | It duplicates Product stock, lacks the current tenant plugin, and could create conflicting inventory truth. |
| Analytics cards/tables | Reuse visual patterns only | Donor analytics includes invented projections and trends, so only generic responsive card/table patterns are appropriate. |
| Knowledge | Keep current | Current Knowledge/RAG writes are tenant-scoped and feed the real AI pipeline. |
| Manual Test | Hide | Replaced for merchants by the real persistent `/test-ai` workflow. |
| Meetings, availability, hosts | Retain code, hide navigation | Potentially useful later for service businesses but not core commerce MVP. |
| Raw prompts, errors, unanswered/debug controls | Hide or platform-admin only | They create developer clutter and are inappropriate for normal merchant Staff users. |
| Brands | Reject for this milestone | Adds another taxonomy beside current categories without a demonstrated MVP need. |
| Shared UI components | Keep current / selectively reuse | The repositories share the same component family; current versions win where they differ. |
