// GET /api/reviews?product=123 -> approved reviews for a product
// Reviews are written on the actual WooCommerce product page (native
// WordPress login + review form), not through this app — this endpoint
// only reads them back for display in the video feed's review sheet.
import type { APIRoute } from 'astro';
import { listProductReviews } from '../../lib/woocommerce';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const productId = url.searchParams.get('product');
  if (!productId) {
    return new Response(JSON.stringify({ error: 'Missing product id' }), { status: 400 });
  }
  const reviews = await listProductReviews(env, productId);
  return new Response(JSON.stringify(reviews), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  });
};
