# Security & Anti-Spam

## Architecture principle

The Astro frontend is prerendered static HTML by default. All writes
(reviews, orders, contact messages) go through server-rendered API routes
in `src/pages/api/*.ts` (part of the same Cloudflare Worker, via the
`@astrojs/cloudflare` adapter), which hold the WooCommerce consumer
key/secret and Turnstile secret as Worker **secrets** (`wrangler secret
put`, never `wrangler.jsonc`) — none of these ever reach the browser.

## Input sanitization

- `src/lib/security.ts` (`sanitizeText`, `stripHtml`) strips HTML tags and
  caps length on every text field before it's forwarded to WooCommerce.
- Review/comment text is rendered client-side with `textContent`, never
  `innerHTML` — see `src/components/VideoFeed.astro` — so even if sanitization
  were ever bypassed, stored XSS can't execute.
- All API handlers validate required fields and reject malformed JSON with
  a 400 before touching WooCommerce.

## Transport & backend hardening (Xneelo WordPress)

- Force HTTPS via Cloudflare "Always Use HTTPS" + HSTS.
- Set `WP_DEBUG` to `false` in production; disable directory listing.
- Restrict the REST API to only the endpoints the frontend needs
  (`wp-json/wp/v2`, `wp-json/wc/v3`) — disable user enumeration
  (`/wp-json/wp/v2/users`) via a plugin like **Disable REST API** or custom
  `rest_endpoints` filter.
- Disable `xmlrpc.php` (common brute-force/DDoS vector).
- Enforce 2FA on all wp-admin accounts (e.g. WP 2FA, Wordfence 2FA).
- Rename/hide the default `/wp-login.php` path or protect it with HTTP
  Basic Auth at the server level, in addition to 2FA.
- Keep WordPress core, WooCommerce, and all plugins on auto-update for
  security patches; review changelogs before major-version bumps.
- Use unique, rotated application passwords for the WooCommerce REST API
  keys (Consumer Key/Secret) scoped to Read/Write only where needed.

## CSRF / XSS / SQL injection

- CSRF: WooCommerce REST calls are authenticated with Consumer
  Key/Secret (not cookies), so classic CSRF against the API doesn't apply;
  the WP admin retains its native nonce protection.
- XSS: user-supplied text is sanitized on write (Workers) and escaped on
  read (`textContent`, Astro's default HTML-escaping in `{}` expressions).
- SQL injection: all data access goes through the WooCommerce/WordPress
  REST API and its ORM (`$wpdb`/WC_Data_Store) — the frontend and Workers
  never construct raw SQL.

## API keys & secrets

- Local dev: copy `.env.example` to `.env` (git-ignored); `wrangler dev`
  also reads a `.dev.vars` file for binding-shaped local secrets.
- Production: non-secret values live in the committed `wrangler.jsonc`
  under `vars`. Actual secrets (`WOOCOMMERCE_CONSUMER_KEY/SECRET`,
  `TURNSTILE_SECRET_KEY`, `CONTACT_TO_EMAIL`/`CONTACT_FROM_EMAIL`) are set
  with `wrangler secret put <NAME>` — never put them in `wrangler.jsonc`
  (it's committed to git) or as plain dashboard env vars (those get
  silently overwritten by `wrangler.jsonc`'s `vars` on every deploy).
- Rotate the WooCommerce Consumer Key/Secret and Turnstile secret
  immediately if they are ever exposed in a log, screenshot, or commit.

## Reviews: verified email + moderation

- Before a review can be submitted, the reviewer must prove they own the
  email address they entered: `POST /api/verify-email/request` emails a
  6-digit one-time code (`src/lib/emailVerification.ts`), and
  `POST /api/verify-email/confirm` checks it and marks that address
  "verified" in the `RATE_LIMIT_KV` namespace for 90 days. This is a
  lightweight gate, not a full customer-account system — there's no
  password, and verification is per-email rather than per-person.
- `src/pages/api/reviews.ts` independently re-checks `isEmailVerified()`
  server-side before accepting a review, so the client-side UI gating in
  `ReviewModal.astro`/`VideoFeed.astro` can't be bypassed by calling the API
  directly.
- First-time reviewers' submissions are still marked `hold` so they sit in
  the WooCommerce moderation queue before appearing.
- The same verified-email gate protects `/api/orders` (used by the account
  page's Orders tab) — a visitor can only look up orders for an email they
  just proved they control, not an arbitrary stranger's address.
- Verified-purchase badges shown on existing reviews are driven by
  WooCommerce's own order history — cross-reference the reviewer's email
  against completed orders for that product (WooCommerce Product Reviews
  Pro or a small custom REST filter can automate this; document the exact
  plugin choice once picked).

## Spam protection stack

| Layer | Where | Detail |
|---|---|---|
| Cloudflare Turnstile | `src/lib/security.ts` (`verifyTurnstile`) | Widget rendered in `ReviewModal.astro` + `contact.astro` (`data-appearance="interaction-only"`); verified server-side against `challenges.cloudflare.com/turnstile/v0/siteverify`. Chosen over Google reCAPTCHA — see "Why Turnstile, not reCAPTCHA" below. |
| Honeypot | `ReviewModal.astro`, `contact.astro` | Hidden `website`/`company` field; any value = bot |
| Rate limiting | `checkRateLimit` (Cloudflare KV) | 5 reviews / 10 min / IP, 10 checkouts / 10 min / IP, 5 contact messages / 10 min / IP |
| Link/script blocking | `containsLinkOrScript` | Rejects review/contact text containing URLs or `<script`/`javascript:` |
| Moderation queue | WooCommerce reviews `status: hold` | First-time reviewers always held for manual approval |
| Firewall | Cloudflare WAF | Add rate-limiting rules and known-spam-IP blocklists in the Cloudflare dashboard (see below) |
| Alerting | Cloudflare + email | Configure a Cloudflare Notification for WAF rule triggers; wire a Worker alert to `CONTACT_TO_EMAIL` for repeated 429s if desired |

### Why Turnstile, not reCAPTCHA

Google has deprecated legacy reCAPTCHA v2/v3 in favor of reCAPTCHA
Enterprise: management moved to Google Cloud Console, and Google's legal
role shifted from Data Controller to Data Processor — which would require
a signed Data Processing Agreement and privacy policy updates. Since this
stack already runs entirely on Cloudflare (Pages, Workers, R2), Cloudflare
Turnstile avoids all of that: it's free, privacy-preserving by design, and
needs no separate Google Cloud project or billing account. Get a site
key/secret key pair at Cloudflare dashboard → **Turnstile** → **Add site**.

### Cloudflare KV binding required

`src/pages/api/reviews.ts`, `checkout.ts`, and `contact.ts` all expect a KV
namespace bound as `RATE_LIMIT_KV`. Create it once:

```
npx wrangler kv namespace create RATE_LIMIT_KV
```

Then put the resulting namespace `id` into `wrangler.jsonc`'s
`kv_namespaces` entry (already scaffolded there) — the binding is defined
by that committed file, not the dashboard.

### Cloudflare WAF rules (configure in dashboard, not code)

1. Rate limit `/api/*` to e.g. 60 requests/min/IP as a second line of
   defense behind the KV-based limiter above.
2. Block requests where `User-Agent` is empty or matches known bot
   signatures for `/api/reviews` and `/api/contact`.
3. Enable "Bot Fight Mode" (free tier) or Super Bot Fight Mode (paid) under
   Security → Bots.
4. Add an IP Access Rule to block any IP ranges flagged by Cloudflare's
   threat intelligence or by manual review of abuse logs.
