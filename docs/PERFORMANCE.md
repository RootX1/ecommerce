# Performance Checklist

- [x] Videos lazy-load: `<video>` starts with no `src`, only `data-src` +
      poster image; the real source is set by an `IntersectionObserver`
      when a card is ~60% visible (`src/components/VideoFeed.astro`).
- [x] Only the active video plays; every other video is paused and unloaded
      to avoid multiple simultaneous decodes on mobile.
- [x] The next card's video is preloaded once the current one crosses 60%
      visibility, so scrolling forward feels instant without preloading the
      entire feed up front.
- [x] Reviews are fetched/rendered only when the review sheet is opened,
      not on initial page load.
- [ ] Compress every source video to <20 MB / 15–30s and run
      `-movflags +faststart` before upload (see `docs/R2_SETUP.md`).
- [ ] Set R2 custom domain caching / Cloudflare Cache Rules so video and
      poster assets are cached at the edge (`Cache-Control: public,
      max-age=31536000, immutable` for versioned filenames).
- [ ] `src/pages/api/products.ts` already sets `Cache-Control: public,
      max-age=60, s-maxage=300` — tune per how often inventory changes.
- [ ] Enable Cloudflare Auto Minify (JS/CSS/HTML) and Brotli compression on
      the zone.
- [ ] On the WooCommerce/Xneelo side: enable an object cache (Redis/Memcached
      if available) and a page cache for any server-rendered admin-facing
      pages; add indexes on any custom meta queries used for verified-purchase
      lookups.
- [ ] Run Lighthouse on the deployed Pages URL before go-live; target LCP <
      2.5s, CLS < 0.1, INP < 200ms on mobile.
- [ ] Confirm `astro build` output stays static (no server rendering
      needed) so the whole storefront is served from Cloudflare's edge.
