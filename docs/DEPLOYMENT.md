# Deployment: Xneelo (WordPress/WooCommerce) + Cloudflare Worker (Astro)

## Why no subdomain

WordPress is already installed on the primary domain, and Xneelo charges
extra for additional hosted domains/subdomains. So instead of the common
`api.yourdomain.co.za` + `yourdomain.co.za` split, this project uses **one
domain, split by path**, at no extra Xneelo cost:

- `yourdomain.co.za/*` (everything except `/store`) → keeps going to
  WordPress/WooCommerce on Xneelo, completely unchanged.
- `yourdomain.co.za/store/*` → the Astro storefront, served directly by this
  project's own Cloudflare Worker (see "How this actually deploys" below) —
  bound to that path via `wrangler.jsonc`'s `routes`. Xneelo is never
  informed of this and never bills for it.
- `videos.yourdomain.co.za` (see `docs/R2_SETUP.md`) is a Cloudflare R2
  custom domain, configured entirely inside Cloudflare's DNS for the zone.
  It also does not touch Xneelo's hosting panel or its addon-domain pricing.

Because everything lives on one domain, WooCommerce REST calls
(`yourdomain.co.za/wp-json/wc/v3`) are same-origin from the storefront's
point of view — no CORS configuration needed.

## How this actually deploys

This Cloudflare project deploys as a genuine **Cloudflare Worker** (its
Deploy command is `npx wrangler deploy`), not classic static Cloudflare
Pages. That's set at the project level and isn't something this repo
controls — so the repo is built to match it:

- `astro.config.mjs` uses the `@astrojs/cloudflare` adapter with
  `output: 'hybrid'` — every page is still prerendered to static HTML by
  default; only `src/pages/api/*.ts` opt into server-side rendering
  (`export const prerender = false`) so they run as real request handlers.
- `wrangler.jsonc` (repo root) is the single source of truth for this
  Worker's bindings, non-secret vars, and routes. **Committing it means it
  overwrites whatever's in the Cloudflare dashboard on every deploy** —
  don't hand-edit bindings in the dashboard expecting them to stick.
- There is no separate "Pages Functions" `functions/` folder and no
  separate proxy Worker — everything (static assets + API routes + the
  `/store/*` route binding) is this one Worker.

## Phase 1 — Backend: WordPress/WooCommerce on Xneelo

- [ ] WordPress is already installed on the primary domain — no change needed.
- [ ] Install and activate WooCommerce if not already active.
- [ ] Confirm Application Passwords support is available (built into WP
      core since 5.6), and install a security plugin (Wordfence or
      similar) — spam protection on the storefront's own forms is handled
      by Cloudflare Turnstile, not a WordPress plugin.
- [ ] Generate WooCommerce REST API keys: WooCommerce → Settings →
      Advanced → REST API → Add key (Read/Write).
- [ ] Confirm the REST API responds: `curl https://yourdomain.co.za/wp-json/wc/v3/products -u ck_xxx:cs_xxx`
- [ ] Harden wp-admin: 2FA, hide/rename login path, disable XML-RPC, disable
      user enumeration (see `docs/SECURITY.md`).
- [ ] Enable **Direct bank transfer (BACS)**: WooCommerce → Settings →
      Payments → turn on "Direct bank transfer" → fill in your account
      name, number, bank name, and branch code (these are read live by
      `src/pages/api/checkout.ts` via the REST API, so updating them in
      wp-admin later needs no redeploy).
- [ ] Create a **"Personalised"** product category (any name containing
      "personalis(ed/ing)" works, or use slug `personalised` exactly) and
      put mugs/personalised items in it — the product page automatically
      shows a design-upload field for any product in that category (see
      `src/lib/mapProduct.ts`).

## Phase 2 — Configure and deploy the Worker

- [ ] Edit `wrangler.jsonc` at the repo root: set `name`, the real domain in
      `routes`, and the non-secret values under `vars` (WordPress/WooCommerce
      URLs, R2 video base URL, R2 uploads base URL, Turnstile **site** key —
      site keys are meant to be public, unlike secret keys).
- [ ] Create the KV namespace if you haven't: `npx wrangler kv namespace create RATE_LIMIT_KV`
      (or via the dashboard), then put its `id` into `wrangler.jsonc`'s
      `kv_namespaces` entry.
- [ ] Create the R2 bucket for customer design uploads (separate from the
      video bucket in `docs/R2_SETUP.md`):
      `npx wrangler r2 bucket create ecommerce-uploads` — then connect a
      public custom domain to it (R2 → bucket → Settings → Public access)
      and put that hostname into `wrangler.jsonc`'s `PUBLIC_UPLOADS_BASE_URL`.
- [ ] Set the real **secrets** — these must NOT go in `wrangler.jsonc` (that
      file is committed to git) or the dashboard's plain env vars (which get
      overwritten by the next deploy). Use `wrangler secret put` instead,
      once, authenticated against the Cloudflare account that owns this
      Worker:
      ```
      npx wrangler secret put WOOCOMMERCE_CONSUMER_KEY
      npx wrangler secret put WOOCOMMERCE_CONSUMER_SECRET
      npx wrangler secret put TURNSTILE_SECRET_KEY
      npx wrangler secret put CONTACT_TO_EMAIL
      npx wrangler secret put CONTACT_FROM_EMAIL
      ```
      (Each prompts for the value interactively — nothing sensitive is typed
      into a file or committed.) Secrets set this way persist across
      deploys regardless of what's in `wrangler.jsonc`.
- [ ] Confirm the domain's DNS is proxied through Cloudflare (orange cloud)
      — `routes` bindings only apply to proxied traffic.
- [ ] Push to the connected branch (or trigger a deploy) and check the build
      log completes without the `_worker.js`/asset errors this project hit
      earlier — `npm run build` includes a postbuild step
      (`scripts/postbuild.mjs`) that fixes `.assetsignore` placement for
      this specific adapter+base-path combination.
- [ ] Visit `https://yourdomain.co.za/store/` — it should show the video
      feed, while `https://yourdomain.co.za/` still shows WordPress.
- [ ] Sanity-check that WordPress paths are untouched: `/wp-admin`,
      `/wp-json/wc/v3/products`, and the normal site all still resolve to
      Xneelo exactly as before.

## Phase 3 — Payment: WooCommerce Direct Bank Transfer

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
      isolates payment logic in `src/pages/api/checkout.ts` — swapping in a
      gateway (PayFast, Stripe, etc.) later only touches that one file.

## Phase 4 — Go-live checklist

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
- [ ] Rotate any credentials that were ever pasted into a chat, screenshot,
      or shared log — including this project's WooCommerce keys and
      Turnstile secret, which were exposed once during setup.
