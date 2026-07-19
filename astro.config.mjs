import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// This project deploys as a genuine Cloudflare Worker (via `wrangler deploy`,
// configured in wrangler.jsonc), not classic static Cloudflare Pages — see
// docs/DEPLOYMENT.md for why. The site is served at ecommercegoods.co.za/store/
// (a path, not a subdomain — Xneelo charges extra for those, and WordPress
// already occupies the primary domain). wrangler.jsonc's `routes` binds this
// same Worker directly to /store/* on the zone; WordPress/WooCommerce keeps
// answering everything else, unchanged.
//
// `output: 'hybrid'` prerenders every page to static HTML by default; only
// src/pages/api/*.ts opt into server-side rendering (`export const
// prerender = false`) so they run as real request handlers with access to
// bindings (KV, env vars) via `context.locals.runtime`.
//
// `base: '/store'` (not '/shop') deliberately avoids colliding with the
// in-app "Shop" category page at /store/shop. It makes every internal
// link, asset path, and getStaticPaths route resolve under /store/...
// automatically.
export default defineConfig({
  site: 'https://ecommercegoods.co.za',
  base: '/store',
  output: 'hybrid',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  build: {
    inlineStylesheets: 'auto',
  },
});
