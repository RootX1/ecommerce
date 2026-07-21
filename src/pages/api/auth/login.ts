// POST /api/auth/login { email, password }
// Confirms the visitor's real WooCommerce account password via the
// WordPress JWT Authentication plugin, then issues an HttpOnly session
// cookie — identity for every later request comes from that cookie, never
// from anything the client claims, so knowing someone's email is never
// enough to act as them.
import type { APIRoute } from 'astro';
import { loginWithPassword } from '../../../lib/wpAuth';
import { createSession, sessionCookieHeader } from '../../../lib/session';
import { sanitizeText, checkRateLimit, clientIp, verifyTurnstile } from '../../../lib/security';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `login:${ip}`, 10, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  let payload: { email?: string; password?: string; turnstileToken?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const email = sanitizeText(payload.email ?? '', 120);
  const password = payload.password ?? '';
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Please enter your email and password.' }), { status: 400 });
  }

  const human = await verifyTurnstile(payload.turnstileToken ?? '', env.TURNSTILE_SECRET_KEY, ip);
  if (!human) {
    return new Response(JSON.stringify({ error: 'Verification failed, please try again.' }), { status: 400 });
  }

  try {
    const result = await loginWithPassword(env, email, password);
    const verifiedEmail = result.user_email || email;
    const name = result.user_display_name || '';
    const token = await createSession(env.RATE_LIMIT_KV, verifiedEmail, name);
    return new Response(JSON.stringify({ email: verifiedEmail, name }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookieHeader(token) },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Incorrect email or password.' }), {
      status: 401,
    });
  }
};
