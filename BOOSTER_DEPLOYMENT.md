# ATE Booster deployment checklist

## Required backend configuration

Set these in the server's private environment (never Vite/client variables):

- `PADOONSTA_API_KEY`: provider API key
- `PADOONSTA_API_URL`: provider endpoint (defaults to https://padooinsta.com/api/v2)
- `BOOSTER_ADMIN_TOKEN`: randomly generated secret, minimum 24 characters
- `BOOSTER_DB_PATH`: **persistent volume** path for JSON order storage (default ./data/booster.json)
- `BOOSTER_USD_MYR`: manually maintained USD/MYR conversion (default 4.47)
- `BOOSTER_MARKUP_PERCENT`: default markup on provider cost (default 30)

The JSON file is an initial single-instance store, not suitable for horizontally scaled deployments. Back it up securely. Migrate to transactional SQL before multi-instance use.

## Workflow

1. Customer selects provider service; browser POSTs to `/api/checkout`.
2. Server validates current provider service limits and records `pending_payment`.
3. Customer is redirected to WhatsApp Business +60189451570 with order reference and quote.
4. Admin visits `/admin/booster`, enters private admin token, checks received payment independently and confirms.
5. Admin explicitly submits paid order to provider once. A timeout leaves it in `submitting`; **never retry blindly** without checking provider.
6. Admin can inspect provider status, request refill or cancel if provider supports those actions.

Public provider order lookup is intentionally blocked to avoid exposing other customers' orders. Pricing is calculated server-side; public catalogue uses converted marked-up rates.

## Verification before production

- Run `npm ci && npm run typecheck && npm run build` and `node --check server/index.js`.
- Verify checkout, admin 403 without token, paid-only submission, provider failures, and restart persistence in staging.
- Confirm the deployed domain routes `/api/*` and `/admin/booster` to the Express backend; GitHub Pages alone cannot run the backend.
- Configure HTTPS, backups, and server-side monitoring.
- Admin token is entered manually each session and must not be shared with customers.
- Ensure provider terms and applicable platform rules permit the services sold.

No automatic payment verification, bank integration or provider reconciliation is implemented.