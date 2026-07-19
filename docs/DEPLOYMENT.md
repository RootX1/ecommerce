# Deployment: Xneelo (WordPress/WooCommerce) + Cloudflare Pages (Astro)

## Phase 1 — Backend: WordPress/WooCommerce on Xneelo

- [ ] Provision hosting on Xneelo, point a subdomain (e.g. `api.yourdomain.co.za`)
      at it for the headless backend.
- [ ] Install WordPress via Xneelo's control panel or manually.
- [ ] Install and activate WooCommerce.
- [ ] Install and activate a reCAPTCHA/anti-spam plugin, JWT/Application
      Passwords support (built into WP core since 5.6), and a security
      plugin (Wordfence or similar).
- [ ] Enable Application Passwords or generate WooCommerce REST API keys:
      WooCommerce → Settings → Advanced → REST API → Add key (Read/Write).
- [ ] Confirm the REST API responds: `curl https://api.yourdomain.co.za/wp-json/wc/v3/products -u ck_xxx:cs_xxx`
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
      Production and Preview, matching `.env.example`. Mark secrets
      (`WOOCOMMERCE_CONSUMER_SECRET`, `PAYFAST_PASSPHRASE`,
      `RECAPTCHA_SECRET_KEY`) as **Encrypted**.
- [ ] Bind the `RATE_LIMIT_KV` KV namespace (Settings → Functions → KV
      namespace bindings) — see `docs/SECURITY.md`.
- [ ] Trigger a deploy; verify the preview URL loads the video feed.

## Phase 3 — Domain & DNS (Xneelo domain, Cloudflare DNS)

- [ ] If the domain is registered at Xneelo, update its nameservers to
      Cloudflare's (given when you add the site to Cloudflare).
- [ ] In Cloudflare DNS:
      - `yourdomain.co.za` / `www` → CNAME to the Cloudflare Pages
        `*.pages.dev` deployment (Pages → Custom domains → Add, Cloudflare
        creates this automatically).
      - `api.yourdomain.co.za` → A/CNAME record pointing at the Xneelo
        server IP/hostname, proxied (orange cloud) through Cloudflare for
        SSL + WAF + caching.
      - `videos.yourdomain.co.za` → CNAME to the R2 custom domain (see
        `docs/R2_SETUP.md`).
- [ ] Set SSL/TLS mode to **Full (strict)** once Xneelo has a valid
      certificate (Xneelo issues these automatically for hosted domains, or
      use Cloudflare Origin CA).

## Phase 4 — PayFast configuration

- [ ] Create a PayFast merchant account (sandbox first, then live) at
      https://www.payfast.co.za.
- [ ] Set the sandbox/live Merchant ID + Merchant Key + Passphrase as
      Cloudflare Pages secrets.
- [ ] In the PayFast dashboard, set the notify URL to
      `https://yourdomain.co.za/api/payfast-webhook` — this must be
      reachable publicly (Cloudflare Pages Functions are, by default).
- [ ] Test a full sandbox payment end-to-end: add to cart → checkout →
      PayFast sandbox → redirected to `/checkout/success` → order status in
      WooCommerce flips to "Processing".

## Phase 5 — Go-live checklist

- [ ] Switch `PAYFAST_MODE` from `sandbox` to `live`.
- [ ] Confirm Cloudflare SSL is "Full (strict)" and HSTS is on.
- [ ] Run a Lighthouse/PageSpeed pass on the deployed Pages URL — target
      Core Web Vitals "Good" on mobile.
- [ ] Cross-device test: iOS Safari, Android Chrome, desktop Chrome/Firefox.
- [ ] Confirm reCAPTCHA, honeypot, and rate limiting are all active in
      production (submit a test review/contact message and check
      WooCommerce's moderation queue).
