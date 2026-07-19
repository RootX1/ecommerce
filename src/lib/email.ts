// Sends transactional email via real SMTP — straight from the Worker to
// Xneelo's own mail server for sales@ecommercegoods.co.za, using Cloudflare
// TCP Sockets (via the `worker-mailer` package). Deliberately NOT using
// MailChannels/any Cloudflare-hosted relay: Xneelo already hosts this
// mailbox, so sending goes out through their infrastructure instead of
// requiring a separate DNS lockdown record for a third party.
import { WorkerMailer } from 'worker-mailer';

export interface SmtpEnv {
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
}

export interface SendEmailInput {
  to: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export async function sendEmail(env: SmtpEnv, input: SendEmailInput): Promise<boolean> {
  const port = Number(env.SMTP_PORT || '587');
  try {
    await WorkerMailer.send(
      {
        host: env.SMTP_HOST,
        port,
        // Port 465 is implicit TLS; anything else (587, 25) negotiates TLS via STARTTLS.
        secure: port === 465,
        credentials: {
          username: env.SMTP_USERNAME,
          password: env.SMTP_PASSWORD,
        },
        authType: ['plain', 'login'],
      },
      {
        from: { email: input.from, name: input.fromName ?? 'Ecommerce Goods' },
        to: input.to,
        ...(input.replyTo ? { reply: input.replyTo } : {}),
        subject: input.subject,
        text: input.text,
      }
    );
    return true;
  } catch (err) {
    console.error('SMTP send failed:', err);
    return false;
  }
}
