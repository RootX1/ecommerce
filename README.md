# TikTok-Style E-Commerce (Astro + Headless WooCommerce)

Video-first storefront: vertical product video feed with wishlist, reviews
(bottom-sheet modal), share, and PayFast checkout. Built for Nawaaz's
Cape Town-based photographic/printing retail business.

## Stack

- **Frontend**: Astro (static output) on Cloudflare Pages
- **Backend**: WordPress + WooCommerce (headless, REST API only) on Xneelo
- **Video**: Cloudflare R2 + CDN
- **Payments**: PayFast (South Africa)
- **Server logic**: Cloudflare Pages Functions (`functions/api/*`) — keeps
  all secrets (WooCommerce keys, PayFast passphrase, reCAPTCHA secret)
  server-side only

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
                  contact, account, cart, checkout, checkout/success|cancelled
  lib/            woocommerce.ts (server), payfast.ts, security.ts, api.ts (client), cart.ts
  data/           mockProducts.ts (placeholder catalog)
functions/api/    products, reviews, checkout, payfast-webhook, contact
docs/             SECURITY.md, DEPLOYMENT.md, R2_SETUP.md, PERFORMANCE.md
```

## Phase checklists

See `docs/DEPLOYMENT.md` for the full Xneelo + Cloudflare Pages + DNS +
PayFast rollout, `docs/R2_SETUP.md` for video hosting, `docs/SECURITY.md`
for the anti-spam/hardening stack, and `docs/PERFORMANCE.md` for the
performance checklist.

## Status

Frontend UI and API scaffolding are built against mock data and ready to
wire up to a live WooCommerce/R2/PayFast backend. Nothing here has been
deployed yet — see `docs/DEPLOYMENT.md` for next steps.
