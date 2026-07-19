// POST /api/verify-email/confirm { email, code }
// Confirms the one-time code sent by /api/verify-email/request and marks
// the email as verified for 90 days.
import type { APIRoute } from 'astro';
import { sanitizeText, checkRateLimit, clientIp } from '../../../lib/security';
import { confirmVerificationCode } from '../../../lib/emailVerification';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `verify-confirm:${ip}`, 15, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many attempts, please try again shortly.' }), { status: 429 });
  }

  let payload: { email?: string; code?: string };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  const email = sanitizeText(payload.email ?? '', 120);
  const code = sanitizeText(payload.code ?? '', 10);
  if (!email || !code) {
    return new Response(JSON.stringify({ error: 'Missing email or code' }), { status: 400 });
  }

  const verified = await confirmVerificationCode(env.RATE_LIMIT_KV, email, code);
  if (!verified) {
    return new Response(JSON.stringify({ error: 'Incorrect or expired code.' }), { status: 400 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
