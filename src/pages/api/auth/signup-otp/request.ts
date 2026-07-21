// POST /api/auth/signup-otp/request { email, turnstileToken }
// Step 1 of signup: sends a one-time code to the email the visitor wants
// to register with. The account itself isn't created until that code is
// confirmed via /api/auth/signup-otp/verify.
import type { APIRoute } from 'astro';
import { sendSignupOtp } from '../../../../lib/signupOtp';
import { sanitizeText, checkRateLimit, clientIp, verifyTurnstile } from '../../../../lib/security';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `signup-otp-req:${ip}`, 5, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  let payload: { email?: string; turnstileToken?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const email = sanitizeText(payload.email ?? '', 120);
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), { status: 400 });
  }

  const human = await verifyTurnstile(payload.turnstileToken ?? '', env.TURNSTILE_SECRET_KEY, ip);
  if (!human) {
    return new Response(JSON.stringify({ error: 'Verification failed, please try again.' }), { status: 400 });
  }

  const withinEmailLimit = await checkRateLimit(env.RATE_LIMIT_KV, `signup-otp-req-email:${email.toLowerCase()}`, 5, 600);
  if (!withinEmailLimit) {
    return new Response(JSON.stringify({ error: 'Too many codes requested for this email, please try again shortly.' }), {
      status: 429,
    });
  }

  const sent = await sendSignupOtp(env, email);
  if (!sent) {
    return new Response(JSON.stringify({ error: 'Unable to send a verification code right now.' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
