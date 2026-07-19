# Cloudflare R2: Video Storage & Embed Workflow

## 1. Create the bucket

```
wrangler r2 bucket create product-videos
```

Or via the dashboard: R2 → Create bucket → name it `product-videos`.

## 2. Public access + custom domain

- R2 → `product-videos` → Settings → Public access → connect a custom
  domain, e.g. `videos.yourdomain.co.za` (this issues the CDN-backed public
  URL and handles the DNS/SSL automatically once the CNAME propagates).
- Alternatively, keep the bucket private and serve videos through a Worker
  that checks a signed URL/token if you need access control per customer —
  not required for a public product catalog.

## 3. CORS configuration

Videos are played inline in `<video>` tags from `yourdomain.co.za`, so R2
needs a CORS policy allowing that origin:

```json
[
  {
    "AllowedOrigins": ["https://yourdomain.co.za", "https://*.pages.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

Apply it with:

```
wrangler r2 bucket cors put product-videos --rules cors.json
```

`Range`/`Content-Range` are required so mobile Safari can seek/scrub within
videos instead of re-downloading the whole file.

## 4. Video compression before upload

Keep every clip **15–30 seconds and under 20 MB** so the feed stays fast on
mobile data:

```
ffmpeg -i input.mov -c:v libx264 -crf 28 -preset veryfast \
  -vf "scale=720:-2" -c:a aac -b:a 96k -movflags +faststart \
  output.mp4
```

- `-movflags +faststart` moves the MP4 moov atom to the front so playback
  can start before the whole file downloads — critical for a scroll feed.
- Generate a poster JPG for each video (first frame or a chosen thumbnail)
  so `<video poster>` shows instantly before the video loads:
  `ffmpeg -i output.mp4 -ss 00:00:00.5 -vframes 1 poster.jpg`

## 5. Upload workflow

- **Manual/admin**: upload via the Cloudflare dashboard (R2 → bucket →
  Upload) or `wrangler r2 object put product-videos/sample-1.mp4 --file=./output.mp4`.
- **From WordPress admin**: add a custom field or small plugin on the
  WooCommerce product edit screen that uploads the file straight to R2
  using the S3-compatible API (R2 exposes an S3 API — use the AWS SDK with
  R2's endpoint and an R2 API token), storing only the resulting public URL
  on the product's `_video_url` meta. This keeps large video binaries out
  of the Xneelo MySQL/media library entirely.

## 6. Embed workflow (frontend)

Product records reference videos by URL only:

```
https://videos.yourdomain.co.za/<product-slug>.mp4
https://videos.yourdomain.co.za/<product-slug>-poster.jpg
```

`src/data/mockProducts.ts` and (once connected) the WooCommerce product
`meta_data` fields for `videoUrl`/`posterUrl` follow this same convention —
see `Product` interface fields `videoUrl`/`posterUrl`. `VideoCard.astro`
lazy-loads via `data-src` and only sets the real `src` when the card enters
the viewport (see `src/components/VideoFeed.astro`), so no video downloads
until the user actually scrolls to it.

## 7. Test checklist

- [ ] Bucket created, custom domain attached, HTTPS resolves.
- [ ] CORS policy applied; confirm with `curl -I -H "Origin: https://yourdomain.co.za" https://videos.yourdomain.co.za/sample-1.mp4`
      and check for `Access-Control-Allow-Origin` in the response.
- [ ] Sample video uploaded and plays in the feed at `/`.
- [ ] Scrubbing/seeking works on iOS Safari (validates Range support).
