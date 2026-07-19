/// <reference path="../.astro/types.d.ts" />
/// <reference types="@astrojs/cloudflare" />

// Mirrors wrangler.jsonc's vars/kv_namespaces/secrets. Declared by hand
// instead of relying on a generated worker-configuration.d.ts, so
// typechecking works without needing `wrangler types` / Cloudflare login.
interface Env {
  PUBLIC_WORDPRESS_API_URL: string;
  PUBLIC_WOOCOMMERCE_API_URL: string;
  WOOCOMMERCE_CONSUMER_KEY: string;
  WOOCOMMERCE_CONSUMER_SECRET: string;
  PUBLIC_R2_VIDEO_BASE_URL: string;
  PUBLIC_UPLOADS_BASE_URL: string;
  PUBLIC_TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CONTACT_TO_EMAIL: string;
  CONTACT_FROM_EMAIL: string;
  RATE_LIMIT_KV: KVNamespace;
  UPLOADS_BUCKET: R2Bucket;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}