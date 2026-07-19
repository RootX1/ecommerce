import { defineConfig } from 'astro/config';

// Deployed to Cloudflare Pages, but served at a PATH on the primary domain
// (e.g. https://yourdomain.co.za/store/) rather than a subdomain — see
// docs/DEPLOYMENT.md for why. A Cloudflare Worker Route proxies /store/*
// on the primary domain to this Pages project; WordPress/WooCommerce keeps
// answering everything else on that same domain, unchanged.
//
// `base: '/store'` (not '/shop') deliberately avoids colliding with the
// in-app "Shop" category page at /store/shop. It makes every internal
// link, asset path, and getStaticPaths route resolve under /store/...
// automatically.
export default defineConfig({
  site: 'https://yourdomain.co.za',
  base: '/store',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
