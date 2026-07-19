// GET /api/shipping
// Returns the current delivery cost (read from WooCommerce Shipping
// Zones) so the checkout page can show it before the order is placed.
import type { APIRoute } from 'astro';
import { getDefaultShippingCost } from '../../lib/woocommerce';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const shipping = await getDefaultShippingCost(locals.runtime.env);
  return new Response(JSON.stringify({ cost: shipping.cost, methodTitle: shipping.methodTitle }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
};
