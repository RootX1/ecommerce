// POST /api/orders { email }
// Returns past orders placed under the given billing email — only once
// that email has been verified via /api/verify-email (one-time code), so
// this can't be used to look up a stranger's order history.
import type { APIRoute } from 'astro';
import { getOrdersByEmail } from '../../lib/woocommerce';
import { isEmailVerified } from '../../lib/emailVerification';
import { sanitizeText, checkRateLimit, clientIp } from '../../lib/security';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `orders-lookup:${ip}`, 20, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  let payload: { email?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const email = sanitizeText(payload.email ?? '', 120);
  if (!email) {
    return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
  }

  const verified = await isEmailVerified(env.RATE_LIMIT_KV, email);
  if (!verified) {
    return new Response(JSON.stringify({ error: 'Please verify this email address first.' }), { status: 403 });
  }

  const orders = await getOrdersByEmail(env, email);
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
