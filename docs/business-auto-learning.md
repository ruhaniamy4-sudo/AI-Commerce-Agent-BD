# SellPilot business auto-learning

The merchant flow is **Connect → Learn → Review → Sell**. Imported information is staged first; it does not become customer-facing until a merchant approves it.

## Sources

- Website: public HTTP/HTTPS pages, structured ecommerce feeds, JSON-LD, sitemap-discovered pages, and limited same-domain HTML discovery.
- Facebook: business information returned by an already-authorized Meta Page connection. Missing or expired Meta permission affects only that source.
- Files: PDF, DOCX, TXT, CSV, and XLSX, up to the configured file-size limit.
- Manual: the existing Products and Business Knowledge screens remain available.

Products are staged for the Product/Category inventory models. FAQs, policies, and other business facts are staged for Knowledge/RAG. Files are classified instead of being copied wholesale into an AI prompt.

## Review and safety

Exact signals include SKU, barcode, canonical URL, and source identity. Exact duplicates can be merged safely; probable matches require a merchant decision. Price, stock, and policy changes are conflicts and are never silently applied over merchant-confirmed data.

Every source, run, candidate, Product, and Knowledge query is tenant-scoped by the active `businessId`. The models fail closed when no tenant context is present. Rescans use stable source and item fingerprints, so repeated imports update staging records rather than creating another copy.

Website fetching blocks local, private, link-local, metadata, unsupported-protocol, and credential-bearing URLs. Redirect destinations are revalidated. Fetches have time, response-size, page-count, content-type, and redirect limits. JavaScript from imported pages is never executed.

## Configuration

Optional limits:

```env
INGESTION_MAX_PAGES=12
INGESTION_FETCH_TIMEOUT_MS=10000
INGESTION_MAX_RESPONSE_BYTES=2000000
INGESTION_MAX_FILE_BYTES=10000000
```

Facebook Page import uses the encrypted Page token on the selected tenant connection. It is capability-gated by `pages_read_engagement`; commerce/catalog data needs a separate reviewed integration and is never inferred from customer messages.

For an existing database, run `npm run migrate:training-indexes` once. The command is idempotent: it creates missing declared indexes and does not drop merchant data.
