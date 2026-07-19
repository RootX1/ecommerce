// The storefront is served at a path on the primary domain (e.g.
// https://yourdomain.co.za/shop/) rather than a subdomain, so every
// internal link/fetch must be prefixed with the configured base path.
// See astro.config.mjs `base` and docs/DEPLOYMENT.md.
export const BASE = (import.meta.env.BASE_URL ?? '/store').replace(/\/$/, '');

export function withBase(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${normalized}`;
}
