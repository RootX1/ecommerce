// POST /api/contact
// Spam-protected contact form handler. Sends via MailChannels, which is
// free to use from Cloudflare Workers once a DNS lockdown TXT record is
// added for the sending domain (see docs/SECURITY.md).
import type { APIRoute } from 'astro';
import { sanitizeText, containsLinkOrScript, honeypotTripped, verifyTurnstile, checkRateLimit, clientIp } from '../../lib/security';
import { sendEmail } from '../../lib/email';

export const prerender = false;

interface ContactPayload {
  name: string;
  email: string;
  message: string;
  turnstileToken: string;
  company?: string; // honeypot
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);
  const withinLimit = await checkRateLimit(env.RATE_LIMIT_KV, `contact:${ip}`, 5, 600);
  if (!withinLimit) {
    return new Response(JSON.stringify({ error: 'Too many messages, please try again later.' }), { status: 429 });
  }

  let payload: ContactPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  if (honeypotTripped(payload.company)) {
    return new Response(JSON.stringify({ error: 'Submission rejected' }), { status: 400 });
  }

  const human = await verifyTurnstile(payload.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!human) {
    return new Response(JSON.stringify({ error: 'Verification failed, please try again.' }), { status: 400 });
  }

  const name = sanitizeText(payload.name, 100);
  const message = sanitizeText(payload.message, 2000);
  const email = sanitizeText(payload.email, 120);

  if (!name || !message || !email) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  if (containsLinkOrScript(message)) {
    return new Response(JSON.stringify({ error: 'Links are not allowed in this form.' }), { status: 400 });
  }

  const sent = await sendEmail({
    to: env.CONTACT_TO_EMAIL,
    from: env.CONTACT_FROM_EMAIL,
    fromName: 'Website Contact Form',
    replyTo: email,
    subject: `New contact form message from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  });

  if (!sent) {
    return new Response(JSON.stringify({ error: 'Unable to send message right now.' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
