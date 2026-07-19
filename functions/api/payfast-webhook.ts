// POST /api/payfast-webhook
// PayFast ITN (Instant Transaction Notification). Marks the matching
// WooCommerce order as paid once the notification is fully verified.
// Verification follows PayFast's documented steps: signature, source IP,
// and a callback confirmation to PayFast itself — all three must pass.
import { updateOrderStatus, type WooCommerceEnv } from '../../src/lib/woocommerce';
import { verifyPayfastItnSignature, confirmPayfastItn, isPayfastSourceIp } from '../../src/lib/payfast';
import { clientIp } from '../../src/lib/security';

interface Env extends WooCommerceEnv {
  PAYFAST_PASSPHRASE: string;
  PAYFAST_MODE: 'sandbox' | 'live';
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const payload: Record<string, string> = {};
  for (const [key, value] of params.entries()) payload[key] = value;

  const ip = clientIp(request);

  const [signatureOk, ipOk, confirmed] = await Promise.all([
    Promise.resolve(verifyPayfastItnSignature(payload, env.PAYFAST_PASSPHRASE)),
    isPayfastSourceIp(ip),
    confirmPayfastItn(env.PAYFAST_MODE, rawBody),
  ]);

  if (!signatureOk || !ipOk || !confirmed) {
    return new Response('Invalid ITN', { status: 400 });
  }

  const orderId = payload.m_payment_id;
  const paymentStatus = payload.payment_status;

  if (orderId && paymentStatus === 'COMPLETE') {
    await updateOrderStatus(env, orderId, 'processing');
  } else if (orderId && paymentStatus === 'FAILED') {
    await updateOrderStatus(env, orderId, 'failed');
  }

  return new Response('OK', { status: 200 });
};
