# ATE Booster security and reliability review

Reviewed starting revision: `07ff3ffd36b2298e959fa83d8578d8baf170abcc` on `feat/booster-whatsapp-secure-checkout`, including the ten branch commits and the inherited client/provider integration. Review date: 21 November 2026 (Singapore). This is an engineering source review with mocked local validation, not a penetration test or a claim about unseen production controls.

## Findings addressed

| Boundary / original source | Concrete problem | Implemented control / evidence |
| --- | --- | --- |
| Concurrent/persistent state, `server/index.js` | In-memory JSON could diverge after a failed write; independent processes could overwrite each other. No unique SQL constraints. | SQLite BEGIN IMMEDIATE transactions, FULL synchronous/WAL, unique checkout/provider/payment/operation references. Concurrency, rollback, restart and backup tests. |
| Privileged browser requests, `server/admin.html` | Shared credential sent on every request, incomplete session lifecycle and no distinct CSRF token. Unicode comparison could throw on differing byte lengths. | Credential used only for sign-in, timing-safe digest comparison, hashed expiring session IDs, host-bound Secure/HttpOnly/SameSite cookies in production, CSRF and canonical origin checks, logout. Session, Unicode, expiry, origin and production-cookie tests. |
| Public checkout | No idempotency protection, permissive URL/quantity/type validation, client estimate tied to fixed browser FX. | Durable idempotency plus payload matching, bounded JSON, URL validation, supported-type allowlist, live service checks, server MYR pricing, fixed quotes and persisted client retry key. |
| Manual payments | Any authorized click could mark payment without a receipt reference or amount record. | Independent-verification assertion, exact saved-quote amount, unique bank reference, actor/time record, separate spend authorization. No WhatsApp message/screenshot is accepted as payment. |
| Provider spending | Ambiguous submission had no reconciliation UI; concurrent duplicate requests depended on the process-local queue. | Durable paid-to-submitting claim before outbound add; no mutation retry; ambiguous result blocked, independent upstream ID attachment with notes, unique provider ID, cost/currency/service recheck. |
| Provider status | Provider status did not update the order lifecycle; completed counts/profit could stay incorrect. | Recognized status mapping, currency-checked charge recording, saved FX, stale-response and terminal-regression guards; provider-offline financial summaries remain available. |
| Refill/cancellation | Operations ignored advertised capabilities and did not preserve result history or duplicate reservations; nested cancel error could look successful. | Capability/state checks, durable unique reservation, documented response validation, accepted IDs and uncertain results audited, refill status endpoint. Cancellation is not assumed to be a customer refund. |
| Pricing/financial data | No fixed selling-rate management, settings persistence, complete receipts/costs/profit view or CSV. | SQL rules/settings, before/after audit records, immutable quote snapshots, paid-only revenue, qualified realized profit, formula-neutralized CSV, transaction history. |
| Error/privacy boundaries | Raw provider messages could reveal internal information; missing routes could return frontend HTML. | Safe response allowlists and generic provider errors, bounded upstream responses, redirect rejection, no public privileged operations, JSON API 404s, cache prevention on admin/API responses. |
| Deployment/secrets | JSON path could enter the working tree; Node 20/static Pages pipeline cannot run the backend. | Git/docker exclusions, backend-only env template, production configuration gates, Node 24 runtime, persistent-volume plan and explicit proxy trust; no production deployment assumed. |
| Dependency supply chain | npm audit initially reported ten vulnerable build/development dependency paths, including Vite/esbuild. | Updated Vite/plugin/TypeScript/lint tooling and affected transitive dependencies; npm audit returned zero known vulnerabilities after updates. |

## Covered surfaces

- Public catalogue, checkout and health routes; unsupported/legacy API denial and SPA/static routing.
- Login, cookie session lookup, session invalidation/expiry, CSRF, canonical origin, proxy/HTTPS configuration, IP rate limiting and bounded request parsing.
- Admin orders/detail, payment confirmation, paid-only submission, service pricing, settings, provider balance, financial summary/transactions/export, audit records, dispute review, status/refill/cancel/reconciliation.
- Provider form encoding, documented capabilities/types, timeouts, bounded responses, safe read retries, no retries on side effects and safe error output.
- SQL transaction boundaries/unique constraints, migrations, legacy import, persistence, online backup and restoration verification.
- Customer modal/API client, platform grouping, currency display and checkout handoff; admin DOM uses textContent for untrusted values and checks link schemes.
- Build/deployment configuration, frontend base paths, environment separation, dependency audit and Git exclusions.

Validation uses dummy principals, local databases and mocked upstream responses. Tests do not contact the real provider or submit paid orders. The detailed command results are recorded in DEVELOPMENT_RESULTS.md. An old external security coverage ledger was not available; no claim of exhaustive historical coverage is made.

## Remaining operational boundaries

- Frontend source was identified as `akmaltaufik123/at2`, branch `root`, head `dee72519f1a51e26d13da2f7331a7c9cdf054403`: exact live HTML match after removing the injected Cloudflare beacon, plus matching public GitHub Pages content. Its deployment source documents the `ate-booster-path` Cloudflare Worker for `/booster/api*`. That source has no authentication gate before provider add/balance/status/refill/cancel. The live Worker version and external access policies remain unverified; no privileged live call was made. Changes to `ateweb` do not secure the separate deployed legacy route. Independently restricting/retiring it is a production gate, requiring explicit deployment authorization.
- Cloudflare account/Pages build configuration, active Worker code/routes, TLS-to-origin policy, WAF/rate controls, secrets, logs, backups and persistent Node hosting still require owner/environment access. The current Worker cannot run Express/SQLite. A verified Node host or a separate Workers/D1 implementation is required.
- The application intentionally has one administrator credential and identity. Per-user RBAC/MFA, distributed rate limiting, multi-host SQL, payment gateway/bank integration and automatic reconciliation are not implemented.
- Target URLs are sent only to the chosen provider; this server does not fetch them. Hostname validation is not a DNS-resolving SSRF defense for the upstream provider. The provider's own target-fetch policies are outside this source.
- Status synchronization is admin-triggered. Ambiguous mutation results and interrupted requests require independent provider-account reconciliation. Repeat refill/cancel cycles are conservatively blocked.
- SQL and bank reference data require private filesystem permissions, encryption/retention decisions and host-level backup monitoring. Audit records are append-only through application APIs, not tamper-proof against a database administrator.
- Legacy JSON did not save all historical FX/type/capability facts. Import preserves original records and flags payment claims for independent review; it cannot reconstruct absent evidence.
- A restored older database may omit upstream spending after its backup. Spending must stay disabled until provider-account reconciliation is complete. Recovery steps are in BOOSTER_DEPLOYMENT.md.

These are explicit readiness limits. Local tests do not establish production security or authorize deployment.
