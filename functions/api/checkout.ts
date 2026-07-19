// POST /api/checkout
// Creates a pending WooCommerce order, then returns the signed PayFast
// redirect fields. The frontend posts these fields to PayFast directly.
import { createOrder, type WooCommerceEnv } from '../../src/lib/woocommerce';
import { buildPayfastPaymentFields, type PayfastConfig } from '../../src/lib/payfast';
import { sanitizeText, checkRateLimit, clientIp } from '../../src/lib/security';

interface Env extends WooCommerceEnv {
  PAYFAST_MERCHANT_ID: string;
  PAYFAST_MERCHANT_KEY: string;
  PAYFAST_PASSPHRASE: string;
  PAYFAST_MODE: 'sandbox' | 'live';
  PUBLIC_SITE_URL: string;
  RATE_LIMIT_KV: KVNamespace;
}

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

  const order = await createOrder(env, {
    payment_method: 'payfast',
    payment_method_title: 'PayFast',
    set_paid: false,
    billing,
    line_items: payload.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
  });

  const total = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const payfastConfig: PayfastConfig = {
    merchantId: env.PAYFAST_MERCHANT_ID,
    merchantKey: env.PAYFAST_MERCHANT_KEY,
    passphrase: env.PAYFAST_PASSPHRASE,
    mode: env.PAYFAST_MODE,
  };

  const fields = buildPayfastPaymentFields(payfastConfig, {
    orderId: String((order as { id: number }).id),
    amount: total,
    itemName: `Order #${(order as { id: number }).id}`,
    buyerEmail: billing.email,
    buyerFirstName: billing.first_name,
    returnUrl: `${env.PUBLIC_SITE_URL}/checkout/success`,
    cancelUrl: `${env.PUBLIC_SITE_URL}/checkout/cancelled`,
    notifyUrl: `${env.PUBLIC_SITE_URL}/api/payfast-webhook`,
  });

  return new Response(
    JSON.stringify({
      orderId: (order as { id: number }).id,
      payfastHost: env.PAYFAST_MODE === 'live' ? 'https://www.payfast.co.za/eng/process' : 'https://sandbox.payfast.co.za/eng/process',
      fields,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
