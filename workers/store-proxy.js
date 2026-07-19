// Cloudflare Worker bound to the route `yourdomain.co.za/store*`.
//
// Lets the Astro storefront live at a PATH on the primary domain instead
// of a subdomain (Xneelo charges extra for additional hosted domains, and
// WordPress already occupies the primary domain there). Only requests
// under /store are intercepted and proxied to the Cloudflare Pages
// deployment; every other path on the zone (including /wp-json, /wp-admin,
// everything WordPress serves) is untouched and reaches Xneelo exactly as
// it did before this Worker was added.
const PAGES_ORIGIN = 'https://YOUR-PAGES-PROJECT.pages.dev';
const BASE_PATH = '/store';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Astro's `base: '/store'` config only rewrites links/asset URLs at
    // render time — the Pages deployment's actual files are NOT nested
    // under /store, so that prefix must be stripped before proxying.
    let pagesPath = url.pathname.slice(BASE_PATH.length);
    if (!pagesPath.startsWith('/')) pagesPath = `/${pagesPath}`;

    const target = new URL(pagesPath + url.search, PAGES_ORIGIN);
    const proxyRequest = new Request(target, request);
    return fetch(proxyRequest);
  },
};
