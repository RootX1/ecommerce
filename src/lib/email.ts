// Sends transactional email via MailChannels — free from Cloudflare
// Workers once a DNS lockdown TXT record is added for the sending domain
// (see docs/SECURITY.md). Used for the contact form and order
// confirmations, sent directly by the Worker rather than relying on
// WordPress/PHP mail() (unreliable on shared hosting without an SMTP
// plugin configured).

export interface SendEmailInput {
  to: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: input.from, name: input.fromName ?? 'Website' },
      ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
      subject: input.subject,
      content: [{ type: 'text/plain', value: input.text }],
    }),
  });
  return res.ok;
}
