// POST /api/contact
// Spam-protected contact form handler. Sends via MailChannels, which is
// free to use from Cloudflare Workers/Pages once a DNS lockdown TXT record
// is added for the sending domain (see docs/SECURITY.md).
import { sanitizeText, containsLinkOrScript, honeypotTripped, checkRateLimit, clientIp } from '../../src/lib/security';

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  CONTACT_TO_EMAIL: string;
  CONTACT_FROM_EMAIL: string;
}

interface ContactPayload {
  name: string;
  email: string;
  message: string;
  company?: string; // honeypot
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

  const name = sanitizeText(payload.name, 100);
  const message = sanitizeText(payload.message, 2000);
  const email = sanitizeText(payload.email, 120);

  if (!name || !message || !email) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  if (containsLinkOrScript(message)) {
    return new Response(JSON.stringify({ error: 'Links are not allowed in this form.' }), { status: 400 });
  }

  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env.CONTACT_TO_EMAIL }] }],
      from: { email: env.CONTACT_FROM_EMAIL, name: 'Website Contact Form' },
      reply_to: { email },
      subject: `New contact form message from ${name}`,
      content: [{ type: 'text/plain', value: `From: ${name} <${email}>\n\n${message}` }],
    }),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Unable to send message right now.' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
