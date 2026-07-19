# TikTok-Style E-Commerce (Astro + Headless WooCommerce)

Video-first storefront: vertical product video feed with wishlist, reviews
(bottom-sheet modal), share, and checkout by direct bank transfer. Built
for Nawaaz's Cape Town-based photographic/printing retail business.

## Stack

- **Frontend**: Astro with the `@astrojs/cloudflare` adapter (`output:
  'hybrid'`), deployed as a single Cloudflare Worker via `wrangler deploy`.
  Served at `yourdomain.co.za/store/` — a PATH on the primary domain, not a
  subdomain (Xneelo charges extra for those; see `docs/DEPLOYMENT.md`). The
  Worker binds directly to `/store/*` via `wrangler.jsonc`'s `routes`;
  everything else on the domain still goes straight to WordPress.
- **Backend**: WordPress + WooCommerce (headless, REST API only) on Xneelo,
  on the primary domain, unchanged
- **Video**: Cloudflare R2 + CDN
- **Payments**: WooCommerce Direct Bank Transfer (BACS) — no gateway
  account needed; orders go "on-hold" until the transfer is manually
  confirmed. Easy to swap in a real gateway later (see `docs/DEPLOYMENT.md`).
- **Spam protection**: Cloudflare Turnstile (not Google reCAPTCHA)
- **Server logic**: `src/pages/api/*.ts` — server-rendered Astro API
  routes (part of the same Worker), keeping all secrets (WooCommerce keys,
  Turnstile secret) server-side only

## Local development

```
npm install
npm run dev
```

The dev server runs against `src/data/mockProducts.ts` mock data — no
WooCommerce connection needed to work on UI. Copy `.env.example` to `.env`
for local values.

To exercise the real API routes locally (checkout/reviews/contact, KV
rate limiting), use `npx wrangler dev` after `npm run build`, with a local
`.dev.vars` file for secrets — `astro dev` alone doesn't have access to
Cloudflare bindings (KV, etc.).

## Project layout

```
src/
  components/     VideoFeed, VideoCard, OverlayButtons, ReviewModal, ShareModal, BottomNav
  layouts/        Layout.astro (shell + bottom nav + cart pill)
  pages/          index (feed), shop, shop/[category], product/[slug],
                  contact, account, cart, checkout, checkout/success
  pages/api/      products, reviews, checkout, contact (server-rendered API routes)
  lib/            woocommerce.ts (server), security.ts, api.ts (client), cart.ts, base.ts
  data/           mockProducts.ts (placeholder catalog)
wrangler.jsonc    Worker config: bindings, non-secret vars, /store/* routes
scripts/          postbuild.mjs (fixes .assetsignore placement — see DEPLOYMENT.md)
docs/             SECURITY.md, DEPLOYMENT.md, R2_SETUP.md, PERFORMANCE.md
```

## Phase checklists

See `docs/DEPLOYMENT.md` for the full Xneelo + Cloudflare Worker + path-based
routing rollout, `docs/R2_SETUP.md` for video hosting, `docs/SECURITY.md`
for the anti-spam/hardening stack, and `docs/PERFORMANCE.md` for the
performance checklist.

## Status

Frontend UI and API scaffolding are built against mock data and ready to
wire up to a live WooCommerce/R2 backend. Config is in place for
deployment as a Cloudflare Worker — see `docs/DEPLOYMENT.md` for the
remaining steps (secrets, KV namespace, going live).
