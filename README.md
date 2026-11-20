# Akmal Taufik Enterprise — Website V2

Akmal Taufik Enterprise frontend and ATE Booster manual-payment service.

> This is the experimental V2 frontend prototype for Akmal Taufik Enterprise
> (Infotech Solution). It is a visual prototype only — not the production
> website yet.

## Technology stack

- Node 24.18+ (24.x), Express 5, transactional SQLite
- Vite 7
- React 18.3
- TypeScript 5.9
- Tailwind CSS 3.4
- PostCSS + Autoprefixer
- lucide-react (icons)
- Pure CSS entrance animations (no Framer Motion / GSAP)

Path alias: `@/*` maps to `src/*`.

## Local development

```bash
npm ci
# Configure private .env using .env.example
npm run server
# In a second terminal, with matching public origin:
npm run dev
```

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # vite build -> dist/
npm run lint        # eslint
npm run preview     # preview the production build
```

## Production build

```bash
npm run build
```

Output goes to `dist/`. The build is type-checked separately via
`npm run typecheck` and linted via `npm run lint`.

## GitHub Pages deployment

Repository: `akmaltaufik123/ateweb`

The Pages workflow sets `GITHUB_PAGES=true`, configuring Vite with `base: '/ateweb/'` so assets resolve correctly under
`https://akmaltaufik123.github.io/ateweb/` instead of assuming domain root.

Deployment is automated via `.github/workflows/deploy-pages.yml`:

1. Checkout
2. Setup Node + `npm ci`
3. `npm run typecheck`
4. `npm run build`
5. Upload `dist/` as Pages artifact
6. Deploy to GitHub Pages

No credentials or tokens are stored in the repository — the workflow uses only
GitHub-provided `pages: write` / `id-token: write` permissions.

## Background media note

The hero uses a `#080A19` fallback with subtle CSS atmosphere. No external
reference video URL was bundled with this prototype, so no third-party video
dependency was introduced. If a licensed atmospheric video is approved later,
it should be mounted as an absolute full-screen `object-cover` video with
`autoplay`, `loop`, `muted`, and `playsInline`, layered beneath the content
without a heavy opaque overlay.

## Booster backend and QA

`npm test` runs isolated mocked-provider integration and migration/backup tests. `npm start` serves a prebuilt artifact. The admin dashboard is `/admin/booster`. Default and Custom Comments services are supported; payment confirmation and provider authorization are separate actions. See the deployment guide before using real credentials or customer data.

For optional browser QA, start `node server/tests/preview.js` (mock provider, memory database, loopback only) and run `node server/tests/browser-smoke.js` in another terminal. Install the Playwright Chromium browser with `npx playwright install chromium` on Linux; on Windows the runner uses installed Microsoft Edge. Screenshots go to ignored `artifacts/qa/`.
