// GET /api/products?category=&search=
// Thin, cached proxy to WooCommerce so the consumer key/secret stays server-side.
import type { APIRoute } from 'astro';
import { listProducts } from '../../lib/woocommerce';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const page = url.searchParams.get('page');
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  params.set('page', page ?? '1');
  params.set('per_page', '20');
  params.set('status', 'publish');

  try {
    const products = await listProducts(env, params);
    return new Response(JSON.stringify(products), {
      headers: {
        'Content-Type': 'application/json',
        // Edge-cache product listings briefly; WooCommerce is the source of truth.
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Unable to load products' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
