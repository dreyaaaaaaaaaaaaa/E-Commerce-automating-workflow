# n8n integration blueprint

## Recommended architecture

Keep scraping in the Python worker and use n8n as the orchestrator. Do not rebuild
Playwright/browser behavior inside Code nodes. The browser profiles, raw evidence,
rate limits, deduplication, and SQLite history already belong to the collectors.

```text
n8n trigger
  -> Reddit collection worker (the only discovery source)
  -> fetch READY_FOR_AI posts
  -> AI 1: extract or reject an opportunity
  -> persist accepted opportunities
  -> deduplicate accepted product queries
  -> AliExpress search (details=0)
  -> deterministic candidate pre-filter
  -> AliExpress detail scrape in batches of <= 5
  -> AI 3: evidence-based product evaluation
  -> persist shortlist / send review notification
```

The two browser collectors must not run concurrently because they use persistent
browser profiles and may need a visible CAPTCHA intervention. Configure n8n with a
single-concurrency scraper queue. Let independent AI calls run in parallel only
after collection has finished.

## Deployment choice

- Self-hosted n8n on the same Windows machine: call the worker over localhost.
- n8n in Docker on that machine: call `host.docker.internal`, not `127.0.0.1`.
- n8n Cloud: it cannot call this machine's localhost. Run a private authenticated
  worker reachable through a VPN/private connector. Do not expose the current
  unauthenticated AliExpress API directly to the internet.

The current AliExpress API is synchronous and already supports search and detail
scraping. Reddit is CLI-only. Before making this production-like, add one local API
in front of both collectors and make browser jobs asynchronous:

```text
POST /v1/reddit/runs                 -> 202 { job_id }
GET  /v1/jobs/{job_id}               -> queued|running|complete|blocked|failed
GET  /v1/reddit/items?status=READY_FOR_AI&after_id=...
POST /v1/aliexpress/searches         -> 202 { job_id }
POST /v1/aliexpress/scrape-batches   -> 202 { job_id }
```

Until that API exists, n8n can use Execute Command for Reddit and HTTP Request for
AliExpress. This is suitable only when n8n runs on the scraper machine.

## Workflow nodes

1. **Schedule Trigger** : run Reddit discovery once per day or manually while tuning.
2. **Execute Command: collect Reddit** : use safe-run and a visible browser initially.
3. **Execute Command: list items** : request only `READY_FOR_AI` items.
4. **Split Out** : one item per execution.
5. **AI: Opportunity extraction** : use `prompts/n8n/01-opportunity-extractor.md` and
   require the matching structured JSON output.
6. **IF accepted** : store rejects with their reason; continue only accepted items.
7. **Data Store / database upsert** : key by `source + source_id`. Never rely only on
   n8n execution history for deduplication.
8. **Code** : normalize and deduplicate accepted supplier-search queries.
9. **Split Out queries** : enforce a maximum of two queries per accepted opportunity.
10. **HTTP Request: AliExpress search** : `POST http://127.0.0.1:8787/search` with
    `details: 0`; do not open every product page yet.
11. **Code/Filter** : remove duplicate product IDs and candidates missing a title or
    price. Select at most five promising IDs per cluster using only search metadata.
12. **HTTP Request: detail batch** : `POST /scrape-batch`, maximum five IDs. Use a long
    timeout and do not retry `blocked` responses in a tight loop.
13. **AI: Product evaluator** : send the opportunity plus detailed snapshots to
    `03-product-evaluator.md`.
14. **Database upsert** : persist the decision, evidence URLs, prompt version, model,
    source IDs, product IDs, and scraper run IDs.
15. **Human review** : notify only when a candidate passes the configured threshold or
    when a browser job is blocked and needs intervention.

## n8n request bodies

AliExpress search:

```json
{
  "query": "={{ $json.query }}",
  "country": "PL",
  "limit": 10,
  "details": 0,
  "headless": false,
  "wait_seconds": 15,
  "captcha_wait_seconds": 120
}
```

AliExpress detail batch:

```json
{
  "products": "={{ $json.product_ids }}",
  "country": "PL",
  "headless": false,
  "wait_seconds": 12,
  "captcha_wait_seconds": 120
}
```

Use n8n's native JSON body mode so `product_ids` remains an array.

## State and retry rules

- Use immutable source identifiers: Reddit `source_id` and AliExpress `product_id`.
- Record `prompt_version` with every AI output. The prompts in this repository are v1.
- Retry network/5xx failures with exponential backoff, at most three attempts.
- Do not automatically retry CAPTCHA/`blocked` results. Route them to human review.
- Treat an AliExpress `partial` snapshot as usable but incomplete; the evaluator must
  lower confidence for missing fields.
- Resume `remaining_product_ids` from a batch instead of repeating completed IDs.
- Keep the original post URL and product URL beside every decision for auditability.

## What is still needed for an exact n8n import

Export the existing n8n workflow as JSON (credentials can remain redacted). With that
file, node names, expressions, data mappings, error branches, and the rewritten prompts
can be placed directly into the workflow rather than described generically.
