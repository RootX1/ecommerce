// POST /api/checkout
// Creates a WooCommerce order using "Direct bank transfer" (BACS) — no
// payment gateway credentials needed. The order is explicitly set to
// "on-hold" (WooCommerce's REST API defaults new orders to "pending"
// otherwise, which never triggers WooCommerce's on-hold status-change
// hooks/emails) until the store owner manually confirms the transfer and
// marks it paid/processing in wp-admin. A confirmation email is sent
// directly by the Worker (not relying on WordPress/PHP mail, which is
// often unreliable on shared hosting without an SMTP plugin).
import type { APIRoute } from 'astro';
import { createOrder, getBacsGateway, getDefaultShippingCost, type BacsAccountDetail } from '../../lib/woocommerce';
import { sanitizeText, checkRateLimit, clientIp } from '../../lib/security';
import { sendEmail } from '../../lib/email';

export const prerender = false;

interface CheckoutPayload {
  items: { productId: number; quantity: number; unitPrice: number; name: string; designImageUrl?: string }[];
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

function formatZar(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
}

function formatAccountDetails(accounts: BacsAccountDetail[]): string {
  return accounts
    .map((a) =>
      [
        a.bank_name && `Bank: ${a.bank_name}`,
        a.account_name && `Account name: ${a.account_name}`,
        a.account_number && `Account number: ${a.account_number}`,
        a.sort_code && `Branch code: ${a.sort_code}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');
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
  // WooCommerce's REST API treats a line item with quantity <= 0 as a
  // request to remove an existing order item, which crashes with a fatal
  // error during order *creation* (there's no existing item to remove) —
  // https://github.com/woocommerce/woocommerce/issues/54697. Reject bad
  // items here instead of letting that request reach WooCommerce.
  const hasInvalidItem = payload.items.some(
    (item) => !Number.isInteger(item.productId) || item.productId <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0
  );
  if (hasInvalidItem) {
    return new Response(JSON.stringify({ error: 'Cart contains an invalid item, please refresh your cart and try again.' }), { status: 400 });
  }

  const firstName = sanitizeText(payload.billing.firstName, 60);
  const lastName = sanitizeText(payload.billing.lastName, 60);
  const email = sanitizeText(payload.billing.email, 120);
  const address1 = sanitizeText(payload.billing.address1, 200);
  const city = sanitizeText(payload.billing.city, 100);
  const postcode = sanitizeText(payload.billing.postcode, 20);

  const billing = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: sanitizeText(payload.billing.phone, 30),
    address_1: address1,
    city,
    postcode,
    country: 'ZA',
  };
  // WooCommerce's shipping address schema has no email/phone fields.
  const shippingAddress = { first_name: firstName, last_name: lastName, address_1: address1, city, postcode, country: 'ZA' };

  if (!billing.email || !billing.first_name || !billing.address_1) {
    return new Response(JSON.stringify({ error: 'Missing required billing fields' }), { status: 400 });
  }

  const [bacs, shipping] = await Promise.all([getBacsGateway(env).catch(() => null), getDefaultShippingCost(env)]);

  const itemsTotal = payload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const grandTotal = itemsTotal + shipping.cost;

  const order = await createOrder(env, {
    status: 'on-hold',
    payment_method: 'bacs',
    payment_method_title: 'Direct Bank Transfer',
    set_paid: false,
    billing,
    shipping: shippingAddress,
    line_items: payload.items.map((item) => {
      // Only trust design URLs that are actually ours — never let a
      // customer inject an arbitrary link into the order via this field.
      const isOwnUpload = item.designImageUrl?.startsWith(env.PUBLIC_UPLOADS_BASE_URL);
      return {
        product_id: item.productId,
        quantity: item.quantity,
        meta_data: isOwnUpload ? [{ key: 'Design Upload', value: item.designImageUrl as string }] : undefined,
      };
    }),
    shipping_lines: [{ method_id: shipping.methodId, method_title: shipping.methodTitle, total: shipping.cost.toFixed(2) }],
  });

  const orderId = (order as { id: number }).id;
  const accountDetails = bacs?.settings.account_details?.value ?? [];
  const instructions = bacs?.settings.instructions?.value ?? '';

  try {
    const itemLines = payload.items.map((item) => `  ${item.quantity} x ${item.name} — ${formatZar(item.unitPrice * item.quantity)}`).join('\n');
    await sendEmail({
      to: billing.email,
      from: env.CONTACT_FROM_EMAIL,
      fromName: 'Ecommerce Goods',
      subject: `Order confirmation — Order #${orderId}`,
      text: [
        `Hi ${firstName},`,
        '',
        `Thanks for your order! Here's a summary of Order #${orderId}:`,
        '',
        itemLines,
        '',
        `Delivery (${shipping.methodTitle}): ${formatZar(shipping.cost)}`,
        `Total: ${formatZar(grandTotal)}`,
        '',
        `Delivering to:`,
        `${firstName} ${lastName}`,
        address1,
        `${city}, ${postcode}`,
        '',
        'Payment: Direct bank transfer.',
        instructions,
        accountDetails.length > 0 ? formatAccountDetails(accountDetails) : '',
        '',
        `Please use "Order #${orderId}" as your payment reference so we can match your transfer.`,
        '',
        "We'll be in touch once payment is confirmed.",
      ]
        .filter((line) => line !== '')
        .join('\n'),
    });
  } catch {
    // Order is already created — a failed confirmation email shouldn't fail checkout.
  }

  return new Response(
    JSON.stringify({
      orderId,
      itemsTotal,
      shippingCost: shipping.cost,
      shippingTitle: shipping.methodTitle,
      total: grandTotal,
      instructions,
      accountDetails,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};
