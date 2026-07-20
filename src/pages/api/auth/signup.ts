// POST /api/auth/signup { email, password, firstName, lastName }
// Creates a real WooCommerce customer (WordPress user) via the admin REST
// API, then issues an HttpOnly session cookie immediately — no separate
// login step needed right after signing up.
import type { APIRoute } from 'astro';
import { createCustomer } from '../../../lib/woocommerce';
import { createSession, sessionCookieHeader } from '../../../lib/session';
import { sanitizeText, checkRateLimit, clientIp } from '../../../lib/security';

export const prerender = false;

interface SignupPayload {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `signup:${ip}`, 5, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  let payload: SignupPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const email = sanitizeText(payload.email ?? '', 120);
  const firstName = sanitizeText(payload.firstName ?? '', 60);
  const lastName = sanitizeText(payload.lastName ?? '', 60);
  const password = payload.password ?? '';

  if (!email || !email.includes('@') || !firstName || password.length < 8) {
    return new Response(
      JSON.stringify({ error: 'Please enter your name, a valid email, and a password of at least 8 characters.' }),
      { status: 400 }
    );
  }

  try {
    await createCustomer(env, { email, first_name: firstName, last_name: lastName, username: email, password });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('registration-error-email-exists') || message.includes('already registered')) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists — please sign in instead.' }), {
        status: 409,
      });
    }
    console.error('WooCommerce customer signup failed:', err);
    return new Response(JSON.stringify({ error: 'Unable to create your account right now.' }), { status: 502 });
  }

  const name = [firstName, lastName].filter(Boolean).join(' ');
  const token = await createSession(env.RATE_LIMIT_KV, email, name);
  return new Response(JSON.stringify({ email, name }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookieHeader(token) },
  });
};
