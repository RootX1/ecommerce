// Lightweight "verified email" gate — not a full customer account system.
// A visitor proves they own an email address by receiving a one-time code,
// which unlocks review submission and order lookups for that address for a
// while afterwards. State lives in the same rate-limit KV namespace, keyed
// separately from the rate-limit counters.
import type { KVNamespace } from '@cloudflare/workers-types';
import { sendEmail, type SmtpEnv } from './email';

const CODE_TTL_SECONDS = 600; // 10 minutes to enter the code
const VERIFIED_TTL_SECONDS = 60 * 60 * 24 * 90; // verified for 90 days

interface VerificationEnv extends SmtpEnv {
  RATE_LIMIT_KV: KVNamespace;
  CONTACT_FROM_EMAIL: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function sendVerificationCode(env: VerificationEnv, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await env.RATE_LIMIT_KV.put(`email-code:${normalized}`, code, { expirationTtl: CODE_TTL_SECONDS });
  return sendEmail(env, {
    to: normalized,
    from: env.CONTACT_FROM_EMAIL,
    fromName: 'Ecommerce Goods',
    subject: 'Your verification code',
    text: `Your verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });
}

export async function confirmVerificationCode(kv: KVNamespace, email: string, code: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const stored = await kv.get(`email-code:${normalized}`);
  if (!stored || stored !== code.trim()) return false;
  await kv.delete(`email-code:${normalized}`);
  await kv.put(`email-verified:${normalized}`, '1', { expirationTtl: VERIFIED_TTL_SECONDS });
  return true;
}

export async function isEmailVerified(kv: KVNamespace, email: string): Promise<boolean> {
  const verified = await kv.get(`email-verified:${normalizeEmail(email)}`);
  return verified === '1';
}
