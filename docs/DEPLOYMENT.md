# Deployment: Xneelo (WordPress/WooCommerce) + Cloudflare Pages (Astro)

## Why no subdomain

WordPress is already installed on the primary domain, and Xneelo charges
extra for additional hosted domains/subdomains. So instead of the common
`api.yourdomain.co.za` + `yourdomain.co.za` split, this project uses **one
domain, split by path**, at no extra Xneelo cost:

- `yourdomain.co.za/*` (everything except `/store`) → keeps going to
  WordPress/WooCommerce on Xneelo, completely unchanged.
- `yourdomain.co.za/store/*` → the Astro storefront, via a free Cloudflare
  Worker Route that proxies those requests to the Cloudflare Pages
  deployment. This is a Cloudflare-side routing rule — Xneelo is never
  informed of it and never bills for it.
- `videos.yourdomain.co.za` (see `docs/R2_SETUP.md`) is a Cloudflare R2
  custom domain, configured entirely inside Cloudflare's DNS for the zone.
  It also does not touch Xneelo's hosting panel or its addon-domain pricing.

Because everything lives on one domain, WooCommerce REST calls
(`yourdomain.co.za/wp-json/wc/v3`) are same-origin from the storefront's
point of view — no CORS configuration needed.

## Phase 1 — Backend: WordPress/WooCommerce on Xneelo

- [ ] WordPress is already installed on the primary domain — no change needed.
- [ ] Install and activate WooCommerce if not already active.
- [ ] Install and activate a reCAPTCHA/anti-spam plugin, JWT/Application
      Passwords support (built into WP core since 5.6), and a security
      plugin (Wordfence or similar).
- [ ] Enable Application Passwords or generate WooCommerce REST API keys:
      WooCommerce → Settings → Advanced → REST API → Add key (Read/Write).
- [ ] Confirm the REST API responds: `curl https://yourdomain.co.za/wp-json/wc/v3/products -u ck_xxx:cs_xxx`
- [ ] Harden wp-admin: 2FA, hide/rename login path, disable XML-RPC, disable
      user enumeration (see `docs/SECURITY.md`).
- [ ] Install the PayFast WooCommerce plugin OR rely on the custom
      `functions/api/checkout.ts` + `functions/api/payfast-webhook.ts` flow
      in this repo (recommended, since it keeps the passphrase in Cloudflare
      secrets instead of the WP database).

## Phase 2 — Frontend: Astro on Cloudflare Pages

- [ ] Push this repo to GitHub (already done if you're reading this from
      the repo).
- [ ] In the Cloudflare dashboard: Workers & Pages → Create → Pages →
      Connect to Git → select this repo.
- [ ] Build settings:
      - Framework preset: **Astro**
      - Build command: `npm run build`
      - Build output directory: `dist`
- [ ] Add environment variables (Settings → Environment variables) for both
      Production and Preview, matching `.env.example` — note `PUBLIC_SITE_URL`
      must be `https://yourdomain.co.za/store` (includes the path).
      Mark secrets (`WOOCOMMERCE_CONSUMER_SECRET`, `PAYFAST_PASSPHRASE`,
      `RECAPTCHA_SECRET_KEY`) as **Encrypted**.
- [ ] Bind the `RATE_LIMIT_KV` KV namespace (Settings → Functions → KV
      namespace bindings) — see `docs/SECURITY.md`.
- [ ] Trigger a deploy; note the `*.pages.dev` URL Cloudflare assigns — you'll
      need it for Phase 3. Verify the video feed loads there directly first.

## Phase 3 — Path-based routing (no subdomain)

This replaces the usual "Custom domain" step in Cloudflare Pages, since the
storefront isn't getting its own hostname.

- [ ] Edit `workers/store-proxy.js`: replace `YOUR-PAGES-PROJECT.pages.dev`
      with the actual `*.pages.dev` URL from Phase 2.
- [ ] Edit `workers/wrangler.toml`: replace `yourdomain.co.za` (both the
      route pattern and `zone_name`) with your real domain.
- [ ] Deploy the Worker: `cd workers && npx wrangler deploy`
      (requires `wrangler login` once, authorized against the Cloudflare
      account that manages this zone's DNS).
- [ ] Confirm the domain's DNS is already proxied through Cloudflare (orange
      cloud) for the record(s) that currently point at Xneelo — Worker
      Routes only apply to proxied traffic.
- [ ] Visit `https://yourdomain.co.za/store/` — it should now show the video
      feed, while `https://yourdomain.co.za/` still shows WordPress.
- [ ] Sanity-check that WordPress paths are untouched: `/wp-admin`,
      `/wp-json/wc/v3/products`, and the normal site all still resolve to
      Xneelo exactly as before.

## Phase 4 — PayFast configuration

- [ ] Create a PayFast merchant account (sandbox first, then live) at
      https://www.payfast.co.za.
- [ ] Set the sandbox/live Merchant ID + Merchant Key + Passphrase as
      Cloudflare Pages secrets.
- [ ] In the PayFast dashboard, set the notify URL to
      `https://yourdomain.co.za/store/api/payfast-webhook` — this must be
      reachable publicly (it is, via the Worker Route from Phase 3).
- [ ] Test a full sandbox payment end-to-end: add to cart → checkout →
      PayFast sandbox → redirected to `/store/checkout/success` → order
      status in WooCommerce flips to "Processing".

## Phase 5 — Go-live checklist

- [ ] Switch `PAYFAST_MODE` from `sandbox` to `live`.
- [ ] Confirm Cloudflare SSL is "Full (strict)" and HSTS is on.
- [ ] Run a Lighthouse/PageSpeed pass on `yourdomain.co.za/store/` — target
      Core Web Vitals "Good" on mobile.
- [ ] Cross-device test: iOS Safari, Android Chrome, desktop Chrome/Firefox.
- [ ] Confirm reCAPTCHA, honeypot, and rate limiting are all active in
      production (submit a test review/contact message and check
      WooCommerce's moderation queue).
- [ ] Link to the storefront from the existing WordPress site's main
      navigation/homepage (e.g. a "Shop" menu item pointing at `/store/`) so
      customers can actually find it.
