# Security & Anti-Spam

## Architecture principle

The Astro frontend is fully static and never talks to WooCommerce directly.
All writes (reviews, orders, contact messages) go through Cloudflare Pages
Functions in `functions/api/*`, which hold the WooCommerce consumer
key/secret, PayFast passphrase, and reCAPTCHA secret as **encrypted
environment variables** — none of these ever reach the browser.

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

- Local dev: copy `.env.example` to `.env` (git-ignored).
- Production: set the same variable names as **encrypted secrets** in the
  Cloudflare Pages project settings (Settings → Environment variables →
  "Encrypt"). Never commit real keys.
- Rotate the WooCommerce Consumer Key/Secret and PayFast passphrase
  immediately if they are ever exposed in a log, screenshot, or commit.

## Reviews: verified purchase + moderation

- `functions/api/reviews.ts` marks first-time reviewers' submissions as
  `hold` so they sit in the WooCommerce moderation queue before appearing.
- Verified-purchase badges are driven by WooCommerce's own order history —
  cross-reference the reviewer's email against completed orders for that
  product (WooCommerce Product Reviews Pro or a small custom REST filter
  can automate this; document the exact plugin choice once picked).

## Spam protection stack

| Layer | Where | Detail |
|---|---|---|
| reCAPTCHA v3 | `src/lib/security.ts` (`verifyRecaptcha`) | Score threshold 0.5; loaded via `api.js?render=<sitekey>` in `Layout.astro` |
| Honeypot | `ReviewModal.astro`, `contact.astro` | Hidden `website`/`company` field; any value = bot |
| Rate limiting | `checkRateLimit` (Cloudflare KV) | 5 reviews / 10 min / IP, 10 checkouts / 10 min / IP, 5 contact messages / 10 min / IP |
| Link/script blocking | `containsLinkOrScript` | Rejects review/contact text containing URLs or `<script`/`javascript:` |
| Moderation queue | WooCommerce reviews `status: hold` | First-time reviewers always held for manual approval |
| Firewall | Cloudflare WAF | Add rate-limiting rules and known-spam-IP blocklists in the Cloudflare dashboard (see below) |
| Alerting | Cloudflare + email | Configure a Cloudflare Notification for WAF rule triggers; wire a Worker alert to `CONTACT_TO_EMAIL` for repeated 429s if desired |

### Cloudflare KV binding required

`functions/api/reviews.ts`, `checkout.ts`, and `contact.ts` all expect a KV
namespace bound as `RATE_LIMIT_KV`. Create it once and bind it in the
Cloudflare Pages project:

```
wrangler kv:namespace create RATE_LIMIT_KV
```

Then bind the resulting namespace ID under Pages → Settings → Functions →
KV namespace bindings.

### Cloudflare WAF rules (configure in dashboard, not code)

1. Rate limit `/api/*` to e.g. 60 requests/min/IP as a second line of
   defense behind the KV-based limiter above.
2. Block requests where `User-Agent` is empty or matches known bot
   signatures for `/api/reviews` and `/api/contact`.
3. Enable "Bot Fight Mode" (free tier) or Super Bot Fight Mode (paid) under
   Security → Bots.
4. Add an IP Access Rule to block any IP ranges flagged by Cloudflare's
   threat intelligence or by manual review of abuse logs.
