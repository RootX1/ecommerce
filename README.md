# TikTok-Style E-Commerce (Astro + Headless WooCommerce)

Video-first storefront: vertical product video feed with wishlist, reviews
(bottom-sheet modal), share, and checkout by direct bank transfer. Built
for Nawaaz's Cape Town-based photographic/printing retail business.

## Stack

- **Frontend**: Astro (static output) on Cloudflare Pages, served at
  `yourdomain.co.za/store/` — a PATH on the primary domain, not a subdomain
  (Xneelo charges extra for those; see `docs/DEPLOYMENT.md`). A Cloudflare
  Worker (`workers/store-proxy.js`) routes `/store/*` to Cloudflare Pages;
  everything else on the domain still goes straight to WordPress.
- **Backend**: WordPress + WooCommerce (headless, REST API only) on Xneelo,
  on the primary domain, unchanged
- **Video**: Cloudflare R2 + CDN
- **Payments**: WooCommerce Direct Bank Transfer (BACS) — no gateway
  account needed; orders go "on-hold" until the transfer is manually
  confirmed. Easy to swap in a real gateway later (see `docs/DEPLOYMENT.md`).
- **Spam protection**: Cloudflare Turnstile (not Google reCAPTCHA)
- **Server logic**: Cloudflare Pages Functions (`functions/api/*`) — keeps
  all secrets (WooCommerce keys, Turnstile secret) server-side only

## Local development

```
npm install
npm run dev
```

The dev server runs against `src/data/mockProducts.ts` mock data — no
WooCommerce connection needed to work on UI. Copy `.env.example` to `.env`
and fill in real values once the backend is live.

To run the Cloudflare Pages Functions locally too (for testing
checkout/reviews/contact endpoints), use `npx wrangler pages dev dist` after
`npm run build`, with a local `.dev.vars` file for secrets.

## Project layout

```
src/
  components/     VideoFeed, VideoCard, OverlayButtons, ReviewModal, ShareModal, BottomNav
  layouts/        Layout.astro (shell + bottom nav + cart pill)
  pages/          index (feed), shop, shop/[category], product/[slug],
                  contact, account, cart, checkout, checkout/success
  lib/            woocommerce.ts (server), security.ts, api.ts (client), cart.ts, base.ts
  data/           mockProducts.ts (placeholder catalog)
functions/api/    products, reviews, checkout, contact
workers/          store-proxy.js + wrangler.toml (path-based routing, no subdomain)
docs/             SECURITY.md, DEPLOYMENT.md, R2_SETUP.md, PERFORMANCE.md
```

## Phase checklists

See `docs/DEPLOYMENT.md` for the full Xneelo + Cloudflare Pages + path-based
routing rollout, `docs/R2_SETUP.md` for video hosting, `docs/SECURITY.md`
for the anti-spam/hardening stack, and `docs/PERFORMANCE.md` for the
performance checklist.

## Status

Frontend UI and API scaffolding are built against mock data and ready to
wire up to a live WooCommerce/R2 backend. Nothing here has been deployed
yet — see `docs/DEPLOYMENT.md` for next steps.
