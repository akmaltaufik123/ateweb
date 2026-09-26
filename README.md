# Akmal Taufik Enterprise — Website V2

Experimental redevelopment of the official Akmal Taufik Enterprise website.

> This is the experimental V2 frontend prototype for Akmal Taufik Enterprise
> (Infotech Solution). It is a visual prototype only — not the production
> website yet.

## Technology stack

- Vite 5
- React 18.3
- TypeScript 5.5
- Tailwind CSS 3.4
- PostCSS + Autoprefixer
- lucide-react (icons)
- Pure CSS entrance animations (no Framer Motion / GSAP)

Path alias: `@/*` maps to `src/*`.

## Local development

```bash
npm install
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

Vite is configured with `base: '/ateweb/'` so assets resolve correctly under
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
