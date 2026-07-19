// POST /api/verify-email/request { email }
// Sends a 6-digit one-time code to the given address. Used to prove email
// ownership before letting someone submit a review or look up their orders.
import type { APIRoute } from 'astro';
import { sanitizeText, checkRateLimit, clientIp } from '../../../lib/security';
import { sendVerificationCode } from '../../../lib/emailVerification';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinIpLimit = await checkRateLimit(env.RATE_LIMIT_KV, `verify-req-ip:${ip}`, 10, 600);
  if (!withinIpLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  let payload: { email?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const email = sanitizeText(payload.email ?? '', 120);
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), { status: 400 });
  }

  const withinEmailLimit = await checkRateLimit(env.RATE_LIMIT_KV, `verify-req-email:${email.toLowerCase()}`, 5, 600);
  if (!withinEmailLimit) {
    return new Response(JSON.stringify({ error: 'Too many codes requested for this email, please try again shortly.' }), {
      status: 429,
    });
  }

  const sent = await sendVerificationCode(env.RATE_LIMIT_KV, env.CONTACT_FROM_EMAIL, email);
  if (!sent) {
    return new Response(JSON.stringify({ error: 'Unable to send a verification code right now.' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
