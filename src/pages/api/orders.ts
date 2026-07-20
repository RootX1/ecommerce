// GET /api/orders
// Returns past orders for the currently signed-in account. Identity comes
// only from the session cookie (see src/lib/session.ts) — there is no way
// to request another customer's orders by supplying their email.
import type { APIRoute } from 'astro';
import { getOrdersByEmail } from '../../lib/woocommerce';
import { getSession, parseCookie, SESSION_COOKIE_NAME } from '../../lib/session';
import { checkRateLimit, clientIp } from '../../lib/security';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `orders-lookup:${ip}`, 30, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  const token = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE_NAME);
  const session = await getSession(env.RATE_LIMIT_KV, token);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Please sign in to view your orders.' }), { status: 401 });
  }

  const orders = await getOrdersByEmail(env, session.email);
  return new Response(
    JSON.stringify(
      orders.map((o) => ({
        id: o.id,
        status: o.status,
        date_created: o.date_created,
        total: o.total,
        line_items: o.line_items.map((li) => ({ name: li.name, quantity: li.quantity })),
      }))
    ),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
