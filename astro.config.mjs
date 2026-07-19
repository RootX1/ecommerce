import { defineConfig } from 'astro/config';

// Deployed to Cloudflare Pages. Frontend is fully static/edge-rendered;
// all dynamic data (products, cart, reviews) comes from the headless
// WooCommerce REST API at runtime via fetch() from the browser.
export default defineConfig({
  site: 'https://shop.example.co.za',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
