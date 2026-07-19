// POST /api/checkout
// Creates a WooCommerce order using "Direct bank transfer" (BACS) — no
// payment gateway credentials needed. The order is left unpaid
// ("on-hold" is WooCommerce's default status for BACS) until the store
// owner manually confirms the transfer and marks it as paid/processing
// in wp-admin.
import type { APIRoute } from 'astro';
import { createOrder, getBacsGateway } from '../../lib/woocommerce';
import { sanitizeText, checkRateLimit, clientIp } from '../../lib/security';

export const prerender = false;

interface CheckoutPayload {
  items: { productId: number; quantity: number; unitPrice: number; name: string }[];
  billing: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address1: string;
    city: string;
    postcode: string;
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);
  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `checkout:${ip}`, 10, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), {
      status: 429,
    });
  }

  let payload: CheckoutPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  if (!payload.items?.length) {
    return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400 });
  }

  const billing = {
    first_name: sanitizeText(payload.billing.firstName, 60),
    last_name: sanitizeText(payload.billing.lastName, 60),
    email: sanitizeText(payload.billing.email, 120),
    phone: sanitizeText(payload.billing.phone, 30),
    address_1: sanitizeText(payload.billing.address1, 200),
    city: sanitizeText(payload.billing.city, 100),
    postcode: sanitizeText(payload.billing.postcode, 20),
    country: 'ZA',
  };

  if (!billing.email || !billing.first_name || !billing.address_1) {
    return new Response(JSON.stringify({ error: 'Missing required billing fields' }), { status: 400 });
  }

  const [order, bacs] = await Promise.all([
    createOrder(env, {
      payment_method: 'bacs',
      payment_method_title: 'Direct Bank Transfer',
      set_paid: false,
      billing,
      line_items: payload.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
    }),
    getBacsGateway(env).catch(() => null),
  ]);

  const total = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const orderId = (order as { id: number }).id;

  return new Response(
    JSON.stringify({
      orderId,
      total,
      instructions: bacs?.settings.instructions?.value ?? '',
      accountDetails: bacs?.settings.account_details?.value ?? [],
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
