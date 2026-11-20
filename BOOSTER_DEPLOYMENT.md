# ATE Booster deployment and operations

## Verified repository and production evidence (21 November 2026, Singapore)

- Repository: `akmaltaufik123/ateweb`; default branch `main` at `7f034b1` when fetched.
- Development branch: `feat/booster-whatsapp-secure-checkout`, initially `07ff3ffd36b2298e959fa83d8578d8baf170abcc`; PR https://github.com/akmaltaufik123/ateweb/pull/1.
- `main` is an ancestor of the development branch. A local merge reports already up to date; no textual conflict exists locally. GitHub initially reported the draft PR as non-mergeable; inspect its refreshed state/checks after push.
- The only original deployment workflow publishes static `dist/` to GitHub Pages from `main`. It cannot run Express or SQLite. This work adds a validation workflow, not a production deployment workflow.
- A read-only GET of https://akmaltaufikenterprise.my/booster/ returned HTTP 200 through Cloudflare. Its HTML is a standalone page, titled `ATEBooster | Akmal Taufik Enterprise`, using `/booster/api`, custom browser markup, and a fixed exchange rate. It differs from this repository's React entry point and root `/api` calls.
- Further connected-repository investigation identified the frontend source: [akmaltaufik123/at2, branch root](https://github.com/akmaltaufik123/at2/tree/root), head `dee72519f1a51e26d13da2f7331a7c9cdf054403`. The live HTML matches `booster/index.html` exactly after removing Cloudflare's injected analytics script (80,221 characters). The public Pages URL https://akmaltaufik123.github.io/at2/booster/ also serves that source. This identifies the frontend content/branch; the active Pages build configuration still requires hosting access.
- [The at2 deployment guide](https://github.com/akmaltaufik123/at2/blob/root/deploy/booster-path/README.md) documents GitHub Pages static hosting plus a Cloudflare Worker. Its `wrangler.toml` names `ate-booster-path` and routes `akmaltaufikenterprise.my/booster/api*`. The Worker source forwards services, balance, add, status, refill and cancel, using an environment secret. The source contains no authentication check before privileged provider operations. This is a source-grounded deployment blocker; active Worker code/version and any external access policies are unverified. No live privileged operation was tested.
- The existing Cloudflare Worker runtime cannot run this Node/Express/SQLite server. Production migration needs an explicitly provisioned Node 24 backend with durable storage and verified route changes, or a separately designed Workers/D1 port. This change implements the Node backend; it does not silently replace the deployed Worker or create hosting resources.
- Cloudflare account routes, deployed Worker version, secret names/availability, Pages configuration and backend persistence remain unverified. No DNS, secrets, production services or deployment were changed.
- Provider documentation was read at https://padooinsta.com/api. It documents `/api/v2`, POST form encoding, services, add, status, balance, refill, refill_status and cancel. Default orders send link/quantity; Custom Comments send link/comments and derive quantity from nonempty lines. Cancel success is an array containing `{order,cancel:1}`. Other service types require additional forms and remain unavailable publicly.

## Runtime and private configuration

Use Node **24.18 or newer within 24.x**. `node:sqlite` provides transactional storage without a native npm addon. Node 20 (the original CI runtime) is not supported. Run one application replica, with a persistent local filesystem volume; do not use serverless/ephemeral disks or a network-mounted SQLite database. Multiple HTTP requests are safe; multi-host deployments need a separate PostgreSQL design and shared rate limiter.

Copy `.env.example` to private `.env` locally, or configure equivalent hosting environment variables:

- `PADOONSTA_API_KEY`: backend-only provider key; required for live catalogue, balance and operations.
- `PADOONSTA_API_URL`: HTTPS endpoint; default `https://padooinsta.com/api/v2`. Redirects are rejected to protect the key.
- `BOOSTER_ADMIN_TOKEN`: high-entropy random secret of at least 32 characters. It is used only at sign-in; never build it into Vite variables. The deployment supports one administrator identity, not individual multi-user accounts or MFA.
- `BOOSTER_PUBLIC_ORIGIN`: exact scheme and host, without trailing slash/path. Production requires HTTPS, e.g. `https://staging.example.com`.
- `BOOSTER_DB_PATH`: absolute file path on a persistent volume, e.g. `/data/booster.sqlite`. Required explicitly in production. Relative path is allowed in local development only.
- `BOOSTER_TRUST_PROXY`: explicit trusted proxy addresses/CIDRs, e.g. `loopback` for local Nginx. Do not set blanket trust. A container needs its actual proxy network configured and direct external access blocked.
- `BOOSTER_PROVIDER_CURRENCY`: `USD` or `MYR`. Verify against the account balance response. Submission blocks a currency mismatch with the saved quote.
- `BOOSTER_USD_MYR`, `BOOSTER_MARKUP_PERCENT`: initial settings only (defaults 4.47 and 30). Dashboard changes persist in SQL and take precedence after initialization. Never treat 4.47 as a current market rate; maintain the rate yourself.
- `BOOSTER_PROVIDER_TIMEOUT_MS`: defaults 15000. Read-only operations can try twice; charge-bearing mutations never automatically retry.
- `NODE_ENV=production`, `HOST`, `PORT`: Node process configuration. Defaults bind loopback:3000 locally. Containers use `HOST=0.0.0.0` behind a trusted TLS proxy.
- `VITE_BASE_PATH`: frontend BUILD setting, `/booster/` when mounted there, `/` for a dedicated host, `/ateweb/` for the static Pages preview. Secrets must never have `VITE_` prefixes.

Production requests require HTTPS as observed through the explicitly trusted proxy. Cookies are Secure, HttpOnly, SameSite=Strict, domain-host scoped and expire after eight hours. Session identifiers are hashed in SQL. The admin HTML is public, but every order, financial, settings and audit API requires an authenticated session; mutations also require a session CSRF token. Sign out clears the session and displayed data. Use a private browser on shared computers.

## Build and route contract

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
node --check server/index.js
npm start
```

Set `VITE_BASE_PATH=/booster/` before the build for that mount. `npm start` runs the already-built server; it does not rebuild or install dependencies during restart. Development uses `npm run server` plus `npm run dev` in separate terminals; the Vite proxy targets 127.0.0.1:3000. Use `BOOSTER_PUBLIC_ORIGIN=http://localhost:5173` for browser mutations through Vite; direct server preview uses http://localhost:3000.

The Node server serves `/`, `/booster/`, built assets, `/api/*`, and `/admin/booster` plus its script/styles. API responses never fall back to SPA HTML. The live application's `/booster/api` is a DIFFERENT contract. Use `deployment/nginx-booster.conf.example` only after checking existing root `/api` and `/admin` ownership. Do not route the old live frontend into this backend without migrating its checkout contract. A separate staging hostname is preferable for validation. Static Pages remains a visual preview; its API features need the Node backend on a properly configured same origin.

A multi-stage Dockerfile builds, checks and tests the artifact and runs as the non-root `node` user. Mount `/data`, inject private runtime configuration, expose the container only to the TLS proxy and verify volume ownership. Its health check confirms database access without secrets. Docker execution and hosting integration require validation on the chosen host; this workspace does not establish that environment.

## Payments, pricing and provider workflow

1. Backend fetches fresh service data for checkout, validates type/target/limits, calculates MYR price, and atomically saves the quote with a unique checkout idempotency key. The client retains that key after a lost response or refresh.
2. WhatsApp Business defaults to **+60189451570**. The saved reference and exact MYR quote are included. A failed handoff leaves the saved reference and a link visible. Creating or opening WhatsApp never submits to the provider.
3. Admin independently checks the actual bank receipt, records the unique transaction reference and confirms the exact quoted amount. Record a bank transaction reference only, not bank account/card data. Screenshots/messages alone do not qualify.
4. Admin separately authorizes provider spending. SQL claims the paid order before the outbound request. Service, currency, limits and estimated cost are rechecked; a discontinued/disabled service or increased cost blocks submission. The original customer quote never changes.
5. Add failures, timeouts, missing IDs and interrupted submissions remain `submitting` or `reconciliation_required`. Do not retry. Search the upstream account by service, target, quantity and submission time. If the accepted provider ID is independently matched, attach it using Reconcile with a note. A status lookup alone does not prove the order belongs to the customer.
6. If no upstream order can be conclusively identified, resolve with provider support and the customer; do not manually reset SQL to paid. An automatic retry/release after ambiguous spending is intentionally unavailable.
7. Admin synchronizes provider status manually. Completed, partial, cancelled and failed statuses are mapped; provider charges in the quoted currency yield actual MYR costs using the saved FX. Out-of-order responses cannot overwrite newer syncs; changed terminal states require independent review.
8. Refill/cancel require current advertised capability and appropriate order status. Each is durably reserved before calling upstream. Requests, accepted references and uncertainty are audited. One request per kind per order is allowed conservatively; repeat refill cycles and automated retries are not enabled. Refill status can be checked for accepted refill references. Uncertain refill/cancel requests require provider-account reconciliation; they cannot be repeated through this app.
9. Cancellation acceptance does not mark completion or issue a customer refund. Synchronize order status. Customer refunds/chargebacks are external manual processes; flag a dispute with a note to block new spending and exclude it from realized profit.

Revenue is confirmed receipts. Estimated cost/profit are quote snapshots. Realized profit includes completed, undisputed orders with a reported actual provider charge. It excludes unresolved/partial orders and does not claim to be statutory accounting or bank reconciliation. Financial CSV neutralizes spreadsheet formulas. Payment records, order events, pricing/settings changes and exports are retained transactionally.

## Migration, backup and recovery

Schema migration v1 runs transactionally on startup. Tables: `migrations`, `orders`, `pricing`, `settings`, `payments`, `events`, `operations`, `sessions`. SQL constraints enforce unique checkout keys, provider IDs, bank receipt references and operation reservations. WAL plus FULL synchronous durability is used; commits precede external side effects. Store data outside `dist/` and the checkout. Restrict directory access to the application user, encrypt backups/storage at the hosting layer, and never publish SQL/JSON data or secrets in Git.

For legacy JSON, stop the old writer, preserve a private original backup, then import into an EMPTY destination before starting this server:

```sh
npm run db:import -- /private-backup/booster.json /data/booster.sqlite
```

Import is all-or-nothing and refuses a nonempty destination. Quoted prices and upstream references are preserved. Legacy paid flags lack independent bank verification and are marked for payment review; a screenshot or old flag is not promoted into a verified SQL receipt. Legacy `submitting` becomes reconciliation-required. Re-verify migrated payments in the dashboard. Imported service operation flags default disabled; do not invent missing upstream capabilities. The original JSON is untouched. Settings not stored in the old JSON must be configured explicitly, including the actual historic FX where known. Review imported orders before enabling spending; original code did not record historic FX or service type, so those defaults cannot establish historical truth.

Create online backups with SQLite's backup API (not by copying only a live `.sqlite` file while WAL is active):

```sh
npm run db:backup -- /data/booster.sqlite /private-backup/booster-YYYYMMDD.sqlite
```

Destination must not exist. The command checks database integrity. Schedule encrypted off-host backups at the hosting layer, with a retention policy appropriate to payment records, and restrict their access. Target RPO/RTO and retention require owner decisions.

Recovery drill: stop the server, retain the current database and its WAL/SHM files together, validate a backup using `PRAGMA integrity_check`, restore that backup to the configured persistent path with correct ownership, remove old sidecars ONLY after retaining the stopped database set, and start one instance. Review counts, receipts, audit history and upstream references. Clear restored sessions before exposing the service. **Restoring older SQL can resurrect paid orders whose upstream submission happened after the backup.** Keep provider spending disabled until every affected order is reconciled against the upstream account. Do not run a restored database concurrently with the old instance. Migration rollback uses a pre-migration backup; application rollback must remain compatible with SQL and the payment workflow.

## Staging acceptance and production gate

Local automated tests use mocked upstream responses only; `node server/tests/preview.js` launches a loopback-only in-memory fixture for visual QA using the dummy credential in that fixture. Never use it as the live server.

Before requesting production approval:

1. Obtain read-only Cloudflare and GitHub Pages deployment access to verify the identified `at2/root` source, Pages build settings, active `ate-booster-path` code/version/routes and any external access policies. Identify existing root `/api` consumers. Choose/provision the Node staging host with an actual persistent volume; verify storage survives restart/redeploy. Before launch, independently restrict or retire the legacy privileged provider proxy under explicit production authorization.
2. Create an isolated staging target with HTTPS, private secrets, its own SQL volume and a mocked upstream. Run CI and Docker/host validation, then repeat desktop/mobile checkout and all admin actions with fixture orders. Check CSP, cookie flags, proxy/IP handling, CSRF, provider errors and timeouts.
3. With owner-provided provider credentials, verify services and balance read-only. Check currency and supported service forms. Do not create paid upstream orders to test connectivity.
4. Perform the JSON migration and backup/restore drill on a private COPY. Independently verify quote, payment, provider and audit counts.
5. Confirm runtime logging, health monitoring, backup schedule/retention, incident contact, administrator ownership and single-replica process supervision. Never log provider keys, credentials, receipt payloads or raw provider errors.
6. Obtain explicit production deployment authorization after presenting the verified target, passing checks, route changes, rollback artifact and staging results. Deploy during an agreed window, verify customer handoff and local records without real upstream spending, and monitor.

No merge to main, production deployment, DNS modification, credential rotation or financial transaction is authorized by completion of local development alone.
