// One-time email code used as a second factor during account creation
// only (not for returning-user login, which already proves identity via
// password). The code must be correct before the WooCommerce customer —
// and the session that comes with it — is created at all.
import type { KVNamespace } from '@cloudflare/workers-types';
import { sendEmail, type SmtpEnv } from './email';

const OTP_TTL_SECONDS = 600; // 10 minutes to enter the code

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface SignupOtpEnv extends SmtpEnv {
  RATE_LIMIT_KV: KVNamespace;
  CONTACT_FROM_EMAIL: string;
}

export async function sendSignupOtp(env: SignupOtpEnv, email: string): Promise<boolean> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await env.RATE_LIMIT_KV.put(`signup-otp:${normalizeEmail(email)}`, code, { expirationTtl: OTP_TTL_SECONDS });
  return sendEmail(env, {
    to: email,
    from: env.CONTACT_FROM_EMAIL,
    fromName: 'Ecommerce Goods',
    subject: 'Your account verification code',
    text: `Your verification code is ${code}.\n\nEnter it to finish creating your account. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });
}

export async function verifySignupOtp(kv: KVNamespace, email: string, code: string): Promise<boolean> {
  const key = `signup-otp:${normalizeEmail(email)}`;
  const stored = await kv.get(key);
  if (!stored || stored !== code.trim()) return false;
  await kv.delete(key);
  return true;
}
