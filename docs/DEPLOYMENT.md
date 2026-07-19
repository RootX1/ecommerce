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
- [ ] Confirm Application Passwords support is available (built into WP
      core since 5.6), and install a security plugin (Wordfence or
      similar) — spam protection on the storefront's own forms is handled
      by Cloudflare Turnstile, not a WordPress plugin.
- [ ] Enable Application Passwords or generate WooCommerce REST API keys:
      WooCommerce → Settings → Advanced → REST API → Add key (Read/Write).
- [ ] Confirm the REST API responds: `curl https://yourdomain.co.za/wp-json/wc/v3/products -u ck_xxx:cs_xxx`
- [ ] Harden wp-admin: 2FA, hide/rename login path, disable XML-RPC, disable
      user enumeration (see `docs/SECURITY.md`).
- [ ] Enable **Direct bank transfer (BACS)**: WooCommerce → Settings →
      Payments → turn on "Direct bank transfer" → fill in your account
      name, number, bank name, and branch code (these are read live by
      `functions/api/checkout.ts` via the REST API, so updating them in
      wp-admin later needs no redeploy).

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
      Production and Preview, matching `.env.example`. Mark secrets
      (`WOOCOMMERCE_CONSUMER_SECRET`, `TURNSTILE_SECRET_KEY`) as **Encrypted**.
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

## Phase 4 — Payment: WooCommerce Direct Bank Transfer

No gateway account/credentials needed — orders are placed as "on-hold"
and you confirm payment manually once you see the transfer land.

- [ ] Confirm WooCommerce → Settings → Payments → "Direct bank transfer" is
      enabled with your real account details filled in (done in Phase 1).
- [ ] Place a real test order end-to-end: add to cart → checkout → confirm
      the success screen shows your bank details and an order reference →
      check the order appears in WooCommerce → Orders as "On hold".
- [ ] Once you can see the transfer in your bank account, mark the
      matching WooCommerce order "Processing"/"Completed" manually.
- [ ] If you outgrow manual reconciliation later, the codebase already
      isolates payment logic in `functions/api/checkout.ts` — swapping in a
      gateway (PayFast, Stripe, etc.) later only touches that one file.

## Phase 5 — Go-live checklist

- [ ] Confirm Cloudflare SSL is "Full (strict)" and HSTS is on.
- [ ] Run a Lighthouse/PageSpeed pass on `yourdomain.co.za/store/` — target
      Core Web Vitals "Good" on mobile.
- [ ] Cross-device test: iOS Safari, Android Chrome, desktop Chrome/Firefox.
- [ ] Confirm Turnstile, honeypot, and rate limiting are all active in
      production (submit a test review/contact message and check
      WooCommerce's moderation queue).
- [ ] Link to the storefront from the existing WordPress site's main
      navigation/homepage (e.g. a "Shop" menu item pointing at `/store/`) so
      customers can actually find it.
